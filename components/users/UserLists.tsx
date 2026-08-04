import {
  getAdminUsersListAction,
  type AdminUserProfile,
} from "@/app/actions/adminUser";
import { auth } from "@/auth";
import {
  AlertCircle,
  CalendarDays,
  Mail,
  ShieldAlert,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
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

const avatarTones = [
  "bg-cyan-50 text-cyan-700",
  "bg-violet-50 text-violet-700",
  "bg-emerald-50 text-emerald-700",
  "bg-amber-50 text-amber-700",
  "bg-sky-50 text-sky-700",
];

const getAvatarTone = (name?: string) =>
  avatarTones[(name?.trim().charCodeAt(0) ?? 0) % avatarTones.length];

const RoleBadge = ({ role }: { role?: string }) => {
  const normalized = (role || "").toLowerCase().replace(/[\s-]/g, "_");
  const isSuperAdmin =
    normalized === "super_admin" || normalized === "superadmin";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
        isSuperAdmin
          ? "bg-violet-50 text-violet-700"
          : "bg-sky-50 text-sky-700"
      }`}
    >
      {isSuperAdmin ? (
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
      ) : (
        <ShieldAlert className="h-3 w-3" aria-hidden="true" />
      )}
      {isSuperAdmin ? "Super Admin" : "Admin"}
    </span>
  );
};

const UserActions = ({ user }: { user: AdminUserProfile }) => (
  <div className="flex items-center justify-end gap-2 lg:justify-center">
    <AdminUserFormModal mode="edit" user={user} />
    <DeleteAdminUserButton userId={user._id} />
  </div>
);

export const UserListsSkeleton = () => (
  <section className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white">
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
      <div className="space-y-2">
        <div className="h-5 w-36 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-64 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-100" />
    </div>
    <div className="space-y-3 p-5">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-16 animate-pulse rounded-xl bg-slate-50"
        />
      ))}
    </div>
  </section>
);

export default async function UserLists() {
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
      <section className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-[#dce5ee] bg-white px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <ShieldAlert className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-[#12213a]">
          Super admin access required
        </h2>
        <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
          Your account can use the admin workspace, but only super admins can
          create, edit, or remove other administrators.
        </p>
      </section>
    );
  }

  const response = await getAdminUsersListAction();
  const users = (response.data || []).filter(
    (user) => user._id !== currentUserId,
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eaf9f8] text-[#00a3aa]">
            <UsersRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-[-0.02em] text-[#12213a]">
                Admin directory
              </h2>
              {response.ok ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                  {users.length} {users.length === 1 ? "user" : "users"}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              Assign the right level of access to each administrator.
            </p>
          </div>
        </div>
        <AdminUserFormModal mode="create" />
      </div>

      {!response.ok ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-rose-700">
            Unable to load admin users
          </p>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            {response.error || "Please try again in a moment."}
          </p>
        </div>
      ) : users.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
            <UsersRound className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-bold text-slate-600">
            No additional admins yet
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Add an admin when another teammate needs workspace access.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden p-4 lg:block sm:p-5">
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full min-w-[800px] table-fixed border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-[#f8fafc]">
                    <th className="w-[24%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
                      User
                    </th>
                    <th className="w-[27%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
                      Email
                    </th>
                    <th className="w-[16%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
                      Role
                    </th>
                    <th className="w-[16%] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
                      Joined
                    </th>
                    <th className="w-[17%] px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.045em] text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr
                      key={user._id}
                      className="group transition-colors hover:bg-[#f8fcfc]"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${getAvatarTone(user.name)}`}
                          >
                            {user.name?.trim().charAt(0).toUpperCase() || "A"}
                          </span>
                          <span className="truncate text-[13px] font-bold text-[#20304b]">
                            {user.name || "Unnamed admin"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <a
                          href={`mailto:${user.email}`}
                          className="block truncate text-[13px] text-slate-500 hover:text-[#008f96]"
                        >
                          {user.email}
                        </a>
                      </td>
                      <td className="px-4 py-3.5">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-4 py-3.5 text-[13px] font-medium text-slate-500">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <UserActions user={user} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="divide-y divide-slate-100 lg:hidden">
            {users.map((user) => (
              <article key={user._id} className="px-5 py-5">
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${getAvatarTone(user.name)}`}
                  >
                    {user.name?.trim().charAt(0).toUpperCase() || "A"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-[#20304b]">
                          {user.name || "Unnamed admin"}
                        </h3>
                        <div className="mt-1">
                          <RoleBadge role={user.role} />
                        </div>
                      </div>
                      <UserActions user={user} />
                    </div>
                    <a
                      href={`mailto:${user.email}`}
                      className="mt-3 flex items-center gap-2 text-xs text-slate-500"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{user.email}</span>
                    </a>
                    <span className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
                      <CalendarDays
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      Joined {formatDate(user.createdAt)}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
