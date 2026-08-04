import {
  expireBackendSession,
  hasExpiredBackendSession,
  readJwtExpiresAt,
  SESSION_EXPIRED_ERROR,
} from "./authTokenState";

describe("admin backend authentication token state", () => {
  it("removes all backend credentials when the refresh session expires", () => {
    const result = expireBackendSession({
      sub: "admin-1",
      accessToken: "expired-access",
      accessTokenExpiresAt: 1,
      refreshToken: "expired-refresh",
      refreshTokenExpiresAt: 2,
      sessionId: "session-1",
    });

    expect(result).toEqual({
      sub: "admin-1",
      authError: SESSION_EXPIRED_ERROR,
    });
    expect(hasExpiredBackendSession(result)).toBe(true);
  });

  it("reads a legacy access token expiry", () => {
    const payload = Buffer.from(JSON.stringify({ exp: 1_800_000_000 }))
      .toString("base64url");
    expect(readJwtExpiresAt(`header.${payload}.signature`)).toBe(
      1_800_000_000_000,
    );
    expect(readJwtExpiresAt("not-a-jwt")).toBeNull();
  });
});
