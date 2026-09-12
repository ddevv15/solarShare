import { describe, expect, it, vi } from "vitest";

import {
  loadBuyerMarketplace,
  submitBuyerReservation,
} from "@/application/buyer-marketplace";
import { calculateMarketplacePreview } from "@/application/pricing";
import type { ViewerContext } from "@/application/viewer";
import type {
  MarketInterval,
  MarketplaceItem,
  Reservation,
  TariffConfig,
} from "@/repositories/domain";
import type {
  CommunityRepository,
  MarketRepository,
} from "@/repositories/ports";

const selectedInterval: MarketInterval = {
  id: "interval",
  communityId: "community",
  intervalStart: "2026-09-13T06:30:00.000Z",
  intervalEnd: "2026-09-13T06:45:00.000Z",
  status: "open",
  updatedAt: "2026-09-12T12:30:00.000Z",
};

const tariff: TariffConfig = {
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
};

const viewer: ViewerContext = {
  userId: "buyer",
  email: "buyer1@solarshare.local",
  profile: {
    id: "buyer",
    displayName: "Ravi Buyer",
    latitudeApprox: null,
    longitudeApprox: null,
    timezone: "Asia/Kolkata",
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
  },
  membership: {
    communityId: "community",
    userId: "buyer",
    memberRole: "household",
    status: "active",
    marketAlias: "Lotus Home",
    joinedAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
  },
  community: {
    id: "community",
    name: "SolarShare Nagar",
    timezone: "Asia/Kolkata",
    currency: "INR",
    status: "active",
  },
  assets: [],
  dashboardKind: "buyer",
};

const offer: MarketplaceItem = {
  listingId: "offer-listing",
  communityId: "community",
  intervalId: "interval",
  side: "offer",
  alias: "Sun Home",
  availableKwh: "0.800000",
  limitPrice: "4.500000",
  status: "open",
  sourceLabel: "simulated",
  cursor: { listingId: "offer-listing" },
};

const competingReservation: MarketplaceItem = {
  ...offer,
  listingId: "reservation-listing",
  side: "reservation",
  alias: "Mango Home",
  availableKwh: "0.200000",
  limitPrice: "6.500000",
  status: "active",
  sourceLabel: "manual",
};

const pricingPreview = calculateMarketplacePreview({
  currency: viewer.community.currency,
  tariff,
  feeder: null,
  listings: [offer, competingReservation],
});

function repositories() {
  const community = {
    listOwnMemberships: vi.fn(),
    getCommunity: vi.fn(),
    getMarketplacePricingPreview: vi.fn().mockResolvedValue(pricingPreview),
    listMarketplace: vi.fn().mockResolvedValue({
      items: [offer, competingReservation],
    }),
    listMapFeatures: vi.fn(),
    listOperatorMembers: vi.fn(),
  } satisfies CommunityRepository;
  const market = {
    listIntervals: vi.fn().mockResolvedValue({ items: [selectedInterval] }),
    getTariffForInterval: vi.fn().mockResolvedValue(tariff),
    submitOffer: vi.fn(),
    createOffer: vi.fn(),
    updateOffer: vi.fn(),
    submitReservation: vi.fn(),
    createReservation: vi.fn(),
    updateReservation: vi.fn(),
    getAllocation: vi.fn(),
    listOwnSettlements: vi.fn(),
  } satisfies MarketRepository;
  return { community, market };
}

