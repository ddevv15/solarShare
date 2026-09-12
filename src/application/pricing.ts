import { addDecimalStrings, compareDecimalStrings } from "@/domain/decimal";
import { calculateIntervalPrice, type PricingOutcome } from "@/domain/pricing";
import type {
  FeederSnapshot,
  MarketplaceItem,
  TariffConfig,
} from "@/repositories/domain";
import type { TrustedOperationsRepository } from "@/repositories/ports";
import {
  priceIntervalInputSchema,
  type PriceIntervalInput,
} from "@/repositories/schemas";

function sumAvailable(items: MarketplaceItem[]): string {
  return items.reduce(
    (total, item) => addDecimalStrings(total, item.availableKwh),
    "0",
  );
}

function highestLimit(items: MarketplaceItem[]): string | null {
  return items.reduce<string | null>((highest, item) => {
    if (item.limitPrice === null) return highest;
    if (
      highest === null ||
      compareDecimalStrings(item.limitPrice, highest) > 0
    ) {
      return item.limitPrice;
    }
    return highest;
  }, null);
}

function lowestLimit(items: MarketplaceItem[]): string | null {
  return items.reduce<string | null>((lowest, item) => {
    if (item.limitPrice === null) return lowest;
    if (lowest === null || compareDecimalStrings(item.limitPrice, lowest) < 0) {
      return item.limitPrice;
    }
    return lowest;
  }, null);
}

/** Test oracle for checking database marketplace preview parity. */
export function calculateMarketplacePreview(input: {
  currency: string;
  tariff: TariffConfig;
  feeder: FeederSnapshot | null;
  listings: MarketplaceItem[];
}): PricingOutcome {
  const offers = input.listings.filter(
    (item) =>
      item.side === "offer" &&
      (item.status === "open" || item.status === "partly_matched"),
  );
  const reservations = input.listings.filter(
    (item) =>
      item.side === "reservation" &&
      (item.status === "active" || item.status === "partly_matched"),
  );

  return calculateIntervalPrice({
    currency: input.currency,
    feedInRate: input.tariff.feedInRate,
    retailRate: input.tariff.retailRate,
    sellerMarginRatio: input.tariff.sellerMarginRatio,
    buyerDiscountRatio: input.tariff.buyerDiscountRatio,
    supplyKwh: sumAvailable(offers),
    demandKwh: sumAvailable(reservations),
    congestionRatio: input.feeder?.congestionRatio ?? null,
    highestSellerMinimum: highestLimit(offers),
    lowestBuyerMaximum: lowestLimit(reservations),
  });
}

export async function priceMarketInterval(
  repository: TrustedOperationsRepository,
  input: PriceIntervalInput,
) {
  return repository.priceInterval(priceIntervalInputSchema.parse(input));
}
