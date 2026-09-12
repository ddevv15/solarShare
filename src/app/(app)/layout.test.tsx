import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentViewerState, redirect, usePathname } = vi.hoisted(() => ({
  getCurrentViewerState: vi.fn(),
  redirect: vi.fn(),
  usePathname: vi.fn(() => "/"),
}));

vi.mock("@/app/_lib/current-viewer", () => ({ getCurrentViewerState }));
vi.mock("@/app/(app)/actions", () => ({
  signOut: async () => ({ error: null }),
}));
vi.mock("next/navigation", () => ({ redirect, usePathname }));

import ApplicationLayout from "@/app/(app)/layout";

describe("ApplicationLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects an anonymous visitor to sign in", async () => {
    getCurrentViewerState.mockResolvedValue({ status: "anonymous" });
    redirect.mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      ApplicationLayout({ children: <p>Private dashboard</p> }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("renders recovery inside the shell for an unresolved session", async () => {
    getCurrentViewerState.mockResolvedValue({
      status: "unresolved",
      email: "seller@solarshare.local",
      reason: "This account has more than one active community membership.",
    });

    const layout = await ApplicationLayout({
      children: <p>Private dashboard</p>,
    });
    const html = renderToStaticMarkup(layout);

    expect(redirect).not.toHaveBeenCalled();
    expect(html).toContain("Community access unavailable");
    expect(html).toContain(
      "This account has more than one active community membership.",
    );
    expect(html).toContain("Sign out");
    expect(html).not.toContain("Private dashboard");
  });

  it("renders the application for a resolved viewer", async () => {
    getCurrentViewerState.mockResolvedValue({
      status: "resolved",
      viewer: {
        profile: { displayName: "Asha Solar Home" },
        membership: { marketAlias: "Sun Home" },
        community: { name: "Sunrise Community" },
      },
    });

    const layout = await ApplicationLayout({
      children: <p>Private dashboard</p>,
    });
    const html = renderToStaticMarkup(layout);

    expect(redirect).not.toHaveBeenCalled();
    expect(html).toContain("Asha Solar Home");
    expect(html).toContain("Sun Home · Sunrise Community");
    expect(html).toContain("Private dashboard");
  });
});
