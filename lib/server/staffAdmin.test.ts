jest.mock("server-only", () => ({}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));

import { auth } from "@/auth";
import { checkStaffAdmin, staffCheckOf } from "./staffAdmin";

const mockedAuth = auth as unknown as jest.Mock;

describe("the staff check a server action makes before calling the backend", () => {
  it("passes only a live session with an admin role, as proxy.ts does", () => {
    for (const role of ["admin", "superadmin", "super_admin", "Super_Admin"]) {
      expect(staffCheckOf({ user: { role } })).toBe("staff");
    }
    for (const role of ["planner", "owner", "organization_admin", "dxg_admin", "", undefined, null, 1]) {
      expect(staffCheckOf({ user: { role } })).toBe("not_staff");
    }
    expect(staffCheckOf(null)).toBe("signed_out");
    expect(staffCheckOf(undefined)).toBe("signed_out");
    expect(staffCheckOf({})).toBe("signed_out");
    expect(staffCheckOf({ user: null })).toBe("signed_out");
    expect(staffCheckOf({ user: { role: "admin" }, authError: "SessionExpired" })).toBe("signed_out");
  });

  it("reads the signed-in session, and treats a session that can't be read as signed out", async () => {
    mockedAuth.mockResolvedValue({ user: { role: "admin" } });
    await expect(checkStaffAdmin()).resolves.toBe("staff");
    mockedAuth.mockResolvedValue({ user: { role: "planner" } });
    await expect(checkStaffAdmin()).resolves.toBe("not_staff");
    mockedAuth.mockResolvedValue(null);
    await expect(checkStaffAdmin()).resolves.toBe("signed_out");
    mockedAuth.mockRejectedValue(new Error("no cookies here"));
    await expect(checkStaffAdmin()).resolves.toBe("signed_out");
  });
});
