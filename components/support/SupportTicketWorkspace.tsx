"use client";

import { ChevronDown, Eye, FileText, LoaderCircle, Lock, PenLine, Send, StickyNote } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
  addSupportNoteAction,
  leaveSupportPresenceAction,
  replySupportTicketAction,
  supportPresenceAction,
  updateSupportTicketAction,
  type SupportPresenceOther,
  type SupportCannedReply,
  type SupportMessage,
  type SupportTicket,
  type SupportTicketCategory,
  type SupportTicketPriority,
  type SupportTicketStatus,
  type SupportUserSummary,
} from "@/app/actions/supportDesk";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toast";
import { formatBytes, supportAttachmentHref, uploadSupportAttachments } from "@/lib/support/attachments";
import { buildThreadItems, initials, isAutomaticReply, isDxgSide, timeLabel } from "@/lib/support/thread";
import AttachmentPicker from "./AttachmentPicker";
import CannedReplyPicker from "./CannedReplyPicker";
import SendReplyButton from "./SendReplyButton";
import {
  CATEGORY_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  priorityClass,
  statusClass,
} from "./supportLabels";
import SupportDateTime from "./SupportDateTime";
import SupportSelect from "./SupportSelect";
import ResponseDueBadge from "./ResponseDueBadge";

type Props = {
  ticket: SupportTicket;
  requester: SupportUserSummary | null;
  assignee: SupportUserSummary | null;
  messages: SupportMessage[];
  agents: SupportUserSummary[];
  cannedReplies: SupportCannedReply[];
  currentUserId: string;
};

const COMPOSER_MAX_HEIGHT_PX = 220;
const PRESENCE_HEARTBEAT_MS = 10_000;

const joinNames = (names: string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

const subscribe = () => () => undefined;
const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);

const Attachments = ({ message, ticketId }: { message: SupportMessage; ticketId: string }) => (
  <ul className="mt-2 flex flex-wrap gap-2 text-[11px]" aria-label="Attachments">
    {message.attachments.map((attachment) => {
      const href = supportAttachmentHref(ticketId, attachment.id);
      const isImage = attachment.mimeType.startsWith("image/");
      return (
        <li key={attachment.id}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={`${attachment.fileName} · ${formatBytes(attachment.sizeBytes)}`}
            className="block overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#253746] dark:bg-[#0f2230]"
          >
            {isImage ? (
              <span className="block h-40 w-[220px] bg-slate-200/40 dark:bg-slate-700/40">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL from our own proxy */}
                <img src={href} alt={attachment.fileName} className="block h-full w-full object-cover" loading="lazy" />
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-semibold text-slate-600 dark:text-slate-200">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                {attachment.fileName}
                <span className="text-slate-400">{formatBytes(attachment.sizeBytes)}</span>
              </span>
            )}
            {isImage && (
              <span className="block truncate px-2 py-1 text-[10px] font-semibold text-slate-500 dark:text-slate-300">
                {attachment.fileName}
              </span>
            )}
          </a>
        </li>
      );
    })}
  </ul>
);

