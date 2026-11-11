import type { GrantBannerInfo } from "./grants";

// The rules an open support access screen follows (ORG-406). Pure, so they can be tested:
// the screen itself only renders what these say.

/** A screen rendered longer ago than this came back from the browser's or router's cache. */
export const FRESH_RENDER_MS = 15_000;
export const REVOCATION_CHECK_MS = 30_000;
/** How soon to ask again while the answer is unknown and the content is hidden. */
export const RECHECK_MS = 10_000;

/** When a grant stops working: its expiry instant, or failing that the server's count from when it was read. */
export const grantDeadline = (grant: Pick<GrantBannerInfo, "expiresAt" | "secondsRemaining">, readAt: number): number => {
  const fromCount = readAt + Math.max(0, grant.secondsRemaining) * 1000;
  const fromExpiry = grant.expiresAt ? new Date(grant.expiresAt).getTime() : Number.NaN;
  return Number.isNaN(fromExpiry) ? fromCount : Math.min(fromExpiry, fromCount);
};

/** Seconds left on each grant at `now`. Remounting a cached screen never restarts the count. */
export const secondsRemainingAt = (
  grants: readonly Pick<GrantBannerInfo, "expiresAt" | "secondsRemaining">[],
  readAt: number,
  now: number,
): number[] => grants.map((grant) => Math.max(0, Math.ceil((grantDeadline(grant, readAt) - now) / 1000)));

/** True when the screen was rendered just now, so what it shows was read under a live grant. */
export const isFreshRender = (readAt: number, now: number) => Math.abs(now - readAt) <= FRESH_RENDER_MS;

export type GrantCheck =
  /** Every grant the screen was read under is still active. */
  | "active"
  /** The organization has no active grant left: close the screen and go back to the list. */
  | "ended"
  /** A grant the screen was read under is gone but others remain: the server decides again. */
  | "reread"
  /** Could not be told (offline, signed out, backend down): hide the content until it can. */
  | "unknown";

export const checkGrants = (shownIds: readonly string[], activeIds: readonly string[] | null): GrantCheck => {
  if (activeIds === null) return "unknown";
  if (activeIds.length === 0) return "ended";
  return shownIds.length > 0 && shownIds.every((id) => activeIds.includes(id)) ? "active" : "reread";
};

export type ScreenState = "showing" | "checking" | "ended";

/**
 * What the screen shows. Customer content is on screen only while every grant it was read
 * under still has time left and the last check found them active.
 */
export const screenState = (input: { remaining: readonly number[]; lastCheck: GrantCheck | "pending" }): ScreenState => {
  if (input.lastCheck === "ended") return "ended";
  if (input.remaining.length === 0 || input.remaining.some((seconds) => seconds <= 0)) return "checking";
  return input.lastCheck === "active" ? "showing" : "checking";
};
