import { redirect } from "next/navigation";

import { supportAccessRedirect } from "@/lib/organizationContent/content";

// The grant workspace is gone (owner decision, 2026-11-17): this old address goes to its place
// in the organization content browser. Nothing is read to decide.
export default async function SupportAccessOrganizationRedirect({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  redirect(supportAccessRedirect({ organizationId }));
}
