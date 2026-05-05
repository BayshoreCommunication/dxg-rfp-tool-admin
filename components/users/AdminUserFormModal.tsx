"use client";

import {
  type AdminUserProfile,
  type CreateAdminUserPayload,
  type UpdateAdminUserByIdPayload,
  createAdminUserAction,
  updateAdminUserByIdAction,
} from "@/app/actions/adminUser";
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
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus size={15} />
          Add User
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          title="Edit user"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
        >
          <Pencil size={11} />
          Edit
        </button>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Card */}
          <div className="relative z-10 w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
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
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
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
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
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
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 pr-10 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
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
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "admin" | "super_admin")
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow bg-white"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
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
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
