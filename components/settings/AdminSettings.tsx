"use client";

import {
  AdminUserProfile,
  updateAdminUserProfileAction,
} from "@/app/actions/adminUser";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  KeyRound,
  PencilLine,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type AdminSettingsProps = {
  profile?: AdminUserProfile | null;
  loadError?: string;
  isLoading?: boolean;
};

type ProfileFormState = {
  name: string;
  phone: string;
};

type PasswordFormState = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const fieldClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-[#20304b] outline-none transition placeholder:text-slate-400 focus:border-[#00aeb5] focus:ring-4 focus:ring-cyan-500/10";

const PrimaryButton = ({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00aeb5] px-4 text-sm font-bold text-white shadow-[0_6px_18px_rgba(0,174,181,0.18)] transition hover:bg-[#009ca4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00aeb5] disabled:cursor-not-allowed disabled:opacity-60"
  >
    {children}
  </button>
);

const SecondaryButton = ({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {children}
  </button>
);

export const AdminSettingsSkeleton = () => (
  <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
    <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
    <div className="space-y-6">
      <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
    </div>
  </div>
);

export default function AdminSettings({
  profile,
  loadError,
  isLoading,
}: AdminSettingsProps) {
  const [profileData, setProfileData] = useState<AdminUserProfile | null>(
    profile || null,
  );
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(
    null,
  );
  const [error, setError] = useState<string>(loadError || "");
  const [success, setSuccess] = useState("");

  const initialProfileForm = useMemo<ProfileFormState>(
    () => ({
      name: profileData?.name || "",
      phone: profileData?.phone || "",
    }),
    [profileData],
  );

  const [profileForm, setProfileForm] =
    useState<ProfileFormState>(initialProfileForm);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const avatarPreviewUrl = useMemo(() => {
    if (!selectedAvatarFile) return profileData?.avatar || "";
    return URL.createObjectURL(selectedAvatarFile);
  }, [profileData?.avatar, selectedAvatarFile]);

  useEffect(() => {
    if (!selectedAvatarFile) return;
    return () => URL.revokeObjectURL(avatarPreviewUrl);
  }, [selectedAvatarFile, avatarPreviewUrl]);

  const onProfileChange =
    (field: keyof ProfileFormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setProfileForm((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const onPasswordChange =
    (field: keyof PasswordFormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setPasswordForm((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const startProfileEdit = () => {
    setProfileForm(initialProfileForm);
    setSelectedAvatarFile(null);
    setEditingProfile(true);
    setError("");
    setSuccess("");
  };

  const cancelProfileEdit = () => {
    setProfileForm(initialProfileForm);
    setSelectedAvatarFile(null);
    setEditingProfile(false);
  };

  const saveProfile = async () => {
    setError("");
    setSuccess("");

    const name = profileForm.name.trim();
    const phone = profileForm.phone.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }

    setSavingProfile(true);
    const response = await updateAdminUserProfileAction({
      name,
      phone: phone || undefined,
      avatarFile: selectedAvatarFile,
    });
    setSavingProfile(false);

    if (!response.ok) {
      setError(response.error || "Failed to update profile.");
      return;
    }

    setProfileData(response.data);
    setSelectedAvatarFile(null);
    setEditingProfile(false);
    setSuccess("Profile updated successfully.");
  };

  const startPasswordEdit = () => {
    setPasswordForm({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setEditingPassword(true);
    setError("");
    setSuccess("");
  };

  const cancelPasswordEdit = () => {
    setPasswordForm({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setEditingPassword(false);
  };

  const savePassword = async () => {
    setError("");
    setSuccess("");

    if (!passwordForm.oldPassword) {
      setError("Old password is required.");
      return;
    }
    if (!passwordForm.newPassword) {
      setError("New password is required.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setSavingPassword(true);
    const response = await updateAdminUserProfileAction({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
    });
    setSavingPassword(false);

    if (!response.ok) {
      setError(response.error || "Failed to change password.");
      return;
    }

    setPasswordForm({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setEditingPassword(false);
    setSuccess("Password changed successfully.");
  };

  if (isLoading) return <AdminSettingsSkeleton />;

  const profileInitial =
    profileData?.name?.trim().charAt(0).toUpperCase() || "A";
  const normalizedRole = (profileData?.role || "admin").replace(/_/g, " ");

  return (
    <div className="space-y-5">
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">{error}</span>
        </div>
      ) : null}
      {success ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">{success}</span>
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white xl:sticky xl:top-6">
          <div className="border-b border-slate-100 p-6 text-center">
            <div className="group relative mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-violet-50 text-2xl font-extrabold text-violet-700 ring-4 ring-slate-50">
              {avatarPreviewUrl ? (
                <Image
                  width={96}
                  height={96}
                  src={avatarPreviewUrl}
                  alt={profileData?.name || "Admin avatar"}
                  className="h-full w-full object-cover"
                />
              ) : (
                profileInitial
              )}
              {editingProfile ? (
                <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-slate-950/55 text-white opacity-0 transition group-hover:opacity-100">
                  <Camera className="h-5 w-5" aria-hidden="true" />
                  <span className="sr-only">Upload profile picture</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const nextFile = event.target.files?.[0];
                      if (nextFile) setSelectedAvatarFile(nextFile);
                    }}
                    className="sr-only"
                  />
                </label>
              ) : null}
            </div>
            <h2 className="mt-4 text-xl font-bold text-[#12213a]">
              {profileData?.name || "Admin"}
            </h2>
            <p className="mt-1 truncate text-sm text-slate-500">
              {profileData?.email || "No email provided"}
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#eaf9f8] px-2.5 py-1 text-[11px] font-bold capitalize text-[#008f96]">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              {normalizedRole}
            </span>
          </div>
          <div className="space-y-3 p-5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Profile status</span>
              <span className="font-bold text-emerald-600">Active</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Phone</span>
              <span className="truncate font-semibold text-[#34445f]">
                {profileData?.phone || "Not added"}
              </span>
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                  <UserRound className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-[#12213a]">
                    Profile information
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Update the details attached to your admin account.
                  </p>
                </div>
              </div>
              {!editingProfile ? (
                <SecondaryButton onClick={startProfileEdit}>
                  <PencilLine className="h-4 w-4" aria-hidden="true" />
                  Edit profile
                </SecondaryButton>
              ) : null}
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-600">
                  Full name
                </span>
                {editingProfile ? (
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={onProfileChange("name")}
                    className={fieldClass}
                  />
                ) : (
                  <span className="flex h-11 items-center rounded-xl border border-slate-100 bg-slate-50 px-3.5 text-sm font-semibold text-[#20304b]">
                    {profileData?.name || "Not specified"}
                  </span>
                )}
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-600">
                  Email address
                </span>
                <span className="flex h-11 items-center rounded-xl border border-slate-100 bg-slate-50 px-3.5 text-sm font-semibold text-slate-500">
                  {profileData?.email || "Not specified"}
                </span>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-2 block text-xs font-bold text-slate-600">
                  Phone number
                </span>
                {editingProfile ? (
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={onProfileChange("phone")}
                    placeholder="Add a phone number"
                    className={`${fieldClass} sm:max-w-md`}
                  />
                ) : (
                  <span className="flex h-11 items-center rounded-xl border border-slate-100 bg-slate-50 px-3.5 text-sm font-semibold text-[#20304b] sm:max-w-md">
                    {profileData?.phone || "Not specified"}
                  </span>
                )}
              </label>
            </div>

            {editingProfile ? (
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4 sm:px-6">
                <SecondaryButton
                  onClick={cancelProfileEdit}
                  disabled={savingProfile}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancel
                </SecondaryButton>
                <PrimaryButton onClick={saveProfile} disabled={savingProfile}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {savingProfile ? "Saving…" : "Save changes"}
                </PrimaryButton>
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#dce5ee] bg-white">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <KeyRound className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-[#12213a]">
                    Password and security
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Use a strong password unique to this workspace.
                  </p>
                </div>
              </div>
              {!editingPassword ? (
                <SecondaryButton onClick={startPasswordEdit}>
                  <PencilLine className="h-4 w-4" aria-hidden="true" />
                  Change password
                </SecondaryButton>
              ) : null}
            </div>

            {!editingPassword ? (
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-[#20304b]">
                      Current password
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Last update is managed securely by the account service.
                    </p>
                  </div>
                  <span className="font-black tracking-[0.22em] text-slate-400">
                    ••••••••
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-xs font-bold text-slate-600">
                      Current password
                    </span>
                    <input
                      type="password"
                      value={passwordForm.oldPassword}
                      onChange={onPasswordChange("oldPassword")}
                      autoComplete="current-password"
                      placeholder="Enter current password"
                      className={`${fieldClass} sm:max-w-md`}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold text-slate-600">
                      New password
                    </span>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={onPasswordChange("newPassword")}
                      autoComplete="new-password"
                      placeholder="Enter new password"
                      className={fieldClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold text-slate-600">
                      Confirm new password
                    </span>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={onPasswordChange("confirmPassword")}
                      autoComplete="new-password"
                      placeholder="Repeat new password"
                      className={fieldClass}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4 sm:px-6">
                  <SecondaryButton
                    onClick={cancelPasswordEdit}
                    disabled={savingPassword}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Cancel
                  </SecondaryButton>
                  <PrimaryButton
                    onClick={savePassword}
                    disabled={savingPassword}
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    {savingPassword ? "Updating…" : "Update password"}
                  </PrimaryButton>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
