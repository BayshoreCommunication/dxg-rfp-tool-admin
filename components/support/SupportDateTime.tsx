"use client";

import { useSyncExternalStore } from "react";
import { formatDateTime, formatRelative } from "./supportLabels";

const subscribe = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** Render local time only after hydration so server and browser markup match. */
export default function SupportDateTime({
  value,
  relative = false,
  fallback = "…",
  className,
}: {
  value: string | null | undefined;
  relative?: boolean;
  fallback?: string;
  className?: string;
}) {
  const hydrated = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const parsed = value ? new Date(value) : null;
  const iso = parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;

  return (
    <time dateTime={iso} className={className}>
      {hydrated ? (relative ? formatRelative(value) : formatDateTime(value)) : fallback}
    </time>
  );
}
