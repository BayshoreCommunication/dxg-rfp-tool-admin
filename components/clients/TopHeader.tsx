import AdminPageHeader from "@/components/layout/AdminPageHeader";
import { UserRound } from "lucide-react";

export default function TopHeader() {
  return (
    <AdminPageHeader
      eyebrow="Client management"
      title="Clients"
      description="Search, review, and manage every client account from one place."
      icon={UserRound}
    />
  );
}
