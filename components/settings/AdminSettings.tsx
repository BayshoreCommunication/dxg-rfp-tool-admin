import { ExternalLink } from "lucide-react";

const AdminSettings = () => {
  return (
    <div className="bg-white p-8 font-sans w-full">
      {/* Top Header Section */}
      <div className="flex items-center gap-6 mb-6">
        <div className="w-20 h-20 bg-[#e2e2e2] rounded-full flex items-center justify-center font-bold text-black text-lg shadow-sm shrink-0">
          Logo
        </div>
        <div>
          <h2 className="text-[20px] font-bold flex items-center gap-2 text-gray-900">
            Company Name <ExternalLink className="w-[18px] h-[18px] text-gray-800 cursor-pointer" />
          </h2>
          <p className="text-[13px] text-gray-800 mt-1 font-medium">
            Smart Plan Smart Business
          </p>
        </div>
      </div>


      {/* Change Password Section */}
      <div className="mb-10">
        <h3 className="text-[17px] font-bold text-gray-900 mb-8 tracking-tight">
          Change Your Password
        </h3>

        <div className="flex flex-col gap-6 max-w-xl">
          <div className="flex items-center gap-6">
            <label className="w-[140px] text-[13px] font-bold text-gray-600">
              New Password:
            </label>
            <input
              type="password"
              defaultValue="********"
              className="w-[300px] border border-gray-200 rounded-md px-4 py-2 bg-[#f4f5f7] text-[15px] font-bold outline-none placeholder:text-gray-900 focus:border-gray-400 transition-all tracking-widest text-black"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="w-[140px] text-[13px] font-bold text-gray-600">
              Confirm Password:
            </label>
            <input
              type="password"
              defaultValue="********"
              className="w-[300px] border border-gray-200 rounded-md px-4 py-2 bg-[#f4f5f7] text-[15px] font-bold outline-none placeholder:text-gray-900 focus:border-gray-400 transition-all tracking-widest text-black"
            />
          </div>
        </div>
      </div>

      
    </div>
  );
};

export default AdminSettings;