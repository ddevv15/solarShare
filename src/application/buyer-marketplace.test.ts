import { describe, expect, it, vi } from "vitest";

import {
  loadBuyerMarketplace,
  submitBuyerReservation,
} from "@/application/buyer-marketplace";
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

function repositories() {
  const community = {
    listOwnMemberships: vi.fn(),
    getCommunity: vi.fn(),
    listMarketplace: vi.fn().mockResolvedValue({
      items: [offer, competingReservation],
    }),
    listMapFeatures: vi.fn(),
    listOperatorMembers: vi.fn(),
  } satisfies CommunityRepository;
  const market = {
    listIntervals: vi.fn().mockResolvedValue({ items: [selectedInterval] }),
    getTariffForInterval: vi.fn().mockResolvedValue(tariff),
    getFeederForInterval: vi.fn(),
    createOffer: vi.fn(),
    updateOffer: vi.fn(),
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
    dependencies.market.createReservation.mockResolvedValue(pending);
    dependencies.market.updateReservation.mockResolvedValue({
      ...pending,
      status: "active",
      version: "2",
    });

    const result = await submitBuyerReservation(viewer, dependencies, {
      intervalId: "interval",
      quantityKwh: "0.200000",
      maximumPrice: "6.500000",
    });

    expect(dependencies.market.createReservation).toHaveBeenCalledWith({
      communityId: "community",
      intervalId: "interval",
      quantityKwh: "0.2",
      maximumPrice: "6.5",
      autoAdjust: false,
    });
    expect(dependencies.market.updateReservation).toHaveBeenCalledWith(
      "reservation",
      1,
      { targetStatus: "active" },
    );
    expect(result.status).toBe("active");
  });

  it("rejects an interval id outside the loaded planning day", async () => {
    const dependencies = repositories();

    await expect(
      submitBuyerReservation(viewer, dependencies, {
        intervalId: "tampered",
        quantityKwh: "0.2",
        maximumPrice: "6.5",
      }),
    ).rejects.toThrow("not available");
    expect(dependencies.market.createReservation).not.toHaveBeenCalled();
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
});
