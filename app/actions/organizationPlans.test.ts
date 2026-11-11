jest.mock("server-only", () => ({}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/server/backendClient", () => ({
  authenticatedBackendFetch: jest.fn(),
}));

import { revalidatePath } from "next/cache";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import {
  changeOrganizationPlanAction,
  getOrganizationPlanAction,
  listOrganizationPlansAction,
} from "./organizationPlans";

const mockedFetch = jest.mocked(authenticatedBackendFetch);
const mockedRevalidate = jest.mocked(revalidatePath);

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

const ORG = "a".repeat(24);
const detail = { organization: { id: ORG, plan: "full_access" }, plans: [], history: [], changed: true };

describe("organization plan actions", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedRevalidate.mockReset();
  });

  it("lists through the signed-in admin's session, with the search only when set", async () => {
    const page = { organizations: [], plans: [], pagination: { page: 2, perPage: 20, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: true }, filters: { search: "acme" } };
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: page }));
    await expect(listOrganizationPlansAction("  acme ", 2)).resolves.toEqual({ ok: true, data: page });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/admin\/organization-plans\?page=2&search=acme$/);
    expect(init).toMatchObject({ method: "GET", cache: "no-store" });

    await listOrganizationPlansAction("", 0);
    expect(String(mockedFetch.mock.calls[1][0])).toMatch(/\/organization-plans\?page=1$/);
  });

  it("changes a plan with PUT, sends the note only when given, and refreshes the page", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: detail }));
    await expect(changeOrganizationPlanAction(ORG, "full_access", "  Paid by invoice ")).resolves.toEqual({ ok: true, data: detail });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(String(url)).toMatch(new RegExp(`/api/v1/admin/organization-plans/${ORG}$`));
    expect(init).toMatchObject({ method: "PUT", body: JSON.stringify({ plan: "full_access", note: "Paid by invoice" }) });
    expect(mockedRevalidate).toHaveBeenCalledWith("/organizations");

    await changeOrganizationPlanAction(ORG, "free_trial", "   ");
    expect(mockedFetch.mock.calls[1][1]).toMatchObject({ body: JSON.stringify({ plan: "free_trial" }) });
  });

  it("keeps an id from changing the request path", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(404, { success: false, code: "ORGANIZATION_NOT_FOUND", message: "Organization not found." }));
    await getOrganizationPlanAction("../support/tickets?x=1");
    expect(String(mockedFetch.mock.calls[0][0])).toMatch(/\/organization-plans\/\.\.%2Fsupport%2Ftickets%3Fx%3D1$/);
  });

  it("shows the backend's message and code, and never refreshes after a refusal", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(409, { success: false, code: "PLAN_CHANGE_CONFLICT", message: "This organization's plan was just changed by someone else. Reload and try again." }));
    await expect(changeOrganizationPlanAction(ORG, "full_access")).resolves.toEqual({
      ok: false,
      error: "This organization's plan was just changed by someone else. Reload and try again.",
      code: "PLAN_CHANGE_CONFLICT",
    });
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });

  it("falls back to a plain message when the backend sends none", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(403, {}));
    await expect(listOrganizationPlansAction()).resolves.toEqual({ ok: false, error: "Only RFPilot staff can view or change plans." });

    mockedFetch.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error("not json"); } } as unknown as Response);
    await expect(getOrganizationPlanAction(ORG)).resolves.toEqual({ ok: false, error: "The organization's plan couldn't be loaded." });

    mockedFetch.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:8000"));
    const failed = await changeOrganizationPlanAction(ORG, "full_access");
    expect(failed).toEqual({ ok: false, error: "The server couldn't be reached. Check your connection and try again." });
    expect(JSON.stringify(failed)).not.toContain("10.0.0.5");
  });
});
