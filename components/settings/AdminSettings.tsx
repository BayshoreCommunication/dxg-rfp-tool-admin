"use client";

import {
  AdminUserProfile,
  updateAdminUserProfileAction,
} from "@/app/actions/adminUser";
import { Camera, KeyRound, PencilLine, User as UserIcon } from "lucide-react";
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

export const AdminSettingsSkeleton = () => {
  return (
    <div className="w-full bg-[#111318] mt-6 space-y-12 p-8 rounded-2xl border border-gray-700/50">
      <div className="flex h-24 w-24 shrink-0 overflow-hidden rounded-full bg-gray-700 animate-pulse shadow-sm" />

      <div className="max-w-4xl relative">
        <div className="mb-8 flex items-center justify-between border-b border-gray-700/50 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gray-700 rounded-xl w-10 h-10 animate-pulse" />
            <div className="w-40 h-6 bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
              <div className="w-24 h-4 bg-gray-700 rounded animate-pulse" />
              <div className="w-64 h-10 bg-gray-800 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
        <div className="mt-8 w-36 h-10 bg-gray-700 rounded-lg animate-pulse" />
      </div>

      <div className="max-w-4xl relative">
        <div className="mb-8 flex items-center justify-between border-b border-gray-700/50 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gray-700 rounded-xl w-10 h-10 animate-pulse" />
            <div className="w-40 h-6 bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            <div className="w-24 h-4 bg-gray-700 rounded animate-pulse" />
            <div className="w-64 h-10 bg-gray-800 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="mt-8 w-44 h-10 bg-gray-700 rounded-lg animate-pulse" />
      </div>
    </div>
  );
};

