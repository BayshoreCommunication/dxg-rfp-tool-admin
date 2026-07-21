"use server";

import { BACKEND_URL } from "@/lib/config";
import { getBackendAccessToken } from "@/lib/server/backendSession";

export interface AdminUserProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUserResponse {
  ok: boolean;
  error?: string;
  data: AdminUserProfile | null;
}

export interface AdminUsersListResponse {
  ok: boolean;
  error?: string;
  data: AdminUserProfile[];
}

export type UpdateAdminUserPayload = {
  name?: string;
  phone?: string;
  avatar?: string;
  oldPassword?: string;
  newPassword?: string;
  password?: string;
  avatarFile?: File | null;
};

export type CreateAdminUserPayload = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "super_admin";
};

export type UpdateAdminUserByIdPayload = {
  name?: string;
  phone?: string;
  role?: "admin" | "super_admin";
  password?: string;
};

// ─── Own profile ─────────────────────────────────────────────────────────────

export async function getAdminUserProfileAction(): Promise<AdminUserResponse> {
  const accessToken = await getBackendAccessToken();

  if (!accessToken) {
    return { ok: false, error: "User is not authenticated.", data: null };
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/admin-user/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const result = await response.json();
    if (!response.ok) {
      return { ok: false, error: result?.message || "Failed to fetch admin profile.", data: null };
    }

    return { ok: true, data: (result?.data as AdminUserProfile) || null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error", data: null };
  }
}

export async function updateAdminUserProfileAction(
  payload: UpdateAdminUserPayload,
): Promise<AdminUserResponse> {
  const accessToken = await getBackendAccessToken();

  if (!accessToken) {
    return { ok: false, error: "User is not authenticated.", data: null };
  }

  try {
    const formData = new FormData();

    if (payload.name !== undefined) formData.append("name", payload.name);
    if (payload.phone !== undefined) formData.append("phone", payload.phone);
    if (payload.avatar !== undefined) formData.append("avatar", payload.avatar);
    if (payload.oldPassword !== undefined) formData.append("oldPassword", payload.oldPassword);
    if (payload.newPassword !== undefined) formData.append("newPassword", payload.newPassword);
    if (payload.password !== undefined) formData.append("password", payload.password);
    if (payload.avatarFile) formData.append("avatarFile", payload.avatarFile);

    const response = await fetch(`${BACKEND_URL}/api/admin-user/me`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
      cache: "no-store",
    });

    const result = await response.json();
    if (!response.ok) {
      return { ok: false, error: result?.message || "Failed to update admin profile.", data: null };
    }

    return { ok: true, data: (result?.data as AdminUserProfile) || null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error", data: null };
  }
}

// ─── Admin user management (super admin only) ─────────────────────────────────

export async function getAdminUsersListAction(): Promise<AdminUsersListResponse> {
  const accessToken = await getBackendAccessToken();

  if (!accessToken) return { ok: false, error: "User is not authenticated.", data: [] };

  try {
    const response = await fetch(`${BACKEND_URL}/api/admin-user`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const result = await response.json();
    if (!response.ok) {
      return { ok: false, error: result?.message || "Failed to fetch admin users.", data: [] };
    }

    return { ok: true, data: (result?.data as AdminUserProfile[]) || [] };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error", data: [] };
  }
}

export async function createAdminUserAction(
  payload: CreateAdminUserPayload,
): Promise<AdminUserResponse> {
  const accessToken = await getBackendAccessToken();

  if (!accessToken) return { ok: false, error: "User is not authenticated.", data: null };

  try {
    const response = await fetch(`${BACKEND_URL}/api/admin-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const result = await response.json();
    if (!response.ok) {
      return { ok: false, error: result?.message || "Failed to create admin user.", data: null };
    }

    return { ok: true, data: (result?.data as AdminUserProfile) || null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error", data: null };
  }
}

export async function updateAdminUserByIdAction(
  userId: string,
  payload: UpdateAdminUserByIdPayload,
): Promise<AdminUserResponse> {
  const accessToken = await getBackendAccessToken();

  if (!accessToken) return { ok: false, error: "User is not authenticated.", data: null };

  try {
    const response = await fetch(`${BACKEND_URL}/api/admin-user/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const result = await response.json();
    if (!response.ok) {
      return { ok: false, error: result?.message || "Failed to update admin user.", data: null };
    }

    return { ok: true, data: (result?.data as AdminUserProfile) || null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error", data: null };
  }
}

export async function deleteAdminUserAction(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const accessToken = await getBackendAccessToken();

  if (!accessToken) return { ok: false, error: "User is not authenticated." };

  try {
    const response = await fetch(`${BACKEND_URL}/api/admin-user/${userId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const result = await response.json();
    if (!response.ok) {
      return { ok: false, error: result?.message || "Failed to delete admin user." };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error" };
  }
}
