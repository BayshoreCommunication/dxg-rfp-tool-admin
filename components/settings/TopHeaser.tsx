import AdminPageHeader from "@/components/layout/AdminPageHeader";
import { Settings2 } from "lucide-react";

export default function TopHeader() {
  return (
    <AdminPageHeader
      eyebrow="Account preferences"
      title="Settings"
      description="Keep your profile details current and secure your administrative access."
      icon={Settings2}
    />
  );
}
