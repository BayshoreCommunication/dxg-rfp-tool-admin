import { redirect } from "next/navigation";

import { SUPPORT_ACCESS_PATH } from "@/lib/supportAccess/grants";

// ORG-406: the all-organization RFP directory is gone. A customer organization's RFPs are
// reachable only through a support access grant, so old links land on "Granted to me".
export default function LegacyRfpDirectoryPage() {
  redirect(SUPPORT_ACCESS_PATH);
}
