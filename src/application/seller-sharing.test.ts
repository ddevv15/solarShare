import { describe, expect, it, vi } from "vitest";

import {
  loadSellerSharingPlan,
  publishSellerOffer,
} from "@/application/seller-sharing";
import type { ViewerContext } from "@/application/viewer";
import type {
  Forecast,
  MarketInterval,
  Offer,
  TariffConfig,
} from "@/repositories/domain";
import type {
  EnergyDataRepository,
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
  userId: "seller",
  email: "seller@solarshare.local",
  profile: {
    id: "seller",
    displayName: "Asha Solar Home",
    latitudeApprox: null,
    longitudeApprox: null,
    timezone: "Asia/Kolkata",
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
  },
  membership: {
    communityId: "community",
    userId: "seller",
    memberRole: "household",
    status: "active",
    marketAlias: "Sun Home",
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
  assets: [
    {
      id: "solar",
      communityId: "community",
      assetType: "solar",
      name: "Rooftop",
      capacityKw: "5.000000",
      tiltDegrees: "12.000000",
      azimuthDegrees: "180.000000",
      reserveKwh: "0.200000",
      status: "active",
      version: "1",
      createdAt: "2026-09-12T00:00:00.000Z",
      updatedAt: "2026-09-12T00:00:00.000Z",
    },
    {
      id: "meter",
      communityId: "community",
      assetType: "meter",
      name: "Home meter",
      capacityKw: "10.000000",
      tiltDegrees: null,
      azimuthDegrees: null,
      reserveKwh: "0.000000",
      status: "active",
      version: "1",
      createdAt: "2026-09-12T00:00:00.000Z",
      updatedAt: "2026-09-12T00:00:00.000Z",
    },
  ],
  dashboardKind: "seller",
};

function forecast(metric: string, assetId: string): Forecast {
  return {
    forecastId: `${metric}-forecast`,
    assetId,
    intervalId: selectedInterval.id,
    metric,
    valueKwh: metric === "surplus" ? "0.580000" : "0.200000",
    confidenceLowKwh: null,
    confidenceHighKwh: null,
    sourceType: "simulated",
    modelVersion: "seed-v1",
    issuedAt: "2026-09-12T12:30:00.000Z",
  };
}

function repositories() {
  const selectCurrentForecast = vi
    .fn<EnergyDataRepository["selectCurrentForecast"]>()
    .mockImplementation(async (input) => forecast(input.metric, input.assetId));
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
  const energyData = {
    selectPreferredReading: vi.fn(),
    selectCurrentForecast,
    listForecasts: vi.fn(),
  } satisfies EnergyDataRepository;
  return { energyData, market };
}

describe("seller sharing", () => {
  it("uses the interval start as asOf for every displayed forecast", async () => {
    const dependencies = repositories();

    const plan = await loadSellerSharingPlan(viewer, dependencies, "interval");

    expect(plan.forecasts.surplus?.valueKwh).toBe("0.580000");
    expect(dependencies.energyData.selectCurrentForecast).toHaveBeenCalledTimes(
      4,
    );
    for (const [input] of dependencies.energyData.selectCurrentForecast.mock
      .calls) {
      expect(input.asOf).toBe(selectedInterval.intervalStart);
    }
    expect(
      dependencies.energyData.selectCurrentForecast.mock.calls.find(
        ([input]) => input.metric === "consumption",
      )?.[0].assetId,
    ).toBe("meter");
  });

  it("publishes an exact forecast quantity as a forecast-backed open offer", async () => {
    const dependencies = repositories();
    const draft = {
      id: "offer",
      communityId: "community",
      intervalId: "interval",
      solarAssetId: "solar",
      forecastId: "surplus-forecast",
      batchId: null,
      quantityKwh: "0.58",
      remainingKwh: "0.58",
      minimumPrice: "3.5",
      suggestedPrice: null,
      isManualQuantity: false,
      autoAdjust: false,
      status: "draft",
      version: "1",
      createdAt: "2026-09-12T12:30:00.000Z",
      updatedAt: "2026-09-12T12:30:00.000Z",
    } satisfies Offer;
    dependencies.market.submitOffer.mockResolvedValue({
      ...draft,
      status: "open",
      version: "2",
    });

    const result = await publishSellerOffer(viewer, dependencies, {
      intervalId: "interval",
      quantityKwh: "0.580000",
      minimumPrice: "3.500000",
      idempotencyKey: "10000000-0000-4000-8000-000000000001",
    });

    expect(dependencies.market.submitOffer).toHaveBeenCalledWith({
      communityId: "community",
      intervalId: "interval",
      solarAssetId: "solar",
      forecastId: "surplus-forecast",
      quantityKwh: "0.58",
      minimumPrice: "3.5",
      isManualQuantity: false,
      autoAdjust: false,
      idempotencyKey: "10000000-0000-4000-8000-000000000001",
    });
    expect(dependencies.market.submitOffer).toHaveBeenCalledTimes(1);
    expect(dependencies.market.createOffer).not.toHaveBeenCalled();
    expect(dependencies.market.updateOffer).not.toHaveBeenCalled();
    expect(result.status).toBe("open");
  });

  it("marks an edited quantity as manual", async () => {
    const dependencies = repositories();
    const draft = {
      id: "offer",
      communityId: "community",
      intervalId: "interval",
      solarAssetId: "solar",
      forecastId: "surplus-forecast",
      batchId: null,
      quantityKwh: "0.4",
      remainingKwh: "0.4",
      minimumPrice: "4",
      suggestedPrice: null,
      isManualQuantity: true,
      autoAdjust: false,
      status: "draft",
      version: "1",
      createdAt: "2026-09-12T12:30:00.000Z",
      updatedAt: "2026-09-12T12:30:00.000Z",
    } satisfies Offer;
    dependencies.market.submitOffer.mockResolvedValue({
      ...draft,
      status: "open",
    });

    await publishSellerOffer(viewer, dependencies, {
      intervalId: "interval",
      quantityKwh: "0.4",
      minimumPrice: "4",
      idempotencyKey: "10000000-0000-4000-8000-000000000002",
    });

    expect(dependencies.market.submitOffer).toHaveBeenCalledWith(
      expect.objectContaining({ isManualQuantity: true }),
    );
  });

  it("rejects a buyer before reading seller data", async () => {
    const dependencies = repositories();

    await expect(
      loadSellerSharingPlan(
        { ...viewer, dashboardKind: "buyer" },
        dependencies,
      ),
    ).rejects.toThrow("seller demo account");
    expect(dependencies.market.listIntervals).not.toHaveBeenCalled();
  });

  it("rejects a planned interval before reading forecasts or submitting", async () => {
    const dependencies = repositories();
    dependencies.market.listIntervals.mockResolvedValue({
      items: [{ ...selectedInterval, status: "planned" }],
    });

    await expect(
      publishSellerOffer(viewer, dependencies, {
        intervalId: "interval",
        quantityKwh: "0.580000",
        minimumPrice: "3.500000",
        idempotencyKey: "10000000-0000-4000-8000-000000000005",
      }),
    ).rejects.toThrow("not available");
    expect(
      dependencies.energyData.selectCurrentForecast,
    ).not.toHaveBeenCalled();
    expect(dependencies.market.submitOffer).not.toHaveBeenCalled();
  });
});
