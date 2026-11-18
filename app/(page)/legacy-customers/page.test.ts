jest.mock("server-only", () => ({}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/server/backendClient", () => ({
  authenticatedBackendFetch: jest.fn(),
}));

import { auth } from "@/auth";
import type { CustomerPage } from "@/lib/legacyCustomers/placement";
import { authenticatedBackendFetch } from "@/lib/server/backendClient";
import LegacyCustomersPage from "./page";

// The list page as the server renders it, with the real action behind it and the backend
// mocked: what it hands to the browser is one page of the list, from one backend read.

const mockedFetch = jest.mocked(authenticatedBackendFetch);
const mockedAuth = auth as unknown as jest.Mock;

const customers = Array.from({ length: 120 }, (_, index) => ({
  userId: (index + 1).toString(16).padStart(24, "0"),
  name: `Customer ${index + 1}`,
  email: `customer${index + 1}@example.com`,
  company: null,
  proposalCount: 120 - index,
}));
const answer = (rows: unknown[]) => ({ ok: true, status: 200, json: async () => ({ success: true, data: { customers: rows } }), headers: { get: () => null } }) as unknown as Response;

type Element = { type: unknown; key?: unknown; props: Record<string, unknown> };
const isElement = (value: unknown): value is Element => typeof value === "object" && value !== null && "props" in value && "type" in value;
/** Every element the page returns, without rendering its components. */
const elements = (node: unknown): Element[] => {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isElement(node)) return [];
  return [node, ...elements(node.props.children)];
};
const render = async (searchParams?: Record<string, string | string[]>) => {
  const tree = await LegacyCustomersPage({ searchParams: searchParams ? Promise.resolve(searchParams) : undefined });
  const found = elements(tree);
  return { found, lists: found.filter((element) => "initial" in element.props), serialized: JSON.stringify(found.map((element) => element.props)) };
};

beforeEach(() => {
  mockedFetch.mockReset();
  mockedAuth.mockReset();
  mockedAuth.mockResolvedValue({ user: { role: "admin" } });
  mockedFetch.mockResolvedValue(answer(customers));
});

describe("the Legacy customers list page", () => {
  it("hands the browser at most one page of 50 customers, from one backend read", async () => {
    const { lists, serialized } = await render();
    expect(lists).toHaveLength(1);
    const page = lists[0].props.initial as CustomerPage;
    expect(page.customers).toHaveLength(50);
    expect(page).toMatchObject({ total: 120, matching: 120, page: 1, pageCount: 3, search: "" });
    // The 51st customer and everyone after are nowhere in what the page returns.
    expect(serialized).toMatch(/customer50@example\.com/);
    expect(serialized).not.toMatch(/customer51@example\.com|customer120@example\.com|Customer 87\b/);
    expect(Object.keys(lists[0].props).sort()).toEqual(["initial"]);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("shows the page ?page= names, and only that page", async () => {
    const { lists, serialized } = await render({ page: "3" });
    const page = lists[0].props.initial as CustomerPage;
    expect(page.page).toBe(3);
    expect(page.customers.map((customer) => customer.email)).toEqual(customers.slice(100).map((customer) => customer.email));
    expect(serialized).not.toMatch(/customer100@example\.com|customer1@example\.com/);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it.each([[{ page: "abc" }], [{ page: "2; drop" }], [{ page: ["2", "3"] }], [{ page: "-1" }], [{}]])("takes %p as the first page", async (searchParams) => {
    const { lists } = await render(searchParams);
    expect((lists[0].props.initial as CustomerPage).page).toBe(1);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("ignores a search put in the address: the list is not narrowed and the text goes nowhere", async () => {
    const { lists } = await render({ page: "2", search: "customer7@example.com", q: "customer7@example.com" });
    expect(lists[0].props.initial as CustomerPage).toMatchObject({ page: 2, search: "", matching: 120 });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(String(mockedFetch.mock.calls[0][0])).toMatch(/\/api\/admin\/legacy-customers$/);
    expect(JSON.stringify(mockedFetch.mock.calls)).not.toMatch(/customer7/);
  });

  it("asks the backend only for the list, uncached", async () => {
    await render({ page: "2" });
    expect(String(mockedFetch.mock.calls[0][0])).toMatch(/\/api\/admin\/legacy-customers$/);
    expect(mockedFetch.mock.calls[0][1]).toMatchObject({ method: "GET", cache: "no-store" });
  });

  it("shows the refusal and no list when the read is refused, still with one read", async () => {
    mockedFetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({ code: "PLACEMENT_RATE_LIMITED" }), headers: { get: () => "60" } } as unknown as Response);
    const { lists, found } = await render();
    expect(lists).toHaveLength(0);
    expect(found.some((element) => element.props.failure === "rate_limited" && element.props.retryAfterSeconds === 60)).toBe(true);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("sends nothing for a session that is not staff", async () => {
    mockedAuth.mockResolvedValue({ user: { role: "planner" } });
    const { lists, found } = await render();
    expect(lists).toHaveLength(0);
    expect(found.some((element) => element.props.failure === "forbidden")).toBe(true);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  // The list keeps what it was first given (useActionState reads its initial value once), so it
  // must be a new list for every server read, not only for every page number: otherwise a fresh
  // read of the same page spends a backend read and leaves the old rows or an old search on screen.
  it("keys the list on the server read, so a second read of the same page number replaces what is shown", async () => {
    const first = await render({ page: "2" });
    mockedFetch.mockResolvedValue(answer(customers.slice(0, 70)));
    const second = await render({ page: "2" });
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect((first.lists[0].props.initial as CustomerPage).page).toBe(2);
    expect((second.lists[0].props.initial as CustomerPage).page).toBe(2);
    const keys = [first.lists[0].key, second.lists[0].key];
    for (const key of keys) expect(key).toEqual(expect.stringMatching(/^2:[0-9a-f-]{36}$/));
    expect(keys[0]).not.toBe(keys[1]);
    // Unchanged rows are no exception: the key is the read, not what it returned.
    const third = await render({ page: "2" });
    expect(third.lists[0].key).not.toBe(second.lists[0].key);
    expect(new Set([...keys, third.lists[0].key, (await render()).lists[0].key]).size).toBe(4);
    // The key carries the page number and a random id: nothing of the list.
    expect(JSON.stringify(keys)).not.toMatch(/customer|example\.com/i);
  });
});
