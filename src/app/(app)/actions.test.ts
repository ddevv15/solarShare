import { beforeEach, describe, expect, it, vi } from "vitest";

const { authSignOut, redirect } = vi.hoisted(() => ({
  authSignOut: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signOut: authSignOut } }),
}));
vi.mock("next/navigation", () => ({ redirect }));

import { signOut } from "@/app/(app)/actions";

describe("signOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports a visible failure without redirecting when the session remains active", async () => {
    authSignOut.mockResolvedValue({ error: new Error("network unavailable") });

    await expect(signOut()).resolves.toEqual({
      error:
        "SolarShare could not sign you out. Your session may still be active. Try again before leaving this browser.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("lets the successful redirect keep its control flow behavior", async () => {
    authSignOut.mockResolvedValue({ error: null });
    redirect.mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });
});
