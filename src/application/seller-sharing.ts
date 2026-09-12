import {
  compareDecimalStrings,
  normalizeDecimalString,
} from "@/domain/decimal";
import {
  listScenarioPlanningIntervals,
  selectPlanningInterval,
} from "@/application/market-planning";
import {
  requireDashboardKind,
  ViewerAccessError,
  type ViewerContext,
} from "@/application/viewer";
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

export const forecastMetrics = [
  "generation",
  "consumption",
  "reserve",
  "surplus",
] as const;

export type ForecastMetric = (typeof forecastMetrics)[number];

export type SellerSharingPlan = {
  intervals: MarketInterval[];
  selectedInterval: MarketInterval | null;
  forecasts: Record<ForecastMetric, Forecast | null>;
  tariff: TariffConfig | null;
  solarAssetId: string | null;
};

type SellerRepositories = {
  energyData: EnergyDataRepository;
  market: MarketRepository;
};

const emptyForecasts = (): Record<ForecastMetric, Forecast | null> => ({
  generation: null,
  consumption: null,
  reserve: null,
  surplus: null,
});

export async function loadSellerSharingPlan(
  viewer: ViewerContext,
  repositories: SellerRepositories,
  requestedIntervalId?: string,
): Promise<SellerSharingPlan> {
  requireDashboardKind(viewer, "seller");

  const solarAsset = viewer.assets.find(
    (asset) => asset.assetType === "solar" && asset.status === "active",
  );
  const meterAsset = viewer.assets.find(
    (asset) => asset.assetType === "meter" && asset.status === "active",
  );
  if (!solarAsset || !meterAsset) {
    throw new ViewerAccessError(
      "The seller demo requires an active solar asset and household meter.",
    );
  }

  const intervals = await listScenarioPlanningIntervals(
    repositories.market,
    viewer.community.id,
    viewer.community.timezone,
  );
  const selectedInterval = selectPlanningInterval(
    intervals,
    requestedIntervalId,
  );
  if (!selectedInterval) {
    return {
      intervals,
      selectedInterval: null,
      forecasts: emptyForecasts(),
      tariff: null,
      solarAssetId: solarAsset.id,
    };
  }

  const [generation, consumption, reserve, surplus, tariff] = await Promise.all(
    [
      repositories.energyData.selectCurrentForecast({
        communityId: viewer.community.id,
        assetId: solarAsset.id,
        intervalId: selectedInterval.id,
        metric: "generation",
        asOf: selectedInterval.intervalStart,
      }),
      repositories.energyData.selectCurrentForecast({
        communityId: viewer.community.id,
        assetId: meterAsset.id,
        intervalId: selectedInterval.id,
        metric: "consumption",
        asOf: selectedInterval.intervalStart,
      }),
      repositories.energyData.selectCurrentForecast({
        communityId: viewer.community.id,
        assetId: solarAsset.id,
        intervalId: selectedInterval.id,
        metric: "reserve",
        asOf: selectedInterval.intervalStart,
      }),
      repositories.energyData.selectCurrentForecast({
        communityId: viewer.community.id,
        assetId: solarAsset.id,
        intervalId: selectedInterval.id,
        metric: "surplus",
        asOf: selectedInterval.intervalStart,
      }),
      repositories.market.getTariffForInterval(
        viewer.community.id,
        selectedInterval.intervalStart,
      ),
    ],
  );

  return {
    intervals,
    selectedInterval,
    forecasts: { generation, consumption, reserve, surplus },
    tariff,
    solarAssetId: solarAsset.id,
  };
}

export async function publishSellerOffer(
  viewer: ViewerContext,
  repositories: SellerRepositories,
  input: {
    intervalId: string;
    quantityKwh: string;
    minimumPrice: string;
  },
): Promise<Offer> {
  const plan = await loadSellerSharingPlan(
    viewer,
    repositories,
    input.intervalId,
  );
  const interval = plan.selectedInterval;
  const surplus = plan.forecasts.surplus;

  if (
    !interval ||
    interval.id !== input.intervalId ||
    interval.status !== "open" ||
    !surplus ||
    !plan.solarAssetId
  ) {
    throw new ViewerAccessError(
      "That interval is not available for a forecast-backed offer.",
    );
  }

  const quantityKwh = normalizeDecimalString(input.quantityKwh);
  const created = await repositories.market.createOffer({
    communityId: viewer.community.id,
    intervalId: interval.id,
    solarAssetId: plan.solarAssetId,
    forecastId: surplus.forecastId,
    quantityKwh,
    minimumPrice: normalizeDecimalString(input.minimumPrice),
    isManualQuantity:
      compareDecimalStrings(quantityKwh, surplus.valueKwh) !== 0,
    autoAdjust: false,
  });

  return repositories.market.updateOffer(created.id, Number(created.version), {
    targetStatus: "open",
  });
}
