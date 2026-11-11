"use client";

import { activeGrantIdsAction } from "@/app/actions/supportAccess";
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
import { Clock, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

const REVOCATION_CHECK_MS = 30_000;

type GrantWorkspaceProps = {
  organizationId: string;
  organizationName: string | null;
  /** The grants this screen was read under: one for an RFP, one or more for an RFP list. */
  grants: GrantBannerInfo[];
  children: ReactNode;
};

const scopeText = (grants: GrantBannerInfo[]) => {
  if (grants.some((grant) => grant.scope === "organization")) return "Whole organization";
  return grants.length === 1 ? "One RFP" : `${grants.length} RFPs, each granted separately`;
};

/**
 * Wraps every screen that shows a customer organization's RFP data. It states the grant the
 * agent is working under and how long is left, and it takes the content off the screen the
 * moment the grant runs out or is revoked, sending the agent back to "Granted to me".
 */
export default function GrantWorkspace({ organizationId, organizationName, grants, children }: GrantWorkspaceProps) {
  const router = useRouter();
  const signature = grants.map((grant) => `${grant.id}:${grant.expiresAt}:${grant.secondsRemaining}`).join("|");
  const [clock, setClock] = useState({ signature, elapsed: 0 });
  const [revoked, setRevoked] = useState<string | null>(null);
  const refreshedFor = useRef<string | null>(null);

  // Time left counts down from what the server reported when it read the grant.
  useEffect(() => {
    const startedAt = Date.now();
    const tick = () => setClock({ signature, elapsed: Math.floor((Date.now() - startedAt) / 1000) });
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [signature]);

  const elapsed = clock.signature === signature ? clock.elapsed : 0;
  const remaining = grants.map((grant) => Math.max(0, grant.secondsRemaining - elapsed));
  const longest = remaining.length ? Math.max(...remaining) : 0;
  const soonest = remaining.length ? Math.min(...remaining) : 0;
  const ended = longest <= 0 || revoked === signature;
  const partlyEnded = !ended && soonest <= 0;

  // Revocation: ask which grants are still active (grant details only, so no RFP is re-read).
  useEffect(() => {
    let cancelled = false;
    const shown = signature.split("|").map((entry) => entry.split(":")[0]);
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const active = await activeGrantIdsAction(organizationId).catch(() => null);
      if (cancelled || active === null) return;
      if (active.length === 0) {
        setRevoked(signature);
      } else if (shown.some((id) => !active.includes(id)) && refreshedFor.current !== signature) {
        // Another grant may still cover this screen: let the server decide.
        refreshedFor.current = signature;
        router.refresh();
      }
    };
    const timer = window.setInterval(check, REVOCATION_CHECK_MS);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [organizationId, router, signature]);

  useEffect(() => {
    if (ended) {
      router.replace(accessEndedPath());
    } else if (partlyEnded && refreshedFor.current !== signature) {
      refreshedFor.current = signature;
      router.refresh();
    }
  }, [ended, partlyEnded, router, signature]);

  if (ended) {
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
          <p className={`inline-flex items-center gap-1.5 text-sm font-bold tabular-nums ${endingSoon ? "text-amber-700 dark:text-amber-300" : "text-[#12213a]"}`}>
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