const Avatar = ({ message, requesterName }: { message: SupportMessage; requesterName: string | null }) => {
  if (message.kind === "internal_note") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }
  if (isAutomaticReply(message)) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-black text-slate-600 dark:bg-[#1c3442] dark:text-slate-300">
        DXG
      </span>
    );
  }
  const customer = message.authorRole === "customer";
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
        customer
          ? "bg-slate-200 text-slate-700 dark:bg-[#1c3442] dark:text-slate-200"
          : "bg-[#00a3aa] text-white"
      }`}
    >
      {initials(customer ? message.author?.name ?? requesterName : message.author?.name ?? "DXG")}
    </span>
  );
};

const MessageRow = ({
  message,
  startsGroup,
  endsGroup,
  ticketId,
  requesterName,
  hydrated,
  pending = false,
}: {
  message: SupportMessage;
  startsGroup: boolean;
  endsGroup: boolean;
  ticketId: string;
  requesterName: string | null;
  hydrated: boolean;
  pending?: boolean;
}) => {
  const dxg = isDxgSide(message);
  const note = message.kind === "internal_note";
  const automatic = isAutomaticReply(message);
  const name = automatic
    ? "Automatic reply"
    : message.author?.name ?? (message.authorRole === "customer" ? requesterName ?? "Customer" : "DXG support");
  const corner = endsGroup ? (dxg ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-bl-md") : "rounded-2xl";

  return (
    <li className={`flex items-end gap-2.5 ${dxg ? "flex-row-reverse" : ""} ${startsGroup ? "mt-4 first:mt-0" : "mt-1"}`}>
      {endsGroup ? <Avatar message={message} requesterName={requesterName} /> : <span className="w-8 shrink-0" aria-hidden="true" />}
      <div className={`flex max-w-[78%] flex-col ${dxg ? "items-end" : "items-start"}`}>
        {startsGroup && (
          <p className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {name}
            {note && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-800 dark:bg-amber-800/60 dark:text-amber-100">
                <Lock className="h-2.5 w-2.5" aria-hidden="true" /> Internal note
              </span>
            )}
          </p>
        )}
        <article
          className={`border px-4 py-2.5 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${corner} ${
            note
              ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100"
              : dxg
                ? "border-[#c9efea] bg-[#eaf9f8] text-[#10303a] dark:border-cyan-800/60 dark:bg-cyan-950/50 dark:text-cyan-50"
                : "border-slate-200 bg-white text-slate-800 dark:border-[#253746] dark:bg-[#142a37] dark:text-slate-100"
          } ${pending ? "opacity-70" : ""}`}
        >
          <p className="whitespace-pre-wrap break-words leading-6">{message.body}</p>
          {message.attachments.length > 0 && <Attachments message={message} ticketId={ticketId} />}
        </article>
        {endsGroup && (
          <p className="mt-1 px-1 text-[10.5px] font-medium text-slate-400">
            {pending ? "Sending…" : <time dateTime={message.createdAt}>{hydrated ? timeLabel(message.createdAt) : ""}</time>}
          </p>
        )}
      </div>
    </li>
  );
};

export default function SupportTicketWorkspace({
  ticket,
  requester,
  messages,
  agents,
  cannedReplies,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [replyStatus, setReplyStatus] = useState<SupportTicketStatus>("waiting_on_customer");
  const [cannedOpen, setCannedOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [controlPending, setControlPending] = useState<string | null>(null);
  const [sending, setSending] = useState<SupportMessage | null>(null);
  const hydrated = useHydrated();
  const composer = useRef<HTMLTextAreaElement>(null);
  const [others, setOthers] = useState<SupportPresenceOther[]>([]);
  const [confirmSend, setConfirmSend] = useState(false);
  // On small screens triage folds into a one-line summary to leave room for the chat.
  const [triageOpen, setTriageOpen] = useState(false);
  const writing = body.trim().length > 0;
  const replyingOthers = others.filter((other) => other.state === "replying");
  const viewingOthers = others.filter((other) => other.state === "viewing");

  // Tell the other agents this ticket is open here (and whether a reply is
  // being written), and learn who else has it open, so two agents never
  // answer the same customer without knowing.
  const writingRef = useRef(writing);
  useEffect(() => {
    writingRef.current = writing;
  }, [writing]);
  useEffect(() => {
    let cancelled = false;
    const beat = () => {
      void supportPresenceAction(ticket.id, writingRef.current ? "replying" : "viewing").then((result) => {
        if (!cancelled && result.ok) setOthers(result.data.others);
      });
    };
    const first = setTimeout(beat, 0);
    const timer = setInterval(beat, PRESENCE_HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
      void leaveSupportPresenceAction(ticket.id);
    };
  }, [ticket.id]);
  // Starting or clearing a draft is announced straight away, not on the next beat.
  useEffect(() => {
    let cancelled = false;
    void supportPresenceAction(ticket.id, writing ? "replying" : "viewing").then((result) => {
      if (!cancelled && result.ok) setOthers(result.data.others);
    });
    return () => {
      cancelled = true;
    };
  }, [ticket.id, writing]);


  const assignedToMe = ticket.assigneeUserId === currentUserId;
  const endOfThread = useRef<HTMLLIElement>(null);

  // Keep the newest message in view, like a chat, instead of scrolling the page.
  useEffect(() => {
    endOfThread.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length, ticket.status, sending]);

  // Day separators depend on the viewer's clock, so they appear after hydration.
  const items = useMemo(() => buildThreadItems(messages, hydrated ? new Date() : null), [messages, hydrated]);

  // Grow the composer with its content, up to a cap.
  useEffect(() => {
    const element = composer.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
  }, [body]);

  const insertCanned = (text: string) => {
    setBody((current) => (current.trim() ? `${current.trimEnd()}\n\n${text}` : text));
    setMode("reply");
    setTimeout(() => composer.current?.focus(), 0);
  };

  // Replies either wait for the customer ("Send") or resolve the ticket
  // ("Send & resolve", which closes it 3 days later unless the customer replies).
  const send = (status: SupportTicketStatus = "waiting_on_customer") => {
    setReplyStatus(status);
    if (mode === "reply" && replyingOthers.length > 0 && body.trim()) {
      setConfirmSend(true);
      return;
    }
    sendNow(status);
  };

  const sendNow = (status: SupportTicketStatus = replyStatus) => {
    setConfirmSend(false);
    const text = body.trim();
    if (!text) {
      toast.error(mode === "reply" ? "Write a reply first." : "Write a note first.");
      return;
    }
    // Shown straight away and replaced by the real message on refresh. The
    // composer clears like a chat; a failed send puts the draft back.
    const draftFiles = files;
    setSending({
      id: "pending",
      ticketId: ticket.id,
      authorUserId: currentUserId,
      authorRole: "agent",
      kind: mode === "reply" ? "message" : "internal_note",
      body: text,
      attachments: [],
      createdAt: new Date().toISOString(),
      author: agents.find((agent) => agent.id === currentUserId) ?? null,
    });
    setBody("");
    setFiles([]);
    const restore = (message: string) => {
      setSending(null);
      setBody(text);
      setFiles(draftFiles);
      toast.error(message);
    };
    startTransition(async () => {
      let attachments: string[] = [];
      if (mode === "reply" && draftFiles.length > 0) {
        const uploaded = await uploadSupportAttachments(draftFiles);
        if (!uploaded.ok) {
          restore(uploaded.message);
          return;
        }
        attachments = uploaded.attachments.map((attachment) => attachment.id);
      }
      const result =
        mode === "reply"
          ? await replySupportTicketAction(ticket.id, { body: text, status, attachments })
          : await addSupportNoteAction(ticket.id, text);
      if (!result.ok) {
        restore(result.error);
        return;
      }
      setSending(null);
      router.refresh();
    });
  };

  const patch = async (
    label: string,
    input: Parameters<typeof updateSupportTicketAction>[1],
  ) => {
    setControlPending(label);
    const result = await updateSupportTicketAction(ticket.id, input);
    setControlPending(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${label} updated.`);
    router.refresh();
  };

  return (
    <div>
      <section className="flex h-[calc(100dvh-7.5rem)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <header className="space-y-3 border-b border-slate-100 px-5 py-3.5 dark:border-[#203541]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-400">#{ticket.ticketNumber}</span>
            <h1 className="text-lg font-extrabold tracking-[-0.02em] text-[#10203a] dark:text-slate-50">{ticket.subject}</h1>
            <ResponseDueBadge dueAt={ticket.responseDueAt} resolvedAt={ticket.status === "resolved" ? ticket.resolvedAt : null} />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <a
              href={requester?.email ? `/clients?search=${encodeURIComponent(requester.email)}` : undefined}
              title={requester?.email ? "Open in client directory" : undefined}
              className="group inline-flex min-w-0 items-center gap-2"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-black text-slate-700 dark:bg-[#1c3442] dark:text-slate-200">
                {initials(requester?.name)}
              </span>
              <span className="truncate font-semibold text-slate-700 group-hover:text-[#007f86] dark:text-slate-200">
                {requester?.name ?? "Unknown user"}
              </span>
              {requester?.email && <span className="hidden truncate sm:inline">{requester.email}</span>}
              {requester?.company && <span className="hidden truncate md:inline">· {requester.company}</span>}
            </a>
            <span aria-hidden="true" className="hidden text-slate-300 sm:inline dark:text-slate-600">|</span>
            <span>
              Opened <SupportDateTime value={ticket.createdAt} />
              {ticket.firstAgentResponseAt ? (
                <> · first response <SupportDateTime value={ticket.firstAgentResponseAt} /></>
              ) : (
                " · no agent response yet"
              )}
              {ticket.resolvedAt ? (
                <> · resolved <SupportDateTime value={ticket.resolvedAt} /></>
              ) : null}
            </span>
          </div>

          {/* Triage: every change is logged in the conversation. */}
          <button
            type="button"
            onClick={() => setTriageOpen((open) => !open)}
            aria-expanded={triageOpen}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 sm:hidden dark:border-[#253746] dark:text-slate-300"
          >
            <span className="truncate">
              {agents.find((agent) => agent.id === ticket.assigneeUserId)?.name ?? "Unassigned"} ·{" "}
              {PRIORITY_OPTIONS.find((option) => option.value === ticket.priority)?.label} ·{" "}
              {STATUS_OPTIONS.find((option) => option.value === ticket.status)?.label}
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition ${triageOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          <div className={`${triageOpen ? "flex" : "hidden"} flex-wrap items-center gap-2 sm:flex`} aria-label="Triage">
            <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Owner
              <SupportSelect
                size="sm"
                wrapperClassName="w-40 normal-case tracking-normal"
                value={ticket.assigneeUserId ?? ""}
                disabled={controlPending === "Assignee"}
                onChange={(event) => void patch("Assignee", { assigneeUserId: event.target.value || null })}
              >
                <option value="">Unassigned</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                    {agent.id === currentUserId ? " (me)" : ""}
                  </option>
                ))}
              </SupportSelect>
            </label>
            {!assignedToMe && (
              <button
                type="button"
                disabled={controlPending === "Assignee"}
                onClick={() => void patch("Assignee", { assigneeUserId: currentUserId })}
                className="h-8 rounded-lg border border-[#c9efea] bg-[#eaf9f8] px-2.5 text-xs font-bold text-[#007f86] transition hover:bg-[#dff5f4] disabled:opacity-60 dark:border-cyan-800/60 dark:bg-cyan-950/40 dark:text-cyan-300"
              >
                Take it
              </button>
            )}
            <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Priority
              <SupportSelect
                size="sm"
                wrapperClassName={`w-28 normal-case tracking-normal ${priorityClass(ticket.priority)}`}
                value={ticket.priority}
                disabled={controlPending === "Priority"}
                onChange={(event) => void patch("Priority", { priority: event.target.value as SupportTicketPriority })}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SupportSelect>
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Status
              <SupportSelect
                size="sm"
                wrapperClassName={`w-44 normal-case tracking-normal ${statusClass(ticket.status)}`}
                value={ticket.status}
                disabled={controlPending === "Status"}
                onChange={(event) => void patch("Status", { status: event.target.value as SupportTicketStatus })}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SupportSelect>
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Category
              <SupportSelect
                size="sm"
                wrapperClassName="w-40 normal-case tracking-normal"
                value={ticket.category}
                disabled={controlPending === "Category"}
                onChange={(event) => void patch("Category", { category: event.target.value as SupportTicketCategory })}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SupportSelect>
            </label>
          </div>
        </header>

        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#fafcfc] px-4 py-5 sm:px-6 dark:bg-[#0b1a24]" aria-label="Conversation">
          {items.map((item) => {
            if (item.type === "day") {
              return (
                <li key={item.key} className="my-4 flex items-center gap-3 first:mt-0" aria-label={item.label}>
                  <span className="h-px flex-1 bg-slate-200 dark:bg-[#253746]" />
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{item.label}</span>
                  <span className="h-px flex-1 bg-slate-200 dark:bg-[#253746]" />
                </li>
              );
            }
            if (item.type === "event") {
              const internalActivity = item.message.kind === "internal_note";
              return (
                <li key={item.key} className="my-3 flex justify-center">
                  <p
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
                      internalActivity
                        ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                        : "bg-slate-100 text-slate-500 dark:bg-[#142a37] dark:text-slate-300"
                    }`}
                  >
                    {internalActivity && <Lock className="h-3 w-3" aria-hidden="true" />}
                    {item.message.body}
                    {hydrated && <span className="font-medium text-slate-400"> · {timeLabel(item.message.createdAt)}</span>}
                  </p>
                </li>
              );
            }
            return (
              <MessageRow
                key={item.key}
                message={item.message}
                startsGroup={item.startsGroup}
                endsGroup={item.endsGroup}
                ticketId={ticket.id}
                requesterName={requester?.name ?? null}
                hydrated={hydrated}
              />
            );
          })}
          {sending && (
            <MessageRow
              message={sending}
              startsGroup
              endsGroup
              ticketId={ticket.id}
              requesterName={requester?.name ?? null}
              hydrated={hydrated}
              pending
            />
          )}
          <li ref={endOfThread} aria-hidden="true" className="h-px" />
        </ul>

        <footer className="shrink-0 border-t border-slate-100 px-4 py-3 sm:px-5 dark:border-[#203541]">
          {others.length > 0 && (
            <div
              role="status"
              className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                replyingOthers.length
                  ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                  : "bg-slate-50 text-slate-600 dark:bg-[#0f2230] dark:text-slate-300"
              }`}
            >
              {replyingOthers.length ? (
                <PenLine className="h-3.5 w-3.5 shrink-0 animate-pulse" aria-hidden="true" />
              ) : (
                <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>
                {replyingOthers.length > 0 &&
                  `${joinNames(replyingOthers.map((other) => other.name))} ${replyingOthers.length === 1 ? "is" : "are"} writing a reply.`}
                {replyingOthers.length > 0 && viewingOthers.length > 0 && " "}
                {viewingOthers.length > 0 &&
                  `${joinNames(viewingOthers.map((other) => other.name))} ${viewingOthers.length === 1 ? "is" : "are"} viewing this ticket.`}
              </span>
            </div>
          )}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="Composer mode" className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-xs font-bold dark:border-[#253746] dark:bg-[#0f2230]">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "reply"}
                onClick={() => setMode("reply")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${mode === "reply" ? "bg-white text-[#007f86] shadow-sm dark:bg-[#142a37] dark:text-cyan-300" : "text-slate-500 dark:text-slate-400"}`}
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" /> Reply to customer
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "note"}
                onClick={() => setMode("note")}
                title="A private note for DXG agents only — the customer never sees it"
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${mode === "note" ? "bg-white text-amber-700 shadow-sm dark:bg-[#142a37] dark:text-amber-300" : "text-slate-500 dark:text-slate-400"}`}
              >
                <StickyNote className="h-3.5 w-3.5" aria-hidden="true" /> Internal note
              </button>
            </div>
            {mode === "reply" && (
              <CannedReplyPicker
                replies={cannedReplies}
                context={{ customerName: requester?.name ?? null, ticketNumber: ticket.ticketNumber }}
                open={cannedOpen}
                onOpenChange={setCannedOpen}
                onInsert={insertCanned}
              />
            )}
          </div>

          <div
            className={`flex flex-wrap items-end gap-1.5 rounded-2xl border p-1.5 transition focus-within:ring-2 ${
              mode === "note"
                ? "border-amber-200 bg-amber-50/60 focus-within:border-amber-400 focus-within:ring-amber-200 dark:border-amber-700/60 dark:bg-amber-950/30"
                : "border-slate-200 bg-white focus-within:border-[#00aeb5] focus-within:ring-[#00aeb5]/20 dark:border-[#253746] dark:bg-[#0f2230]"
            }`}
          >
            {mode === "reply" && (
              <AttachmentPicker files={files} onChange={setFiles} disabled={isPending} iconOnly />
            )}
            <textarea
              ref={composer}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                // "/" in an empty reply opens the canned replies, like Slack.
                if (event.key === "/" && mode === "reply" && !body) {
                  event.preventDefault();
                  setCannedOpen(true);
                  return;
                }
                // Agents send with Cmd/Ctrl+Enter so a half-written reply never
                // reaches a customer by an accidental Enter.
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  send();
                }
              }}
              rows={2}
              maxLength={5000}
              aria-label={mode === "reply" ? "Reply to customer" : "Internal note"}
              placeholder={
                mode === "reply"
                  ? "Write a reply the customer will see… (type / for canned replies)"
                  : "Write a note only DXG agents can see…"
              }
              className="order-2 min-h-14 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
            {mode === "reply" ? (
              <SendReplyButton pending={isPending} onSend={() => send()} onSendAndResolve={() => send("resolved")} />
            ) : (
              <button
                type="button"
                onClick={() => send()}
                disabled={isPending}
                aria-label="Add note"
                title="Add note (⌘/Ctrl + Enter)"
                className="order-4 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-60"
              >
                {isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <StickyNote className="h-4 w-4" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">Add note</span>
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
            {mode === "reply" ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Send waits for the customer. To resolve, use the ▾ next to Send.
              </span>
            ) : (
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Private to DXG agents — the customer never sees internal notes.</span>
            )}
            <span className="hidden text-[11px] text-slate-400 sm:inline">⌘/Ctrl + Enter to send</span>
          </div>
        </footer>
        <ConfirmDialog
          open={confirmSend}
          title="Someone else is replying"
          message={`${joinNames(replyingOthers.map((other) => other.name)) || "Another agent"} is also writing a reply to this customer. Send yours anyway?`}
          confirmLabel="Send anyway"
          onConfirm={() => sendNow()}
          onCancel={() => setConfirmSend(false)}
        />
      </section>

    </div>
  );
}
