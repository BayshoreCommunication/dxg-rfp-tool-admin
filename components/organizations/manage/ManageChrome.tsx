import { ContentBadge, focusRing } from "@/components/organizations/content/ContentChrome";
import { ORGANIZATIONS_PATH, organizationAccountPath } from "@/lib/organizationAccount";
import { formatContentDate, memberStatusBadge, organizationMembersPath, organizationTeamsPath, rolesLabel, sessionRenewPath, type Member } from "@/lib/organizationContent/content";
import {
  managementFailureCopy,
  memberStanding,
  memberStatusLabel,
  type ManagementFailure,
  type ManagementRefusal,
} from "@/lib/organizationManagement/management";
import { AlertCircle, ArrowLeft, Clock, Eye, FileQuestion, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/* The frame and the states these pages share: one member and one team, each view only, and the
   block and reactivate pages, the one change staff make to a customer organization. They live
   outside the content browser (/organizations/[organizationId]/...), which may hold no control
   at all.

   Every link into an organization page or a management page opts out of prefetch: opening any of
   them is a read recorded on the RFPilot side. The look and the focus outline follow the content
   pages (components/organizations/content/ContentChrome.tsx). No hooks here: the pages render it
   on the server. */

export const linkClass = `text-sm font-bold text-[#007f86] underline-offset-2 hover:underline dark:text-cyan-300 ${focusRing}`;

// 44px tall: these are pressed by touch on a phone as much as by pointer.
export const primaryButton = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#007f86] px-5 text-sm font-bold text-white transition hover:bg-[#006d73] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 ${focusRing}`;
export const dangerButton = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-700 px-5 text-sm font-bold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 ${focusRing}`;
export const secondaryButton = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-[#34445f] transition hover:border-[#00aeb5] hover:text-[#007f86] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;
export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-[#20304b] outline-none transition placeholder:text-slate-400 focus:border-[#00aeb5] focus:ring-4 focus:ring-cyan-500/20 aria-[invalid=true]:border-rose-500";
export const cardClass = "rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]";
const backClass = `inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-slate-600 transition hover:text-[#007f86] dark:hover:text-cyan-300 ${focusRing}`;

/** Said on the block and reactivate pages, the only pages here that change anything. */
export const ManagementNote = () => (
  <p className="flex items-start gap-2 text-xs leading-5 text-slate-600">
    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <span>
      Staff management. Every change here needs a written reason and is recorded on the RFPilot side, as is each page you open; the
      organization sees the result, not who made it. Proposals, templates and vendors can&apos;t be changed from here.
    </span>
  </p>
);

/** Said on the member page and the team page: nothing on them changes anything. */
export const ViewOnlyNote = () => (
  <p className="flex items-start gap-2 text-xs leading-5 text-slate-600">
    <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <span>
      View only. Members, teams, proposals, templates and vendors can&apos;t be changed from here. Each page you open is recorded on the
      RFPilot side.
    </span>
  </p>
);

/** The page width and the ways back: the organization and its Members page; from a team page
    the Teams list too. */
export const ManageFrame = ({
  organizationId,
  teams = false,
  viewOnly = false,
  children,
}: {
  /** Null when the address does not name an organization: the way back is the list. */
  organizationId: string | null;
  /** Set on the team page: the Teams list is a way back too. */
  teams?: boolean;
  /** Set on the member page and the team page, which change nothing and say so. */
  viewOnly?: boolean;
  children: ReactNode;
}) => (
  <div className="mx-auto w-full max-w-[1100px] space-y-5 pb-10">
    {organizationId ? (
      <>
        <nav aria-label="Back" className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Link href={organizationAccountPath(organizationId)} prefetch={false} className={backClass}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Organization
          </Link>
          <Link href={organizationMembersPath(organizationId)} prefetch={false} className={backClass}>
            Members
          </Link>
          {teams ? (
            <Link href={organizationTeamsPath(organizationId)} prefetch={false} className={backClass}>
              Teams
            </Link>
          ) : null}
        </nav>
        {viewOnly ? <ViewOnlyNote /> : <ManagementNote />}
      </>
    ) : (
      <Link href={ORGANIZATIONS_PATH} className={backClass}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Organizations
      </Link>
    )}
    {children}
  </div>
);

/** The backend's code beside the wording, as an identifier. Never its message. */
export const RefusalCode = ({ code }: { code: string | null }) =>
  code ? (
    <p className="mt-1 text-xs">
      Code: <span className="break-all font-mono">{code}</span>
    </p>
  ) : null;

// Waiting is all these ask for.
const WAIT: ManagementFailure[] = ["rate_limited", "not_available"];
// Asking again can help without anything else being done first.
const RETRY: ManagementFailure[] = ["rate_limited", "unavailable"];

/** A whole-page refusal: a page that could not be shown at all. */
export const ManageFailureState = ({
  refusal,
  retryHref,
  viewOnly = false,
}: {
  refusal: ManagementRefusal;
  /** Set on the member page and the team page: the wording is of a view, not of a change. */
  viewOnly?: boolean;
  /** This same page: where "Try again" leads, and where signing in again returns to. */
  retryHref?: string;
}) => {
  const { title, message, tone } = managementFailureCopy(refusal, viewOnly ? "view" : "change");
  const calm = tone === "calm";
  const Icon = WAIT.includes(refusal.failure) ? Clock : calm ? FileQuestion : AlertCircle;
  return (
    <section className={`flex min-h-[40vh] flex-col items-center justify-center px-6 py-12 text-center ${cardClass}`} role={calm ? "status" : "alert"}>
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${calm ? "bg-slate-100 text-slate-600" : "bg-rose-50 text-rose-600"}`}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className={`mt-4 text-base font-bold ${calm ? "text-[#12213a]" : "text-rose-700"}`}>{title}</h1>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">{message}</p>
      <div className="text-slate-600">
        <RefusalCode code={refusal.code} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <Link href={ORGANIZATIONS_PATH} className={linkClass}>
          Back to Organizations
        </Link>
        {refusal.failure === "session_ended" ? (
          <Link href={sessionRenewPath(retryHref)} prefetch={false} className={linkClass}>
            Sign in
          </Link>
        ) : null}
        {retryHref && RETRY.includes(refusal.failure) ? (
          <Link href={retryHref} prefetch={false} className={linkClass}>
            Try again
          </Link>
        ) : null}
      </div>
    </section>
  );
};

/** A refusal shown inside a page that is otherwise there: above a confirmation, beside a control. */
export const RefusalNote = ({ refusal, children }: { refusal: ManagementRefusal; children?: ReactNode }) => {
  const { title, message, tone } = managementFailureCopy(refusal);
  const calm = tone === "calm";
  return (
    <div role="alert" className={`rounded-xl border px-4 py-3 text-sm leading-6 ${calm ? "border-amber-200 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
      <p className="font-bold">{title}</p>
      <p>{message}</p>
      <RefusalCode code={refusal.code} />
      {children ? <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">{children}</div> : null}
    </div>
  );
};

/** A page that is there, but has nothing to offer for this state: a calm note and the way on. */
export const NotOfferedState = ({ title, message, children }: { title: string; message: string; children?: ReactNode }) => (
  <section className={`px-5 py-6 sm:px-6 ${cardClass}`} role="status">
    <h2 className="text-base font-bold text-[#12213a]">{title}</h2>
    <p className="mt-1 text-sm leading-6 text-slate-600">{message}</p>
    {children ? <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">{children}</div> : null}
  </section>
);

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid gap-0.5 py-2.5 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
    <dt className="text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500 sm:pt-0.5">{label}</dt>
    <dd className="min-w-0 break-words text-sm text-[#20304b]">{children}</dd>
  </div>
);

/** The member as the API returned it. */
export const MemberSummary = ({ member, eyebrow }: { member: Member; eyebrow: string }) => {
  // The stored status of a deactivated member is `suspended`: it is shown as Deactivated.
  const standing = memberStanding(member.status);
  const badge = standing === "other" ? memberStatusBadge(member.status) : { label: memberStatusLabel(member.status), tone: memberStatusBadge(standing).tone };
  return (
    <section className={`px-5 py-5 sm:px-6 ${cardClass}`} aria-label="Member">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#007f86]">{eyebrow}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h1 className="min-w-0 break-words text-2xl font-extrabold tracking-[-0.03em] text-[#12213a]">{member.name ?? member.email ?? "Member with no name on file"}</h1>
        <ContentBadge tone={badge.tone}>{badge.label}</ContentBadge>
      </div>
      <dl className="mt-3 divide-y divide-slate-100">
        <Fact label="Email">
          <span className="break-all">{member.email ?? "Not on file"}</span>
        </Fact>
        <Fact label="Role">{rolesLabel(member.roles)}</Fact>
        <Fact label="Teams">
          {member.teams.length
            ? member.teams.map((team) => `${team.name}${team.isManager ? " (manager)" : ""}${team.archived ? " (archived)" : ""}`).join(", ")
            : "No team"}
        </Fact>
        <Fact label="Joined">{formatContentDate(member.joinedAt)}</Fact>
        <Fact label="Last sign-in">{member.lastSignedInAt ? formatContentDate(member.lastSignedInAt) : "Never"}</Fact>
      </dl>
    </section>
  );
};

export const ManageSkeleton = ({ label }: { label: string }) => (
  <div className="mx-auto w-full max-w-[1100px] space-y-5" aria-busy="true" aria-label={label} role="status">
    <div className="h-5 w-56 animate-pulse rounded bg-slate-200" />
    <div className="h-40 animate-pulse rounded-2xl border border-[#dce5ee] bg-white" />
    <div className="h-72 animate-pulse rounded-2xl border border-[#dce5ee] bg-white" />
  </div>
);
