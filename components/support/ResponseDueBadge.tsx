"use client";

import { AlarmClock, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { closesIn, responseDue, responseDueClass } from "./supportLabels";

/**
 * "Reply due in 2h" / "Overdue 25m" against a ticket's response target. The
 * clock starts after hydration and ticks every 30 seconds, so the badge stays
 * right on a page that is left open.
 */
export default function ResponseDueBadge({
  dueAt,
  resolvedAt,
}: {
  dueAt: string | null | undefined;
  /** For a resolved ticket: shows when it closes for good instead. */
  resolvedAt?: string | null;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!dueAt && !resolvedAt) return;
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0);
    const timer = setInterval(update, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [dueAt, resolvedAt]);

  if (now !== null && resolvedAt) {
    const label = closesIn(resolvedAt, now);
    if (label) {
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          title="Resolved: the customer can still reply to reopen it until then"
        >
          <Timer className="h-3 w-3" aria-hidden="true" />
          {label}
        </span>
      );
    }
  }
  const due = now === null ? null : responseDue(dueAt, now);
  if (!due) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${responseDueClass(due.tone)}`}
    >
      <AlarmClock className="h-3 w-3" aria-hidden="true" />
      {due.label}
    </span>
  );
}
