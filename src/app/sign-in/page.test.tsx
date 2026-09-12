import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentViewerState, redirect } = vi.hoisted(() => ({
  getCurrentViewerState: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/app/_lib/current-viewer", () => ({ getCurrentViewerState }));
vi.mock("@/app/(app)/actions", () => ({
  signOut: async () => undefined,
}));
vi.mock("@/app/sign-in/actions", () => ({
  signIn: async () => undefined,
}));
vi.mock("next/navigation", () => ({ redirect }));

import SignInPage from "@/app/sign-in/page";

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the sign in form when there is no session", async () => {
    getCurrentViewerState.mockResolvedValue({ status: "anonymous" });

    const page = await SignInPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(redirect).not.toHaveBeenCalled();
    expect(html).toContain("Enter the demo");
    expect(html).toContain("Sign in to SolarShare");
  });

  it("redirects only a fully resolved viewer", async () => {
    getCurrentViewerState.mockResolvedValue({
      status: "resolved",
      viewer: {},
    });
    redirect.mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      SignInPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("keeps the page reachable for an unresolved session with sign out", async () => {
    getCurrentViewerState.mockResolvedValue({
      status: "unresolved",
      email: "seller@solarshare.local",
      reason: "This account does not have an active community membership.",
    });

    const page = await SignInPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(redirect).not.toHaveBeenCalled();
    expect(html).toContain("Resolve this session");
    expect(html).toContain("Community access unavailable");
    expect(html).toContain("Sign out");
  });
});