const AdminSettings = ({
  profile,
  loadError,
  isLoading,
}: AdminSettingsProps) => {
  const [profileData, setProfileData] = useState<AdminUserProfile | null>(
    profile || null,
  );

  useEffect(() => {
    if (profile) setProfileData(profile);
  }, [profile]);

  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [error, setError] = useState<string>(loadError || "");
  const [success, setSuccess] = useState("");

  const initialProfileForm = useMemo<ProfileFormState>(
    () => ({
      name: profileData?.name || "",
      phone: profileData?.phone || "",
    }),
    [profileData],
  );

  const [profileForm, setProfileForm] = useState<ProfileFormState>(initialProfileForm);
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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setProfileForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const onPasswordChange =
    (field: keyof PasswordFormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPasswordForm((prev) => ({ ...prev, [field]: e.target.value }));
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
    setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    setEditingPassword(true);
    setError("");
    setSuccess("");
  };

  const cancelPasswordEdit = () => {
    setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    setEditingPassword(false);
  };

  const savePassword = async () => {
    setError("");
    setSuccess("");

    const { oldPassword, newPassword, confirmPassword } = passwordForm;

    if (!oldPassword) { setError("Old password is required."); return; }
    if (!newPassword) { setError("New password is required."); return; }
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setSavingPassword(true);
    const response = await updateAdminUserProfileAction({ oldPassword, newPassword });
    setSavingPassword(false);

    if (!response.ok) {
      setError(response.error || "Failed to change password.");
      return;
    }

    setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    setEditingPassword(false);
    setSuccess("Password changed successfully.");
  };

  if (isLoading) return <AdminSettingsSkeleton />;

  return (
    <div className="w-full bg-[#111318] mt-6 space-y-12 font-sans rounded-2xl p-6 sm:p-8 border border-gray-700/50">
      {/* Avatar Section */}
      <div className="flex items-center gap-6 pb-6 border-b border-gray-700/50">
        <div className="relative group flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500/10 border-4 border-gray-700 shadow-lg ring-1 ring-gray-700">
          {editingProfile ? (
            <>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedAvatarFile(e.target.files[0]);
                  }
                }}
                className="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-20"
              />
              {avatarPreviewUrl ? (
                <Image
                  width={96}
                  height={96}
                  src={avatarPreviewUrl}
                  alt={profileData?.name || "Admin avatar"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserIcon className="w-10 h-10 text-indigo-400" />
              )}
            </>
          ) : (
            <>
              {avatarPreviewUrl ? (
                <Image
                  width={96}
                  height={96}
                  src={avatarPreviewUrl}
                  alt={profileData?.name || "Admin avatar"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserIcon className="w-10 h-10 text-indigo-400" />
              )}
            </>
          )}
        </div>
        <div>
          {editingProfile ? (
            <>
              <p className="text-sm font-semibold text-gray-300">Profile Picture</p>
              <p className="text-xs text-gray-500 mt-0.5">Click the image to upload a new avatar.</p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-bold text-gray-100">{profileData?.name || "Admin"}</h3>
              <p className="text-sm text-gray-400 mt-1">{profileData?.email || "No email provided"}</p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="max-w-4xl p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-sm font-medium text-rose-400 flex items-center gap-3">
          {error}
        </div>
      )}
      {success && (
        <div className="max-w-4xl p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm font-medium text-emerald-400 flex items-center gap-3">
          {success}
        </div>
      )}

      {/* Profile Settings Box */}
      <div className="max-w-4xl relative">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 rounded-xl">
              <UserIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-gray-100">Profile Settings</h3>
              <p className="text-sm text-gray-500 mt-0.5">Manage your personal information</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-y-6 gap-x-8 items-center bg-gray-800/30 p-6 rounded-xl border border-gray-700/50">
          <label className="sm:col-span-3 text-sm font-semibold text-gray-400">Full Name</label>
          <div className="sm:col-span-9">
            {editingProfile ? (
              <input
                type="text"
                value={profileForm.name}
                onChange={onProfileChange("name")}
                className="w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-100 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm placeholder:text-gray-600"
              />
            ) : (
              <p className="text-sm font-medium text-gray-200">{profileData?.name || "Not specified"}</p>
            )}
          </div>

          <label className="sm:col-span-3 text-sm font-semibold text-gray-400">Email Address</label>
          <div className="sm:col-span-9">
            <p className={`text-sm font-medium ${editingProfile ? "text-gray-500 bg-gray-700/50 cursor-not-allowed border-gray-600 w-full max-w-md px-4 py-2.5 rounded-lg border" : "text-gray-200"}`}>
              {profileData?.email || "Not specified"}
            </p>
          </div>

          <label className="sm:col-span-3 text-sm font-semibold text-gray-400">Phone Number</label>
          <div className="sm:col-span-9">
            {editingProfile ? (
              <input
                type="text"
                value={profileForm.phone}
                onChange={onProfileChange("phone")}
                className="w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-100 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm placeholder:text-gray-600"
              />
            ) : (
              <p className="text-sm font-medium text-gray-200">{profileData?.phone || "Not specified"}</p>
            )}
          </div>
        </div>

        {editingProfile ? (
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={cancelProfileEdit}
              disabled={savingProfile}
              className="rounded-lg border border-gray-600 bg-gray-800 px-5 py-2.5 text-sm font-semibold text-gray-300 hover:bg-gray-700 disabled:opacity-60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveProfile}
              disabled={savingProfile}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
            >
              {savingProfile ? "Saving..." : "Save Changes"}
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <button
              type="button"
              onClick={startProfileEdit}
              className="flex items-center gap-2 rounded-lg bg-gray-700 px-5 py-2.5 text-sm font-semibold text-gray-100 hover:bg-gray-600 transition-colors"
            >
              <PencilLine size={16} />
              Update Profile
            </button>
          </div>
        )}
      </div>

      {/* Password Settings Box */}
      <div className="max-w-4xl relative pt-6 border-t border-gray-700/50">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-xl">
              <KeyRound className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-gray-100">Password Settings</h3>
              <p className="text-sm text-gray-500 mt-0.5">Secure your administrative access</p>
            </div>
          </div>
        </div>

        {!editingPassword ? (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-y-6 gap-x-8 items-center bg-gray-800/30 p-6 rounded-xl border border-gray-700/50">
            <label className="sm:col-span-3 text-sm font-semibold text-gray-400">Current Password</label>
            <div className="sm:col-span-9">
              <input
                type="password"
                value="••••••••••••"
                readOnly
                className="bg-transparent text-sm font-bold tracking-widest text-gray-500 outline-none cursor-default"
              />
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-y-6 gap-x-8 items-center bg-gray-800/30 p-6 rounded-xl border border-gray-700/50">
              <label className="sm:col-span-3 text-sm font-semibold text-gray-400">Old Password</label>
              <div className="sm:col-span-9">
                <input
                  type="password"
                  value={passwordForm.oldPassword}
                  onChange={onPasswordChange("oldPassword")}
                  placeholder="Enter current password"
                  className="w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-100 outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-sm placeholder:text-gray-600"
                />
              </div>

              <label className="sm:col-span-3 text-sm font-semibold text-gray-400">New Password</label>
              <div className="sm:col-span-9">
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={onPasswordChange("newPassword")}
                  placeholder="Enter new password"
                  className="w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-100 outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-sm placeholder:text-gray-600"
                />
              </div>

              <label className="sm:col-span-3 text-sm font-semibold text-gray-400">Confirm Password</label>
              <div className="sm:col-span-9">
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={onPasswordChange("confirmPassword")}
                  placeholder="Confirm new password"
                  className="w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-100 outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 shadow-sm placeholder:text-gray-600"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={cancelPasswordEdit}
                disabled={savingPassword}
                className="rounded-lg border border-gray-600 bg-gray-800 px-5 py-2.5 text-sm font-semibold text-gray-300 hover:bg-gray-700 disabled:opacity-60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePassword}
                disabled={savingPassword}
                className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60 transition-colors"
              >
                {savingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        )}

        {!editingPassword && (
          <div className="mt-6">
            <button
              type="button"
              onClick={startPasswordEdit}
              className="flex items-center gap-2 rounded-lg bg-gray-700 px-5 py-2.5 text-sm font-semibold text-gray-100 hover:bg-gray-600 transition-colors"
            >
              <PencilLine size={16} />
              Update Password
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
