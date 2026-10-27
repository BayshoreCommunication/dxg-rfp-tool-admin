import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/app/actions/supportDesk";

export const STATUS_OPTIONS: ReadonlyArray<{ value: SupportTicketStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "waiting_on_customer", label: "Waiting on customer" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export const PRIORITY_OPTIONS: ReadonlyArray<{ value: SupportTicketPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export const CATEGORY_OPTIONS: ReadonlyArray<{ value: SupportTicketCategory; label: string }> = [
  { value: "how_to", label: "How-to" },
  { value: "bug", label: "Bug" },
  { value: "billing", label: "Account & sign-in" },
  { value: "feature_request", label: "Feature request" },
  { value: "vendor_email", label: "Vendor / email" },
  { value: "other", label: "Other" },
];

export const statusLabel = (status: SupportTicketStatus): string =>
  STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
export const priorityLabel = (priority: SupportTicketPriority): string =>
  PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? priority;
export const categoryLabel = (category: SupportTicketCategory): string =>
  CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;

export const statusClass = (status: SupportTicketStatus): string => {
  switch (status) {
    case "open":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "waiting_on_customer":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "resolved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "closed":
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

export const priorityClass = (priority: SupportTicketPriority): string => {
  switch (priority) {
    case "urgent":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "high":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "low":
      return "bg-slate-50 text-slate-500 border-slate-200";
    case "normal":
    default:
      return "bg-[#eaf9f8] text-[#0b7f85] border-[#c9efea]";
  }
};

export const formatRelative = (iso: string | null | undefined, now = Date.now()): string => {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "—";
  const diff = Math.max(0, now - then);
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const formatDuration = (ms: number | null): string => {
  if (ms === null || !Number.isFinite(ms)) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
};

const compactDuration = (ms: number): string => {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours}h ${rest}m` : `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
};

/**
 * Where a ticket stands against its response target: overdue, due within
 * 30 minutes ("soon"), or comfortably ahead. Null when no answer is owed.
 */
export const responseDue = (
  dueIso: string | null | undefined,
  now: number,
): { tone: "overdue" | "soon" | "ok"; label: string } | null => {
  if (!dueIso) return null;
  const due = Date.parse(dueIso);
  if (!Number.isFinite(due)) return null;
  const remaining = due - now;
  if (remaining <= 0) return { tone: "overdue", label: `Overdue ${compactDuration(-remaining)}` };
  return { tone: remaining <= 30 * 60_000 ? "soon" : "ok", label: `Reply due in ${compactDuration(remaining)}` };
};

export const responseDueClass = (tone: "overdue" | "soon" | "ok"): string =>
  tone === "overdue"
    ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200"
    : tone === "soon"
      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
      : "border-slate-200 bg-slate-50 text-slate-600 dark:border-[#253746] dark:bg-[#0f2230] dark:text-slate-300";

/** Matches the backend: a resolved ticket closes for good this long after resolving. */
export const RESOLVED_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/** "Closes in 2d 4h" while a resolved ticket is in its reopen window. */
export const closesIn = (resolvedAtIso: string | null | undefined, now: number): string | null => {
  if (!resolvedAtIso) return null;
  const resolvedAt = Date.parse(resolvedAtIso);
  if (!Number.isFinite(resolvedAt)) return null;
  const remaining = resolvedAt + RESOLVED_GRACE_MS - now;
  return remaining > 0 ? `Closes in ${compactDuration(remaining)}` : "Closing soon";
};
