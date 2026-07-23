import AdminPageHeader from "@/components/layout/AdminPageHeader";
import { UsersRound } from "lucide-react";

export default function TopHeader() {
  return (
    <AdminPageHeader
      eyebrow="Access management"
      title="Admin users"
      description="Create and maintain the admin accounts that can operate the DXG workspace."
      icon={UsersRound}
    />
  );
}
