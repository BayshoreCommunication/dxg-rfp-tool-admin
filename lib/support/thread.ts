import type { SupportMessage } from "@/app/actions/supportDesk";

// Consecutive messages from the same author within this window read as one
// burst: one avatar and name, tighter spacing.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

export type ThreadItem =
  | { type: "day"; key: string; label: string }
  | { type: "event"; key: string; message: SupportMessage }
  | { type: "message"; key: string; message: SupportMessage; startsGroup: boolean; endsGroup: boolean };

/** The automatic acknowledgement the backend posts on every new ticket. */
export const isAutomaticReply = (message: SupportMessage) =>
  message.kind === "message" && message.authorRole === "system";

/** Status changes and automatic triage notes render as compact centred lines. */
export const isEvent = (message: SupportMessage) =>
  message.kind === "system" || (message.kind === "internal_note" && message.authorRole === "system");

/** Agents, automatic replies and notes are DXG's side of the conversation. */
export const isDxgSide = (message: SupportMessage) =>
  message.authorRole !== "customer" || message.kind === "internal_note";

const speaker = (message: SupportMessage) =>
  isAutomaticReply(message)
    ? "automatic"
    : `${message.kind === "internal_note" ? "note" : message.authorRole}:${message.authorUserId ?? ""}`;

const toDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

export const dayLabel = (date: Date, now: Date): string => {
  if (sameDay(date, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(
    "en-US",
    date.getFullYear() === now.getFullYear()
      ? { weekday: "long", month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" },
  );
};

export const timeLabel = (value: string): string => {
  const date = toDate(value);
  return date ? date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
};

export const initials = (name: string | null | undefined): string => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

/**
 * Turns a flat message list into chat rows: a day separator whenever the
 * local day changes, status and triage events as their own rows, and messages
 * flagged with where each same-author burst starts and ends. `now` is null
 * before hydration so the server and the first client render agree.
 */
export const buildThreadItems = (messages: SupportMessage[], now: Date | null): ThreadItem[] => {
  const items: ThreadItem[] = [];
  let lastDay: string | null = null;

  const continues = (a: SupportMessage | undefined, b: SupportMessage | undefined) => {
    if (!a || !b || isEvent(a) || isEvent(b) || speaker(a) !== speaker(b)) return false;
    const first = toDate(a.createdAt);
    const second = toDate(b.createdAt);
    if (!first || !second) return false;
    if (now && !sameDay(first, second)) return false;
    return Math.abs(second.getTime() - first.getTime()) <= GROUP_WINDOW_MS;
  };

  messages.forEach((message, index) => {
    const date = toDate(message.createdAt);
    if (now && date && dayKey(date) !== lastDay) {
      lastDay = dayKey(date);
      items.push({ type: "day", key: `day-${lastDay}`, label: dayLabel(date, now) });
    }
    if (isEvent(message)) {
      items.push({ type: "event", key: message.id, message });
      return;
    }
    items.push({
      type: "message",
      key: message.id,
      message,
      startsGroup: !continues(messages[index - 1], message),
      endsGroup: !continues(message, messages[index + 1]),
    });
  });

  return items;
};
