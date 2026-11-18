import { redirect } from "next/navigation";

import { ORGANIZATIONS_PATH } from "@/lib/organizationAccount";

// The all-organization proposal directory is gone. A proposal is opened from its organization
// (Organizations, then the organization, then Proposals), never by its id alone.
export default function ProposalsRedirect() {
  redirect(ORGANIZATIONS_PATH);
}
