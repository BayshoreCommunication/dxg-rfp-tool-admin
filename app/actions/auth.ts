"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

import { BACKEND_URL } from "@/lib/config";
import { getBackendAccessToken } from "@/lib/server/backendSession";

const getErrorMessage = (error: unknown, fallback = "Network error") =>
  error instanceof Error && error.message ? error.message : fallback;

/* ─────────────────────────────────────────
   SIGNUP — Step 1: Send OTP (spam check)
───────────────────────────────────────── */
export async function sendSignupOtpAction(email: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
    const data = await res.json();
    return {
      success: res.ok,
      message: data.message || (res.ok ? "OTP sent" : "Failed to send OTP"),
    };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}

/* ─────────────────────────────────────────
   SIGNUP — Step 2: Verify OTP
───────────────────────────────────────── */
export async function verifySignupOtpAction(email: string, otp: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
      cache: "no-store",
    });
    const data = await res.json();
    return {
      success: res.ok,
      message:
        data.message || (res.ok ? "Email verified" : "Verification failed"),
    };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}

/* ─────────────────────────────────────────
   SIGNUP — Step 3: Register account
───────────────────────────────────────── */
export async function signUpAction(payload: {
  name: string;
  email: string;
  phone?: string;
  password: string;
}) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok)
      return { success: false, message: data.message || "Registration failed" };
    return {
      success: true,
      user: data.user,
      accessToken: data.accessToken,
      message: data.message,
    };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}

/* ─────────────────────────────────────────
   SIGN IN
───────────────────────────────────────── */
function getSafeCallbackUrl(callbackUrl?: string) {
  if (!callbackUrl || !callbackUrl.startsWith("/")) {
    return "/dashboard";
  }
  if (callbackUrl.startsWith("//") || callbackUrl.startsWith("/sign-in")) {
    return "/dashboard";
  }
  return callbackUrl;
}

const ADMIN_AUTH_ERRORS: Record<string, string> = {
  USER_NOT_FOUND: "No account found with this email.",
  WRONG_PASSWORD: "Incorrect password. Please try again.",
  USER_BLOCKED: "Your account has been blocked. Please contact support.",
  NOT_ADMIN: "This account does not have admin access.",
};

export async function signInAction(
  email: string,
  password: string,
  callbackUrl?: string,
) {
  // Pre-check credentials against backend to get specific error messages
  try {
    const { BACKEND_URL: BASE } = await import("@/lib/config");
    const apiUrl = BASE.endsWith("/api") ? BASE.slice(0, -4) : BASE;

    const preCheck = await fetch(`${apiUrl}/api/auth/admin/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    if (!preCheck.ok) {
      const errData = await preCheck.json().catch(() => ({}));
      const code = errData?.errorCode as string | undefined;
      return {
        success: false,
        message:
          (code && ADMIN_AUTH_ERRORS[code]) ||
          errData?.message ||
          "Login failed. Please try again.",
      };
    }
  } catch {
    return { success: false, message: "Could not reach the server. Please try again." };
  }

  // Credentials are valid — create the NextAuth session
  try {
    await signIn("credentials", { email, password, redirect: false });
    return {
      success: true,
      callbackUrl: getSafeCallbackUrl(callbackUrl),
      message: "Login successful",
    };
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return { success: false, message: "Login failed. Please try again." };
    }
    return { success: false, message: "An unexpected error occurred." };
  }
}

/* ─────────────────────────────────────────
   FORGOT PASSWORD — Step 1: Send reset OTP
───────────────────────────────────────── */
export async function sendForgotPasswordOtpAction(email: string) {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/auth/forgot-password/send-otp`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        cache: "no-store",
      },
    );
    const data = await res.json();
    return {
      success: res.ok,
      message:
        data.message ||
        (res.ok ? "Reset code sent" : "Failed to send reset code"),
    };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}

/* ─────────────────────────────────────────
   FORGOT PASSWORD — Step 2: Verify reset OTP
───────────────────────────────────────── */
export async function verifyForgotPasswordOtpAction(
  email: string,
  otp: string,
) {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/auth/forgot-password/verify-otp`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
        cache: "no-store",
      },
    );
    const data = await res.json();
    return {
      success: res.ok,
      message: data.message || (res.ok ? "OTP verified" : "Invalid OTP"),
    };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}

/* ─────────────────────────────────────────
   FORGOT PASSWORD — Step 3: Reset password
───────────────────────────────────────── */
export async function resetPasswordAction(email: string, newPassword: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/forgot-password/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, newPassword }),
      cache: "no-store",
    });
    const data = await res.json();
    return {
      success: res.ok,
      message:
        data.message ||
        (res.ok ? "Password reset" : "Failed to reset password"),
    };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}

/* ─────────────────────────────────────────
   GET CURRENT USER
───────────────────────────────────────── */
export async function getCurrentUserAction(accessToken: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message };
    return { success: true, user: data.user };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}

/* ─────────────────────────────────────────
   SIGN OUT
───────────────────────────────────────── */
export async function signOutAction() {
  try {
    const accessToken = await getBackendAccessToken();

    // Call backend logout if accessToken exists
    if (accessToken) {
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }
    return { success: true, message: "Signed out successfully" };
  } catch (error: unknown) {
    return { success: false, message: getErrorMessage(error) };
  }
}
