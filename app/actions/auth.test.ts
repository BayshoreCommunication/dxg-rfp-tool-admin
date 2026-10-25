jest.mock("next-auth", () => ({
  CredentialsSignin: class CredentialsSignin extends Error {
    code = "credentials";
  },
}));
jest.mock("@/auth", () => ({ signIn: jest.fn() }));
jest.mock("@/lib/server/backendClient", () => ({
  authenticatedBackendFetch: jest.fn(),
}));
jest.mock("@/lib/server/backendLogout", () => ({
  revokeCurrentBackendSession: jest.fn(),
}));

import { CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";
import { signInAction } from "./auth";

const mockedSignIn = jest.mocked(signIn);

const credentialsError = (code: string) => {
  const error = new CredentialsSignin();
  error.code = code;
  return error;
};

describe("admin signInAction", () => {
  beforeEach(() => {
    mockedSignIn.mockReset();
  });

  it.each([
    ["USER_NOT_FOUND", "No account found with this email."],
    ["WRONG_PASSWORD", "Incorrect password. Please try again."],
    ["NOT_ADMIN", "This account does not have admin access."],
    ["server_unavailable", "Could not reach the server. Please try again."],
  ])("explains a thrown %s failure", async (code, message) => {
    mockedSignIn.mockRejectedValue(credentialsError(code));

    await expect(signInAction("a@b.co", "secret123")).resolves.toEqual({
      success: false,
      message,
    });
  });

  it("falls back to a generic message for unknown credential codes", async () => {
    mockedSignIn.mockRejectedValue(credentialsError("credentials"));

    await expect(signInAction("a@b.co", "secret123")).resolves.toEqual({
      success: false,
      message: "Login failed. Please try again.",
    });
  });

  it("reads the code from an error redirect URL", async () => {
    mockedSignIn.mockResolvedValue("/sign-in?error=CredentialsSignin&code=USER_NOT_FOUND");

    await expect(signInAction("a@b.co", "secret123")).resolves.toEqual({
      success: false,
      message: "No account found with this email.",
    });
  });

  it("keeps the unexpected-error message for non-credential failures", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    mockedSignIn.mockRejectedValue(new Error("boom"));

    await expect(signInAction("a@b.co", "secret123")).resolves.toEqual({
      success: false,
      message: "An unexpected error occurred.",
    });
    consoleError.mockRestore();
  });

  it("returns a safe callback URL on success", async () => {
    mockedSignIn.mockResolvedValue("/dashboard");

    await expect(signInAction("a@b.co", "secret123", "//evil.example")).resolves.toEqual({
      success: true,
      callbackUrl: "/dashboard",
      message: "Login successful",
    });
  });
});
