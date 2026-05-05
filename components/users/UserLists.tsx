import { getAdminUsersListAction } from "@/app/actions/adminUser";
import { auth } from "@/auth";
import { Calendar, Mail, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import AdminUserFormModal from "./AdminUserFormModal";
import DeleteAdminUserButton from "./DeleteAdminUserButton";

const formatDate = (isoDate?: string) => {
  if (!isoDate) return "N/A";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const generateGradient = (name: string) => {
  const colors = [
    "from-violet-400 to-purple-500",
    "from-blue-400 to-indigo-500",
    "from-emerald-400 to-teal-500",
    "from-amber-400 to-orange-500",
    "from-rose-400 to-red-500",
    "from-cyan-400 to-blue-500",
  ];
  return colors[(name?.charCodeAt(0) || 0) % colors.length];
};

const RoleBadge = ({ role }: { role?: string }) => {
  const normalized = (role || "").toLowerCase().replace(/[\s-]/g, "_");
  const isSuperAdmin = normalized === "super_admin" || normalized === "superadmin";
  return isSuperAdmin ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
      <ShieldCheck size={10} />
      Super Admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
      <ShieldAlert size={10} />
      Admin
    </span>
  );
};

export const UserListsSkeleton = () => (
  <div className="bg-white rounded-xl p-5 sm:p-6 shadow border border-slate-100 mt-6">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 animate-pulse" />
        <div className="w-32 h-5 rounded bg-slate-200 animate-pulse" />
      </div>
      <div className="w-28 h-9 rounded-lg bg-slate-100 animate-pulse" />
    </div>
    <div className="w-full overflow-hidden rounded-xl border border-slate-100">
      <table className="w-full text-left border-collapse whitespace-nowrap">
        <thead>
          <tr className="bg-slate-50/80 border-b border-slate-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <th key={i} className="px-4 py-3">
                <div className="w-20 h-3 bg-slate-200 rounded animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {[1, 2, 3].map((row) => (
            <tr key={row} className="bg-white">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-200 animate-pulse" />
                  <div className="w-28 h-4 rounded bg-slate-200 animate-pulse" />
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="w-36 h-4 rounded bg-slate-200 animate-pulse" />
              </td>
              <td className="px-4 py-3">
                <div className="w-20 h-5 rounded-full bg-slate-100 animate-pulse" />
              </td>
              <td className="px-4 py-3">
                <div className="w-24 h-4 rounded bg-slate-200 animate-pulse" />
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2 justify-center">
                  <div className="w-14 h-7 rounded-lg bg-slate-100 animate-pulse" />
                  <div className="w-14 h-7 rounded-lg bg-slate-100 animate-pulse" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const UserLists = async () => {
  const session = await auth();
  const sessionRole = (session?.user?.role || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]/g, "_");
  const isSuperAdmin =
    sessionRole === "super_admin" || sessionRole === "superadmin";
  const currentUserId =
    (session?.user as { _id?: string })?._id || session?.user?.id || "";

  if (!isSuperAdmin) {
    return (
      <div className="bg-white rounded-xl p-10 shadow border border-slate-100 mt-6 flex flex-col items-center justify-center gap-2">
        <ShieldAlert className="w-10 h-10 text-slate-200" />
        <p className="text-sm font-medium text-slate-500">
          Only super admins can manage admin users.
        </p>
      </div>
    );
  }

  const response = await getAdminUsersListAction();
  const users = (response.data || []).filter(
    (u) => u._id !== currentUserId,
  );

  return (
    <div className="bg-white rounded-xl p-5 sm:p-6 shadow border border-slate-100 mt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-50 rounded-xl">
            <Users className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Admin Users
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage admin and super admin accounts
            </p>
          </div>
        </div>
        <AdminUserFormModal mode="create" />
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
              <th className="px-4 py-3 text-xs font-bold text-slate-500 tracking-wider uppercase">
                User
              </th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 tracking-wider uppercase">
                Email
              </th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 tracking-wider uppercase">
                Role
              </th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 tracking-wider uppercase">
                Joined
              </th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 tracking-wider uppercase text-center">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!response.ok ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <p className="text-sm font-medium text-rose-500 bg-rose-50 inline-block px-4 py-2 rounded-lg border border-rose-100">
                    {response.error || "Failed to load admin users."}
                  </p>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Users className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-500">
                    No admin users found.
                  </p>
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user._id}
                  className="group hover:bg-slate-50/50 transition-colors duration-150"
                >
                  {/* User */}
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br ${generateGradient(user.name)} text-sm font-bold text-white shadow-sm ring-2 ring-white`}
                      >
                        {user.name?.charAt(0)?.toUpperCase() || "A"}
                      </div>
                      <span className="text-sm font-semibold text-slate-900 group-hover:text-violet-700 transition-colors">
                        {user.name}
                      </span>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm font-medium">{user.email}</span>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3 align-middle">
                    <RoleBadge role={user.role} />
                  </td>

                  {/* Joined */}
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm font-medium">
                        {formatDate(user.createdAt)}
                      </span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-center align-middle">
                    <div className="flex items-center justify-center gap-2">
                      <AdminUserFormModal mode="edit" user={user} />
                      <DeleteAdminUserButton userId={user._id} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserLists;
