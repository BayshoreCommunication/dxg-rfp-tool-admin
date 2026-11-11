import AdminPageHeader from "@/components/layout/AdminPageHeader";
import { Building2 } from "lucide-react";

export default function TopHeader() {
  return (
    <AdminPageHeader
      eyebrow="Plans"
      title="Organizations"
      description="See each customer organization's plan and how many RFPs it has created, and change the plan."
      icon={Building2}
    />
  );
}
