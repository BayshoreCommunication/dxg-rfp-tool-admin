"use client";

import { ArrowUp, CheckCircle2, ChevronDown, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  pending: boolean;
  onSend: () => void;
  onSendAndResolve: () => void;
};

/**
 * Send is the one big target. Resolving sits behind the ▾ next to it, so it
 * always takes a deliberate second click and is never hit by accident.
 */
export default function SendReplyButton({ pending, onSend, onSendAndResolve }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div ref={rootRef} className="relative order-4 inline-flex shrink-0">
      <button
        type="button"
        onClick={onSend}
        disabled={pending}
        aria-label="Send reply"
        title="Send reply and wait for the customer (⌘/Ctrl + Enter)"
        className="inline-flex h-9 items-center gap-1.5 rounded-l-xl bg-[#00a3aa] pl-3 pr-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#008f95] disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">Send</span>
      </button>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        disabled={pending}
        aria-label="More send options"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="inline-flex h-9 w-8 items-center justify-center rounded-r-xl border-l border-white/30 bg-[#00a3aa] text-white shadow-sm transition hover:bg-[#008f95] disabled:opacity-60"
      >
        <ChevronDown className={`h-4 w-4 transition ${menuOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-30 mb-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-[#283c4a] dark:bg-[#0d1d28]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onSendAndResolve();
            }}
            className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
            <span>
              <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">Send &amp; mark resolved</span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                Closes in 3 days unless the customer replies.
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
