import AdminPageHeader from "@/components/layout/AdminPageHeader";
import { ShieldCheck } from "lucide-react";

export default function SupportAccessHeader() {
  return (
    <AdminPageHeader
      eyebrow="Customer RFPs"
      title="Support access"
      description="Customer organizations whose Owner or Admin has granted RFPilot Support time-limited, read-only access to their RFPs."
      icon={ShieldCheck}
    />
  );
}
