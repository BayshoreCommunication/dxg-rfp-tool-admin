jest.mock("@/lib/server/backendClient", () => ({
  authenticatedBackendFetch: jest.fn(),
}));

import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import { getAdminOverviewAction } from "./admin";

const mockedFetch = jest.mocked(authenticatedBackendFetch);

const answer = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

describe("getAdminOverviewAction", () => {
  beforeEach(() => mockedFetch.mockReset());

  it("returns the three totals and nothing else the backend sends: no customer accounts, no client count", async () => {
    mockedFetch.mockResolvedValue(
      answer(200, {
        success: true,
        data: {
          totals: { totalClients: 9, totalProposals: 41, totalEmailSent: 120, totalClick: 7, somethingNew: 1 },
          latestClients: [{ id: "6af570293393d07387d6e684", name: "Pat Example", email: "pat@example.com", company: "Example Co", joinDate: "2026-01-01T00:00:00.000Z" }],
        },
      }),
    );
    const result = await getAdminOverviewAction();
    expect(result).toEqual({ ok: true, data: { totals: { totalProposals: 41, totalEmailSent: 120, totalClick: 7 } } });
    expect(JSON.stringify(result)).not.toMatch(/latestClients|totalClients|pat@example\.com|Pat Example|Example Co|somethingNew/);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(String(mockedFetch.mock.calls[0][0])).toMatch(/\/api\/admin\/overview$/);
  });

  it("reads a missing or malformed total as zero, and a missing payload as none", async () => {
    mockedFetch.mockResolvedValue(answer(200, { data: { totals: { totalProposals: "41", totalClick: Number.NaN } } }));
    expect(await getAdminOverviewAction()).toEqual({ ok: true, data: { totals: { totalProposals: 0, totalEmailSent: 0, totalClick: 0 } } });
    mockedFetch.mockResolvedValue(answer(200, { data: { latestClients: [{ email: "pat@example.com" }] } }));
    expect(await getAdminOverviewAction()).toEqual({ ok: true, data: { totals: { totalProposals: 0, totalEmailSent: 0, totalClick: 0 } } });
    mockedFetch.mockResolvedValue(answer(200, {}));
    expect(await getAdminOverviewAction()).toEqual({ ok: true, data: null });
  });

  it("passes on a refusal without any payload", async () => {
    mockedFetch.mockResolvedValue(answer(403, { message: "Forbidden", data: { latestClients: [{ email: "pat@example.com" }] } }));
    expect(await getAdminOverviewAction()).toEqual({ ok: false, error: "Forbidden", data: null });
  });
});
