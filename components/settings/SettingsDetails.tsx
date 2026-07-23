import { getAdminUserProfileAction } from "@/app/actions/adminUser";
import AdminSettings from "./AdminSettings";
import TopHeader from "./TopHeaser";

const SettingsDetails = async () => {
  const response = await getAdminUserProfileAction();

  return (
    <div className="mx-auto w-full max-w-[1540px] space-y-6">
      <TopHeader />
      <AdminSettings
        key={`${response.data?._id || "admin"}-${response.data?.updatedAt || "current"}`}
        profile={response.data}
        loadError={response.error}
      />
    </div>
  );
};

export default SettingsDetails;
