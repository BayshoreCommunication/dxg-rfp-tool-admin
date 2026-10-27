"use client";

import { LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import {
  createCannedReplyAction,
  deleteCannedReplyAction,
  updateCannedReplyAction,
  type SupportCannedReply,
} from "@/app/actions/supportDesk";
import { toast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#00aeb5] focus:ring-2 focus:ring-[#00aeb5]/20 dark:border-[#253746] dark:bg-[#0f2230] dark:text-slate-100";

export default function CannedRepliesManager({ initialReplies }: { initialReplies: SupportCannedReply[] }) {
  const [replies, setReplies] = useState(initialReplies);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SupportCannedReply | null>(null);
  const [isPending, startTransition] = useTransition();

  const create = () => {
    if (!title.trim() || !body.trim()) {
      toast.error("A title and a body are both required.");
      return;
    }
    startTransition(async () => {
      const result = await createCannedReplyAction({ title: title.trim(), body: body.trim() });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setReplies((current) => [...current, result.data].sort((a, b) => a.title.localeCompare(b.title)));
      setTitle("");
      setBody("");
      toast.success("Canned reply saved.");
    });
  };

  const startEdit = (reply: SupportCannedReply) => {
    setEditingId(reply.id);
    setEditTitle(reply.title);
    setEditBody(reply.body);
  };

  const saveEdit = () => {
    if (!editingId) return;
    startTransition(async () => {
      const result = await updateCannedReplyAction(editingId, { title: editTitle.trim(), body: editBody.trim() });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setReplies((current) => current.map((item) => (item.id === editingId ? result.data : item)));
      setEditingId(null);
      toast.success("Canned reply updated.");
    });
  };

  const remove = (reply: SupportCannedReply) => {
    startTransition(async () => {
      const result = await deleteCannedReplyAction(reply.id);
      setPendingDelete(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setReplies((current) => current.filter((item) => item.id !== reply.id));
      toast.success("Canned reply deleted.");
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="space-y-3 rounded-2xl border border-[#dce5ee] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <h2 className="text-sm font-bold text-[#10203a] dark:text-slate-50">New canned reply</h2>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className={`mt-1 ${inputClass}`} placeholder="Password reset steps" />
        </label>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
          Body
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} maxLength={5000} className={`mt-1 ${inputClass}`} placeholder="Hi {{first_name}} — to reset your password, open the sign-in page and choose Forgot password…" />
          <span className="mt-1 block font-normal text-slate-500 dark:text-slate-400">
            Placeholders filled in when inserted: <code>{"{{first_name}}"}</code>, <code>{"{{name}}"}</code>,{" "}
            <code>{"{{ticket_number}}"}</code>, <code>{"{{agent_name}}"}</code> (always “RFPilot support”).
          </span>
        </label>
        <button
          type="button"
          onClick={create}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-[#00a3aa] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#008f95] disabled:opacity-60"
        >
          {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          Save reply
        </button>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        {replies.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No canned replies yet. Save the first one on the left.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {replies.map((reply) => (
              <li key={reply.id} className="px-5 py-4">
                {editingId === reply.id ? (
                  <div className="space-y-2">
                    <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={120} className={inputClass} aria-label="Edit title" />
                    <textarea value={editBody} onChange={(event) => setEditBody(event.target.value)} rows={5} maxLength={5000} className={inputClass} aria-label="Edit body" />
                    <div className="flex gap-2">
                      <button type="button" onClick={saveEdit} disabled={isPending} className="rounded-xl bg-[#00a3aa] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                        Save changes
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">
                        <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-[#10203a] dark:text-slate-50">{reply.title}</h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{reply.body}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => startEdit(reply)} aria-label={`Edit ${reply.title}`} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-[#007f86]">
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => setPendingDelete(reply)} aria-label={`Delete ${reply.title}`} className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.title ?? ""}"?`}
        message="Agents will no longer be able to insert this canned reply."
        busy={isPending}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
