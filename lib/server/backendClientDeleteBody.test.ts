jest.mock("server-only", () => ({}));
jest.mock("@/auth", () => ({ unstable_update: jest.fn() }));
jest.mock("@/lib/server/backendSession", () => ({
  getBackendSession: jest.fn(),
}));

import { createAuthenticatedBackendClient } from "./backendClient";
import type { BackendSession } from "./backendSession";

// Removing a member from a team is `DELETE .../teams/:teamId/members/:userId` with `{ reason }`
// in a JSON body (the backend never reads the reason from the address). This checks that the
// app's signed fetch hands a DELETE's body on as it was given, on the first try and on the one
// retry after a refreshed session, and that the runtime's fetch accepts a body on a DELETE.

const session = (accessToken: string): BackendSession => ({
  accessToken,
  accessTokenExpiresAt: Date.now() + 60_000,
  refreshToken: "refresh-token",
  refreshTokenExpiresAt: 10_000,
  sessionId: "session-1",
  expired: false,
  retryableError: false,
});

const URL_ = "http://backend.test/api/v1/admin/organizations/6b0000000000000000000002/teams/6c0000000000000000000003/members/6a0000000000000000000001";
const BODY = JSON.stringify({ reason: "Requested by the account owner in ticket 4411." });
const init = (): RequestInit => ({ method: "DELETE", headers: { Accept: "application/json", "Content-Type": "application/json" }, cache: "no-store", body: BODY });

describe("a DELETE with a JSON body through the authenticated backend client", () => {
  it("sends the method, the body and the content type unchanged, with the bearer token added", async () => {
    const fetcher = jest.fn(async () => Response.json({ success: true }));
    const client = createAuthenticatedBackendClient({ readSession: async () => session("access-1"), forceRefresh: async () => null, fetcher: fetcher as unknown as typeof fetch });
    await client(URL_, init());
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, sent] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL_);
    expect(sent.method).toBe("DELETE");
    expect(sent.body).toBe(BODY);
    expect(sent.cache).toBe("no-store");
    const headers = new Headers(sent.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer access-1");
  });

  it("sends the same body again on the one retry after a 401 and a refreshed session", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(Response.json({ success: false }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ success: true }));
    const client = createAuthenticatedBackendClient({ readSession: async () => session("access-1"), forceRefresh: async () => session("access-2"), fetcher: fetcher as unknown as typeof fetch });
    const response = await client(URL_, init());
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const call of fetcher.mock.calls) {
      expect((call[1] as RequestInit).method).toBe("DELETE");
      expect((call[1] as RequestInit).body).toBe(BODY);
    }
    expect(new Headers((fetcher.mock.calls[1][1] as RequestInit).headers).get("Authorization")).toBe("Bearer access-2");
  });

  it("is a request the runtime accepts: a DELETE may carry a body (a GET may not)", async () => {
    const request = new Request(URL_, init());
    expect(request.method).toBe("DELETE");
    await expect(request.text()).resolves.toBe(BODY);
    expect(() => new Request(URL_, { method: "GET", body: BODY })).toThrow(/body/i);
  });
});
