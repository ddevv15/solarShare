import {
  listScenarioPlanningIntervals,
  selectPlanningInterval,
} from "@/application/market-planning";
import { calculateMarketplacePreview } from "@/application/pricing";
import {
  requireDashboardKind,
  ViewerAccessError,
  type ViewerContext,
} from "@/application/viewer";
import { normalizeDecimalString } from "@/domain/decimal";
import type { PricingOutcome } from "@/domain/pricing";
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

type BuyerRepositories = {
  community: CommunityRepository;
  market: MarketRepository;
};

export type BuyerMarketplace = {
  intervals: MarketInterval[];
  selectedInterval: MarketInterval | null;
  offers: MarketplaceItem[];
  tariff: TariffConfig | null;
  pricingPreview: PricingOutcome | null;
};

export async function loadBuyerMarketplace(
  viewer: ViewerContext,
  repositories: BuyerRepositories,
  requestedIntervalId?: string,
): Promise<BuyerMarketplace> {
  requireDashboardKind(viewer, "buyer");

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
      offers: [],
      tariff: null,
      pricingPreview: null,
    };
  }

  const [marketplace, tariff, feeder] = await Promise.all([
    repositories.community.listMarketplace(
      viewer.community.id,
      selectedInterval.id,
      { limit: 100 },
    ),
    repositories.market.getTariffForInterval(
      viewer.community.id,
      selectedInterval.intervalStart,
    ),
    repositories.market.getFeederForInterval(
      viewer.community.id,
      selectedInterval.id,
    ),
  ]);

  return {
    intervals,
    selectedInterval,
    offers: marketplace.items.filter((item) => item.side === "offer"),
    tariff,
    pricingPreview: tariff
      ? calculateMarketplacePreview({
          currency: viewer.community.currency,
          tariff,
          feeder,
          listings: marketplace.items,
        })
      : null,
  };
}

export async function submitBuyerReservation(
  viewer: ViewerContext,
  repositories: BuyerRepositories,
  input: {
    intervalId: string;
    quantityKwh: string;
    maximumPrice: string;
    idempotencyKey: string;
  },
): Promise<Reservation> {
  const marketplace = await loadBuyerMarketplace(
    viewer,
    repositories,
    input.intervalId,
  );
  const interval = marketplace.selectedInterval;

  if (
    !interval ||
    interval.id !== input.intervalId ||
    interval.status !== "open"
  ) {
    throw new ViewerAccessError(
      "That interval is not available for a reservation.",
    );
  }

  return repositories.market.submitReservation({
    communityId: viewer.community.id,
    intervalId: interval.id,
    quantityKwh: normalizeDecimalString(input.quantityKwh),
    maximumPrice: normalizeDecimalString(input.maximumPrice),
    autoAdjust: false,
    idempotencyKey: input.idempotencyKey,
  });
}