describe("buyer marketplace", () => {
  it("shows only seller availability for the selected interval", async () => {
    const dependencies = repositories();

    const result = await loadBuyerMarketplace(viewer, dependencies, "interval");

    expect(result.offers).toEqual([offer]);
    expect(dependencies.community.listMarketplace).toHaveBeenCalledWith(
      "community",
      "interval",
      { limit: 100 },
    );
    expect(dependencies.market.getTariffForInterval).toHaveBeenCalledWith(
      "community",
      selectedInterval.intervalStart,
    );
    expect(
      dependencies.community.getMarketplacePricingPreview,
    ).toHaveBeenCalledWith("community", "interval");
  });

  it("uses the authoritative aggregate when active orders exceed one page", async () => {
    const dependencies = repositories();
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      ...offer,
      listingId: `offer-${index}`,
      availableKwh: "1.000000",
    }));
    const orderBeyondFirstPage = {
      ...competingReservation,
      availableKwh: "100.000000",
    };
    const feeder = {
      id: "feeder",
      communityId: "community",
      intervalId: "interval",
      capacityKw: "10.000000",
      loadKw: "4.000000",
      congestionRatio: "0.400000",
      sourceType: "simulated",
      scenarioKey: null,
      observedAt: selectedInterval.intervalStart,
      createdAt: selectedInterval.intervalStart,
    };
    const authoritativePreview = calculateMarketplacePreview({
      currency: viewer.community.currency,
      tariff,
      feeder,
      listings: [...firstPage, orderBeyondFirstPage],
    });
    const subsetPreview = calculateMarketplacePreview({
      currency: viewer.community.currency,
      tariff,
      feeder,
      listings: firstPage,
    });
    dependencies.community.listMarketplace.mockResolvedValue({
      items: firstPage,
      nextCursor: "more-orders",
    });
    dependencies.community.getMarketplacePricingPreview.mockResolvedValue(
      authoritativePreview,
    );

    const result = await loadBuyerMarketplace(viewer, dependencies, "interval");

    expect(authoritativePreview).not.toEqual(subsetPreview);
    expect(result.offers).toHaveLength(100);
    expect(result.pricingPreview).toEqual(authoritativePreview);
  });

  it("activates a submitted reservation so it can enter matching", async () => {
    const dependencies = repositories();
    const pending = {
      id: "reservation",
      communityId: "community",
      intervalId: "interval",
      batchId: null,
      quantityKwh: "0.2",
      remainingKwh: "0.2",
      maximumPrice: "6.5",
      autoAdjust: false,
      status: "pending",
      version: "1",
      createdAt: "2026-09-12T12:30:00.000Z",
      updatedAt: "2026-09-12T12:30:00.000Z",
    } satisfies Reservation;
    dependencies.market.submitReservation.mockResolvedValue({
      ...pending,
      status: "active",
      version: "2",
    });

    const result = await submitBuyerReservation(viewer, dependencies, {
      intervalId: "interval",
      quantityKwh: "0.200000",
      maximumPrice: "6.500000",
      idempotencyKey: "10000000-0000-4000-8000-000000000003",
    });

    expect(dependencies.market.submitReservation).toHaveBeenCalledWith({
      communityId: "community",
      intervalId: "interval",
      quantityKwh: "0.2",
      maximumPrice: "6.5",
      autoAdjust: false,
      idempotencyKey: "10000000-0000-4000-8000-000000000003",
    });
    expect(dependencies.market.submitReservation).toHaveBeenCalledTimes(1);
    expect(dependencies.market.createReservation).not.toHaveBeenCalled();
    expect(dependencies.market.updateReservation).not.toHaveBeenCalled();
    expect(result.status).toBe("active");
  });

  it("rejects an interval id outside the loaded planning day", async () => {
    const dependencies = repositories();

    await expect(
      submitBuyerReservation(viewer, dependencies, {
        intervalId: "tampered",
        quantityKwh: "0.2",
        maximumPrice: "6.5",
        idempotencyKey: "10000000-0000-4000-8000-000000000004",
      }),
    ).rejects.toThrow("not available");
    expect(dependencies.market.submitReservation).not.toHaveBeenCalled();
  });

  it("rejects a seller before reading marketplace data", async () => {
    const dependencies = repositories();

    await expect(
      loadBuyerMarketplace(
        { ...viewer, dashboardKind: "seller" },
        dependencies,
      ),
    ).rejects.toThrow("buyer demo account");
    expect(dependencies.market.listIntervals).not.toHaveBeenCalled();
  });

  it("rejects a planned interval before reading listings or submitting", async () => {
    const dependencies = repositories();
    dependencies.market.listIntervals.mockResolvedValue({
      items: [{ ...selectedInterval, status: "planned" }],
    });

    await expect(
      submitBuyerReservation(viewer, dependencies, {
        intervalId: "interval",
        quantityKwh: "0.2",
        maximumPrice: "6.5",
        idempotencyKey: "10000000-0000-4000-8000-000000000006",
      }),
    ).rejects.toThrow("not available");
    expect(dependencies.community.listMarketplace).not.toHaveBeenCalled();
    expect(dependencies.market.submitReservation).not.toHaveBeenCalled();
  });
});
