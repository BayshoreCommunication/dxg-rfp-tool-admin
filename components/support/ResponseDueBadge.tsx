"use client";

import { AlarmClock } from "lucide-react";
import { useEffect, useState } from "react";
import { responseDue, responseDueClass } from "./supportLabels";

/**
 * "Reply due in 2h" / "Overdue 25m" against a ticket's response target. The
 * clock starts after hydration and ticks every 30 seconds, so the badge stays
 * right on a page that is left open.
 */
export default function ResponseDueBadge({ dueAt }: { dueAt: string | null | undefined }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!dueAt) return;
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0);
    const timer = setInterval(update, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [dueAt]);

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
