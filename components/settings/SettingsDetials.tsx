import { getAdminUserProfileAction } from "@/app/actions/adminUser";
import AdminSettings from "./AdminSettings";
import TopHeader from "./TopHeaser";

const SettingsDetials = async () => {
  const response = await getAdminUserProfileAction();

  return (
    <div className="space-y-8 px-6">
      <TopHeader />
      <AdminSettings profile={response.data} loadError={response.error} />
    </div>
  );
};

export default SettingsDetials;
