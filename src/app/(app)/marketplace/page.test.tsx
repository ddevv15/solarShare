import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const {
  createClient,
  createCommunityRepository,
  createMarketRepository,
  getCurrentViewerState,
  loadBuyerMarketplace,
  redirect,
} = vi.hoisted(() => ({
  createClient: vi.fn(),
  createCommunityRepository: vi.fn(),
  createMarketRepository: vi.fn(),
  getCurrentViewerState: vi.fn(),
  loadBuyerMarketplace: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/app/_lib/current-viewer", () => ({ getCurrentViewerState }));
vi.mock("@/application/buyer-marketplace", () => ({ loadBuyerMarketplace }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/repositories/supabase/caller", () => ({
  createCommunityRepository,
  createMarketRepository,
}));
vi.mock("@/app/(app)/actions", () => ({
  signOut: async () => undefined,
}));
vi.mock("@/app/(app)/marketplace/reservation-form", () => ({
  ReservationForm: () => <form aria-label="Reserve local solar" />,
}));
vi.mock("next/navigation", () => ({ redirect }));

import MarketplacePage from "./page";

describe("MarketplacePage", () => {
  it("keeps wide offer content inside a named local scroll region", async () => {
    getCurrentViewerState.mockResolvedValue({
      status: "resolved",
      viewer: {
        community: {
          id: "community",
          timezone: "Asia/Kolkata",
          currency: "INR",
        },
      },
    });
    createClient.mockResolvedValue({});
    createCommunityRepository.mockReturnValue({});
    createMarketRepository.mockReturnValue({});
    loadBuyerMarketplace.mockResolvedValue({
      intervals: [
        {
          id: "interval",
          communityId: "community",
          intervalStart: "2026-09-13T06:30:00.000Z",
          intervalEnd: "2026-09-13T06:45:00.000Z",
          status: "open",
          updatedAt: "2026-09-12T12:30:00.000Z",
        },
      ],
      selectedInterval: {
        id: "interval",
        communityId: "community",
        intervalStart: "2026-09-13T06:30:00.000Z",
        intervalEnd: "2026-09-13T06:45:00.000Z",
        status: "open",
        updatedAt: "2026-09-12T12:30:00.000Z",
      },
      offers: [
        {
          listingId: "offer",
          communityId: "community",
          intervalId: "interval",
          side: "offer",
          alias: "Sun Home",
          availableKwh: "0.800000",
          limitPrice: "4.500000",
          status: "open",
          sourceLabel: "simulated",
          cursor: { listingId: "offer" },
        },
      ],
      tariff: {
        id: "tariff",
        communityId: "community",
        feedInRate: "3.500000",
        retailRate: "8.000000",
        sellerMarginRatio: "0.100000",
        buyerDiscountRatio: "0.100000",
        effectiveFrom: "2026-09-11T18:30:00.000Z",
        effectiveTo: null,
        createdBy: "operator",
        createdAt: "2026-09-11T18:30:00.000Z",
      },
    });

    const page = await MarketplacePage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('aria-label="Available local solar offers"');
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("w-full overflow-x-auto");
    expect(html).toContain("min-w-xl");
    expect(html).toContain("Interval open");
  });

  it("renders the reservation form for an open interval with offers and no reservations", async () => {
    getCurrentViewerState.mockResolvedValue({
      status: "resolved",
      viewer: {
        community: {
          id: "community",
          timezone: "Asia/Kolkata",
          currency: "INR",
        },
      },
    });
    createClient.mockResolvedValue({});
    createCommunityRepository.mockReturnValue({});
    createMarketRepository.mockReturnValue({});
    loadBuyerMarketplace.mockResolvedValue({
      intervals: [
        {
          id: "interval",
          communityId: "community",
          intervalStart: "2026-09-13T06:30:00.000Z",
          intervalEnd: "2026-09-13T06:45:00.000Z",
          status: "open",
          updatedAt: "2026-09-12T12:30:00.000Z",
        },
      ],
      selectedInterval: {
        id: "interval",
        communityId: "community",
        intervalStart: "2026-09-13T06:30:00.000Z",
        intervalEnd: "2026-09-13T06:45:00.000Z",
        status: "open",
        updatedAt: "2026-09-12T12:30:00.000Z",
      },
      offers: [
        {
          listingId: "offer",
          communityId: "community",
          intervalId: "interval",
          side: "offer",
          alias: "Sun Home",
          availableKwh: "0.800000",
          limitPrice: "4.500000",
          status: "open",
          sourceLabel: "simulated",
          cursor: { listingId: "offer" },
        },
      ],
      tariff: {
        id: "tariff",
        communityId: "community",
        feedInRate: "3.500000",
        retailRate: "8.000000",
        sellerMarginRatio: "0.100000",
        buyerDiscountRatio: "0.100000",
        effectiveFrom: "2026-09-11T18:30:00.000Z",
        effectiveTo: null,
        createdBy: "operator",
        createdAt: "2026-09-11T18:30:00.000Z",
      },
      pricingPreview: {
        outcome: "unavailable",
        reason: "missing_demand",
        explanation: {
          summary: "No active demand is available for this interval.",
        },
      },
    });

    const page = await MarketplacePage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('aria-label="Reserve local solar"');
  });
});
