"use client";

import { MessageSquareText, Search, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { SupportCannedReply } from "@/app/actions/supportDesk";

export type CannedReplyContext = {
  customerName: string | null;
  ticketNumber: number;
};

/**
 * Fills the placeholders a canned reply may use:
 * {{first_name}}, {{name}}, {{ticket_number}}, {{agent_name}}. Customers
 * only ever see one "DXG support" name, so {{agent_name}} is always that.
 * Unknown placeholders are left as written so nothing is silently lost.
 */
export const fillCannedReply = (body: string, context: CannedReplyContext): string => {
  const fullName = context.customerName?.trim() || "";
  const values: Record<string, string> = {
    first_name: fullName.split(/\s+/)[0] || "there",
    name: fullName || "there",
    ticket_number: `#${context.ticketNumber}`,
    agent_name: "DXG support",
  };
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key: string) => values[key.toLowerCase()] ?? match);
};

export const matchesCannedReply = (reply: SupportCannedReply, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  return !needle || reply.title.toLowerCase().includes(needle) || reply.body.toLowerCase().includes(needle);
};

type Props = {
  replies: SupportCannedReply[];
  context: CannedReplyContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (text: string) => void;
};

/**
 * A searchable list of canned replies with a preview of each, opened from the
 * composer toolbar or by typing "/" in an empty reply. Arrow keys move,
 * Enter inserts, Escape closes.
 */
export default function CannedReplyPicker({ replies, context, open, onOpenChange, onInsert }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(
    () => [...replies].sort((a, b) => a.title.localeCompare(b.title)).filter((reply) => matchesCannedReply(reply, query)),
    [replies, query],
  );

  useEffect(() => {
    if (!open) return;
    const focus = setTimeout(() => searchRef.current?.focus(), 0);
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      clearTimeout(focus);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onOpenChange]);

  const close = () => {
    setQuery("");
    setActive(0);
    onOpenChange(false);
  };

  const choose = (reply: SupportCannedReply | undefined) => {
    if (!reply) return;
    onInsert(fillCannedReply(reply.body, context));
    close();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : onOpenChange(true))}
        aria-expanded={open}
        aria-controls={listId}
        title="Insert a canned reply (or type / in an empty reply)"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-[#142a37] dark:hover:text-slate-100"
      >
        <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
        Canned replies
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-30 mb-2 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-[#283c4a] dark:bg-[#0d1d28]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-[#203541]">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((index) => Math.min(index + 1, results.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((index) => Math.max(index - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  choose(results[active]);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                }
              }}
              placeholder="Search canned replies…"
              aria-label="Search canned replies"
              aria-controls={listId}
              className="h-8 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </div>
          <ul id={listId} role="listbox" aria-label="Canned replies" className="max-h-72 overflow-y-auto py-1">
            {results.length ? (
              results.map((reply, index) => (
                <li key={reply.id} role="option" aria-selected={index === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(reply)}
                    className={`block w-full px-3 py-2 text-left transition ${
                      index === active ? "bg-[#eaf9f8] dark:bg-cyan-950/40" : ""
                    }`}
                  >
                    <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{reply.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500 dark:text-slate-400">
                      {fillCannedReply(reply.body, context)}
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {replies.length ? "No canned reply matches." : "No canned replies yet."}
              </li>
            )}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400 dark:border-[#203541]">
            <span>↑↓ to move · Enter to insert · Esc to close</span>
            <Link href="/support/canned-replies" className="inline-flex items-center gap-1 font-semibold text-[#007f86] hover:underline dark:text-cyan-300">
              <Settings2 className="h-3 w-3" aria-hidden="true" /> Manage
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
