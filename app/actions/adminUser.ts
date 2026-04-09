"use server";

import { auth } from "@/auth";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

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

export type UpdateAdminUserPayload = {
  name?: string;
  phone?: string;
  avatar?: string;
  oldPassword?: string;
  newPassword?: string;
  password?: string;
  avatarFile?: File | null;
};

export async function getAdminUserProfileAction(): Promise<AdminUserResponse> {
  const session = await auth();
  const accessToken = session?.user?.accessToken;

  if (!accessToken) {
    return {
      ok: false,
      error: "User is not authenticated.",
      data: null,
    };
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
      return {
        ok: false,
        error: result?.message || "Failed to fetch admin profile.",
        data: null,
      };
    }

    return {
      ok: true,
      data: (result?.data as AdminUserProfile) || null,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
      data: null,
    };
  }
}

export async function updateAdminUserProfileAction(
  payload: UpdateAdminUserPayload,
): Promise<AdminUserResponse> {
  const session = await auth();
  const accessToken = session?.user?.accessToken;

  if (!accessToken) {
    return {
      ok: false,
      error: "User is not authenticated.",
      data: null,
    };
  }

  try {
    const formData = new FormData();

    if (payload.name !== undefined) formData.append("name", payload.name);
    if (payload.phone !== undefined) formData.append("phone", payload.phone);
    if (payload.avatar !== undefined) formData.append("avatar", payload.avatar);
    if (payload.oldPassword !== undefined) {
      formData.append("oldPassword", payload.oldPassword);
    }
    if (payload.newPassword !== undefined) {
      formData.append("newPassword", payload.newPassword);
    }
    if (payload.password !== undefined) {
      formData.append("password", payload.password);
    }
    if (payload.avatarFile) {
      formData.append("avatarFile", payload.avatarFile);
    }

    const response = await fetch(`${BACKEND_URL}/api/admin-user/me`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
      cache: "no-store",
    });

    const result = await response.json();
    if (!response.ok) {
      return {
        ok: false,
        error: result?.message || "Failed to update admin profile.",
        data: null,
      };
    }

    return {
      ok: true,
      data: (result?.data as AdminUserProfile) || null,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
      data: null,
    };
  }
}
