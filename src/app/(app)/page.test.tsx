import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { getCurrentViewerState, redirect } = vi.hoisted(() => ({
  getCurrentViewerState: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/app/_lib/current-viewer", () => ({ getCurrentViewerState }));
vi.mock("@/app/(app)/actions", () => ({
  signOut: async () => undefined,
}));
vi.mock("next/navigation", () => ({ redirect }));

import Home from "@/app/(app)/page";

describe("Home", () => {
  it("renders recovery instead of treating an unresolved session as anonymous", async () => {
    getCurrentViewerState.mockResolvedValue({
      status: "unresolved",
      email: "seller@solarshare.local",
      reason: "This account does not have an active community membership.",
    });

    const page = await Home();
    const html = renderToStaticMarkup(page);

    expect(redirect).not.toHaveBeenCalled();
    expect(html).toContain("Community access unavailable");
    expect(html).toContain("Sign out");
  });
});
