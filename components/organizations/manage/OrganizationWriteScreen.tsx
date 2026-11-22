import { getManagedOrganizationAction } from "@/app/actions/organizationManagement";
import { cardClass, linkClass, ManageFailureState, ManageFrame, NotOfferedState } from "@/components/organizations/manage/ManageChrome";
import WriteFlow from "@/components/organizations/manage/WriteFlow";
import { organizationAccountPath } from "@/lib/organizationAccount";
import {
  blockedSinceLabel,
  isManagementId,
  loadOrganizationWritePage,
  organizationLabel,
  organizationWritePath,
  WRITE_COPY,
  type OrganizationWrite,
} from "@/lib/organizationManagement/management";
import Link from "next/link";

/* The block page and the reactivate page: the organization, read once, and the flow. What is
   shown of the organization is its name, whether it is blocked and since when. */
export default async function OrganizationWriteScreen({ organizationId, write }: { organizationId: string; write: OrganizationWrite }) {
  const load = await loadOrganizationWritePage({ organization: getManagedOrganizationAction }, organizationId, write);
  const known = isManagementId(organizationId) ? organizationId : null;

  if (load.state === "failed") {
    return (
      <ManageFrame organizationId={known}>
        <ManageFailureState refusal={load.refusal} retryHref={known ? organizationWritePath(known, write) : undefined} />
      </ManageFrame>
    );
  }
  const { organization } = load;
  return (
    <ManageFrame organizationId={known}>
      <section className={`px-5 py-5 sm:px-6 ${cardClass}`} aria-label="Organization">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#007f86]">{WRITE_COPY[write].title}</p>
        <h1 className="mt-1 break-words text-2xl font-extrabold tracking-[-0.03em] text-[#12213a]">{organizationLabel(organization)}</h1>
        <p className="mt-1 text-sm text-slate-600">{organization.blocked ? `${blockedSinceLabel(organization.blocked)}.` : "Not blocked."}</p>
      </section>
      {load.state === "not_offered" ? (
        <NotOfferedState
          title={write === "block" ? "This organization can't be blocked from here" : "This organization is not blocked"}
          message={
            write === "unblock"
              ? "There is nothing to reactivate."
              : organization.blocked
                ? "It is already blocked."
                : "Only a customer organization can be blocked: not RFPilot's own organization, and not one that is awaiting placement."
          }
        >
          <Link href={organizationAccountPath(organization.id)} prefetch={false} className={linkClass}>
            Back to the organization
          </Link>
        </NotOfferedState>
      ) : (
        <WriteFlow kind={write} organization={organization} />
      )}
    </ManageFrame>
  );
}
