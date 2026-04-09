import TopHeader from "@/components/settings/TopHeaser";
import { AdminSettingsSkeleton } from "@/components/settings/AdminSettings";

export default function LoadingSettingsPage() {
  return (
    <div className="space-y-8 px-6">
      <TopHeader />
      <AdminSettingsSkeleton />
    </div>
  );
}
