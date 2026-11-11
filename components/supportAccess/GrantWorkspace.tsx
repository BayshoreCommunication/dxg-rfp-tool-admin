"use client";

import {
  ACCESS_NOTICES,
  SUPPORT_ACCESS_PATH,
  accessEndedPath,
  formatGrantExpiry,
  formatTimeLeft,
  isGrantEndingSoon,
  organizationLabel,
  type GrantBannerInfo,
} from "@/lib/supportAccess/grants";
import {
  RECHECK_MS,
  REVOCATION_CHECK_MS,
  checkGrants,
  isFreshRender,
  screenState,
  secondsRemainingAt,
  type GrantCheck,
} from "@/lib/supportAccess/grantSession";
import { Clock, LoaderCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

type GrantWorkspaceProps = {
  organizationId: string;
  organizationName: string | null;
  /** The grants this screen was read under: one for an RFP, one or more for an RFP list. */
  grants: GrantBannerInfo[];
  /** When the server read them (epoch ms). */
  readAt: number;
  children: ReactNode;
};

const scopeText = (grants: GrantBannerInfo[]) => {
  if (grants.some((grant) => grant.scope === "organization")) return "Whole organization";
  return grants.length === 1 ? "One RFP" : `${grants.length} RFPs, each granted separately`;
};

/** The organization's active grant ids, or null when that can't be told. Reads no RFP. */
const fetchActiveGrantIds = async (organizationId: string): Promise<string[] | null> => {
  try {
    const response = await fetch(`/api/support-access/active?organizationId=${organizationId}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { active?: unknown };
    return Array.isArray(body.active) && body.active.every((id) => typeof id === "string") ? (body.active as string[]) : null;
  } catch {
    return null;
  }
};

/**
 * Wraps every screen that shows a customer organization's RFP data. It states the grant the
 * agent is working under and how long is left. The content is on screen only while that grant
 * is confirmed active: a screen restored from cache is checked before anything is shown, and
 * the content comes off the moment the grant runs out or is revoked. When the organization
 * has no grant left the agent goes back to "Granted to me"; when another grant may still
 * cover the screen, the server reads it again and decides.
 */
export default function GrantWorkspace({ organizationId, organizationName, grants, readAt, children }: GrantWorkspaceProps) {
  const router = useRouter();
  const signature = `${readAt}|${grants.map((grant) => `${grant.id}@${grant.expiresAt}@${grant.secondsRemaining}`).join("|")}`;
  const [now, setNow] = useState(() => Date.now());
  const [checked, setChecked] = useState<{ signature: string; result: GrantCheck }>({ signature: "", result: "unknown" });
  const rereadFor = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = secondsRemainingAt(grants, readAt, now);
  const soonest = remaining.length ? Math.min(...remaining) : 0;
  const expired = soonest <= 0;
  // A screen the server rendered just now was read under a live grant. One that came back
  // from the router or browser cache has to be confirmed first.
  const lastCheck: GrantCheck | "pending" =
    checked.signature === signature ? checked.result : isFreshRender(readAt, now) ? "active" : "pending";
  const state = screenState({ remaining, lastCheck });
  const urgent = state === "checking";

  useEffect(() => {
    let cancelled = false;
    const shown = grants.map((grant) => grant.id);
    const check = async () => {
      if (!urgent && document.visibilityState !== "visible") return;
      const active = await fetchActiveGrantIds(organizationId);
      if (!cancelled) setChecked({ signature, result: checkGrants(shown, active) });
    };
    const first = urgent ? window.setTimeout(check, 0) : undefined;
    const timer = window.setInterval(check, urgent ? RECHECK_MS : REVOCATION_CHECK_MS);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
    // `grants` is covered by `signature`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, signature, urgent]);

  // Other grants remain (or this one only ran out here): the server reads again and decides.
  const reread = lastCheck === "reread" || (expired && lastCheck === "active");
  useEffect(() => {
    if (state === "ended") {
      router.replace(accessEndedPath());
    } else if (reread && rereadFor.current !== signature) {
      rereadFor.current = signature;
      router.refresh();
    }
  }, [reread, router, signature, state]);

  if (state === "checking") {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center text-center" role="status">
        <LoaderCircle className="h-6 w-6 animate-spin text-[#008f96]" aria-hidden="true" />
        <p className="mt-4 text-sm font-bold text-[#12213a]">Checking support access</p>
        <p className="mt-1 text-sm text-slate-500">
          This organization&apos;s RFPs stay hidden until its grant to RFPilot Support is confirmed as still active.
        </p>
        <Link href={SUPPORT_ACCESS_PATH} className="mt-4 text-sm font-semibold text-[#008f96] hover:underline">
          Back to Granted to me
        </Link>
      </div>
    );
  }

  if (state === "ended") {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center text-center" role="alert">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm font-bold text-[#12213a]">Support access has ended</p>
        <p className="mt-1 text-sm text-slate-500">{ACCESS_NOTICES.ended}</p>
        <Link href={SUPPORT_ACCESS_PATH} className="mt-4 text-sm font-semibold text-[#008f96] hover:underline">
          Back to Granted to me
        </Link>
      </div>
    );
  }

  const endingSoon = isGrantEndingSoon(soonest);
  const first = grants[remaining.indexOf(soonest)] ?? grants[0];
  const tone = endingSoon
    ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/50"
    : "border-[#aee9e8] bg-[#eaf9f8]";

  return (
    <>
      <section
        aria-label="Support access grant"
        data-testid="grant-banner"
        className={`flex flex-col gap-3 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${tone}`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className={`mt-0.5 shrink-0 ${endingSoon ? "text-amber-600 dark:text-amber-300" : "text-[#008f96]"}`}>
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#12213a]">
              Support access to <span className="break-words">{organizationLabel(organizationName)}</span>
            </p>
            <p className="mt-0.5 text-[13px] text-slate-600">
              <span className="font-semibold">Scope:</span> {scopeText(grants)}. Read-only, and every RFP you open is recorded in this
              organization&apos;s audit log.
            </p>
          </div>
        </div>
        <div className="shrink-0 sm:text-right">
          <p suppressHydrationWarning className={`inline-flex items-center gap-1.5 text-sm font-bold tabular-nums ${endingSoon ? "text-amber-700 dark:text-amber-300" : "text-[#12213a]"}`}>
            <Clock className="h-4 w-4" aria-hidden="true" />
            {grants.length > 1 ? "First grant ends in " : "Time left: "}
            {formatTimeLeft(soonest)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Ends {formatGrantExpiry(first?.expiresAt ?? null)}</p>
        </div>
      </section>
      {children}
    </>
  );
}
