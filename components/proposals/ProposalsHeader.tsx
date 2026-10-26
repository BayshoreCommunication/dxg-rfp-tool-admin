import AdminPageHeader from "@/components/layout/AdminPageHeader";
import { FileText } from "lucide-react";

export default function ProposalsHeader() {
  return (
    <AdminPageHeader
      eyebrow="Proposal oversight"
      title="Proposals"
      description="Every proposal planners have created in RFPilot, with its status and owner."
      icon={FileText}
    />
  );
}
