jest.mock("server-only", () => ({}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/server/backendClient", () => ({
  authenticatedBackendFetch: jest.fn(),
}));

import { revalidatePath } from "next/cache";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import {
  getSupportTicketAction,
  listSupportTicketsAction,
  replySupportTicketAction,
  updateSupportTicketAction,
} from "./supportDesk";

const mockedFetch = jest.mocked(authenticatedBackendFetch);
const mockedRevalidate = jest.mocked(revalidatePath);

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

describe("admin support desk actions", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    mockedRevalidate.mockReset();
  });

  it("lists the inbox with only the filters that are set", async () => {
    mockedFetch.mockResolvedValue(
      jsonResponse(200, { success: true, data: { tickets: [], pagination: { page: 2, perPage: 20, total: 0, totalPages: 1 } } }),
    );
    const result = await listSupportTicketsAction({ status: "", assignee: "unassigned", search: "export", page: 2 });
    expect(result).toEqual({ ok: true, data: { tickets: [], pagination: { page: 2, perPage: 20, total: 0, totalPages: 1 } } });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/admin\/support\/tickets\?assignee=unassigned&search=export&page=2$/);
    expect(init).toMatchObject({ cache: "no-store" });
  });

  it("surfaces the backend problem message and code without throwing", async () => {
    mockedFetch.mockResolvedValue(
      jsonResponse(404, { success: false, code: "SUPPORT_TICKET_NOT_FOUND", message: "The support ticket was not found." }),
    );
    await expect(getSupportTicketAction("abc")).resolves.toEqual({
      ok: false,
      error: "The support ticket was not found.",
      code: "SUPPORT_TICKET_NOT_FOUND",
    });

    mockedFetch.mockRejectedValue(new Error("socket hang up"));
    await expect(getSupportTicketAction("abc")).resolves.toEqual({ ok: false, error: "socket hang up" });
  });

  it("posts replies and patches as JSON and revalidates the inbox and ticket", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(201, { success: true, data: { ticket: { id: "t1" }, message: { id: "m1" } } }));
    const reply = await replySupportTicketAction("t1", { body: "On it.", status: "waiting_on_customer" });
    expect(reply.ok).toBe(true);
    const [replyUrl, replyInit] = mockedFetch.mock.calls[0];
    expect(String(replyUrl)).toMatch(/\/admin\/support\/tickets\/t1\/messages$/);
    expect(replyInit).toMatchObject({ method: "POST", body: JSON.stringify({ body: "On it.", status: "waiting_on_customer" }) });
    expect(mockedRevalidate).toHaveBeenCalledWith("/support");
    expect(mockedRevalidate).toHaveBeenCalledWith("/support/t1");

    mockedFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { id: "t1", priority: "urgent" } }));
    const patched = await updateSupportTicketAction("t1", { priority: "urgent", assigneeUserId: null });
    expect(patched).toEqual({ ok: true, data: { id: "t1", priority: "urgent" } });
    const [, patchInit] = mockedFetch.mock.calls[1];
    expect(patchInit).toMatchObject({ method: "PATCH", body: JSON.stringify({ priority: "urgent", assigneeUserId: null }) });
  });

  it("does not revalidate after a failed mutation", async () => {
    mockedFetch.mockResolvedValue(jsonResponse(403, { success: false, message: "Only DXG support agents can do that." }));
    const result = await updateSupportTicketAction("t1", { status: "closed" });
    expect(result).toMatchObject({ ok: false, error: "Only DXG support agents can do that." });
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });
});
