import { redirect } from "next/navigation";

import { SUPPORT_ACCESS_PATH } from "@/lib/supportAccess/grants";

// ORG-406: an RFP is opened from the organization that granted access to it, never by id alone.
export default function LegacyRfpPage() {
  redirect(SUPPORT_ACCESS_PATH);
}
