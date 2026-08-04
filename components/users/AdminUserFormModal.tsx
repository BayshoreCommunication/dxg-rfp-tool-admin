"use client";

import {
  type AdminUserProfile,
  type CreateAdminUserPayload,
  type UpdateAdminUserByIdPayload,
  createAdminUserAction,
  updateAdminUserByIdAction,
} from "@/app/actions/adminUser";
import SelectBox from "@/components/ui/SelectBox";
import { toast } from "@/components/ui/Toast";
import { Eye, EyeOff, Loader2, Pencil, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { mode: "create" } | { mode: "edit"; user: AdminUserProfile };

const ROLE_OPTIONS: { value: "admin" | "super_admin"; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

export default function AdminUserFormModal(props: Props) {
  const { mode } = props;
  const user = mode === "edit" ? props.user : undefined;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "super_admin">("admin");

  const router = useRouter();

  const handleOpen = () => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setPassword("");
    setRole((user?.role as "admin" | "super_admin") || "admin");
    setError("");
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    let res;
    if (mode === "create") {
      const payload: CreateAdminUserPayload = { name, email, password, role };
      res = await createAdminUserAction(payload);
    } else {
      const payload: UpdateAdminUserByIdPayload = { name, role };
      if (password.trim()) payload.password = password.trim();
      res = await updateAdminUserByIdAction(user!._id, payload);
    }

    if (!res.ok) {
      setError(res.error || "Something went wrong.");
      toast.error(res.error || "Something went wrong.");
    } else {
      toast.success(
        mode === "create"
          ? "Admin user created successfully."
          : "Admin user updated successfully.",
      );
      handleClose();
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <>
      {/* Trigger button */}
      {mode === "create" ? (
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#00aeb5] px-4 text-sm font-bold text-white shadow-[0_6px_18px_rgba(0,174,181,0.2)] transition hover:bg-[#009ca4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00aeb5]"
        >
          <Plus size={15} className="shrink-0" />
          Add User
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          title="Edit user"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-cyan-200 hover:bg-cyan-50 hover:text-[#008f96]"
        >
          <Pencil size={11} />
          Edit
        </button>
      )}

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-user-dialog-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Card */}
          <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2
                  id="admin-user-dialog-title"
                  className="text-lg font-bold text-[#12213a]"
                >
                  {mode === "create" ? "Add Admin User" : "Edit Admin User"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {mode === "create"
                    ? "Create a new admin or super admin account"
                    : "Update name, role or reset password"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="John Doe"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#00aeb5] focus:ring-4 focus:ring-cyan-500/10 transition-shadow"
                />
              </div>

              {/* Email — create only */}
              {mode === "create" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="admin@example.com"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#00aeb5] focus:ring-4 focus:ring-cyan-500/10 transition-shadow"
                  />
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password{" "}
                  {mode === "create" ? (
                    <span className="text-rose-500">*</span>
                  ) : (
                    <span className="text-slate-400 font-normal">
                      (leave blank to keep current)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={mode === "create"}
                    placeholder={
                      mode === "create" ? "Min. 6 characters" : "••••••••"
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 px-3.5 pr-10 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#00aeb5] focus:ring-4 focus:ring-cyan-500/10 transition-shadow"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Role <span className="text-rose-500">*</span>
                </label>
                <SelectBox
                  value={role}
                  onValueChange={(nextRole) =>
                    setRole(nextRole as "admin" | "super_admin")
                  }
                  options={ROLE_OPTIONS}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-[#00aeb5] focus:ring-4 focus:ring-cyan-500/10 transition-shadow"
                />
              </div>

              {/* Error */}
              {error && (
                <p className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-xs font-medium text-rose-600">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#00aeb5] px-5 text-sm font-bold text-white transition hover:bg-[#009ca4] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {mode === "create" ? "Create User" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
