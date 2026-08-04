import AdminPageHeader from "@/components/layout/AdminPageHeader";
import { UsersRound } from "lucide-react";

export default function TopHeader() {
  return (
    <AdminPageHeader
      eyebrow="Access management"
      title="Admin users"
      description="Create and maintain the accounts that can operate this admin workspace."
      icon={UsersRound}
    />
  );
}
