import { ExactRational } from "@/domain/decimal";

export const PRICING_ALGORITHM_VERSION = "linear-pressure-v1" as const;
export const PRICING_EXPLANATION_SCHEMA_VERSION = "1" as const;

const ZERO = ExactRational.fromInteger(0n);
const ONE = ExactRational.fromInteger(1n);
const HALF = ExactRational.fromDecimal("0.5");
const MARKET_WEIGHT = ExactRational.fromDecimal("0.75");
const CONGESTION_WEIGHT = ExactRational.fromDecimal("0.25");

export type PricingInput = {
  currency: string;
  feedInRate: string;
  retailRate: string;
  sellerMarginRatio: string;
  buyerDiscountRatio: string;
  supplyKwh: string;
  demandKwh: string;
  congestionRatio: string | null;
  highestSellerMinimum: string | null;
  lowestBuyerMaximum: string | null;
};

export type PricingBindingLimit =
  | "none"
  | "seller_minimum"
  | "buyer_maximum"
  | "tariff_seller_protection"
  | "tariff_buyer_protection";

type TariffExplanation = {
  feedInRate: string;
  retailRate: string;
  midpoint: string;
  protectedLowerBound: string;
  protectedUpperBound: string;
};

type MarketExplanation = {
  supplyKwh: string;
  demandKwh: string;
  pressure: string;
};

type CongestionExplanation = {
  ratio: string;
  threshold: "0.500000";
  pressure: string;
};

type LimitsExplanation = {
  highestSellerMinimum: string | null;
  lowestBuyerMaximum: string | null;
  effectiveLowerBound: string;
  effectiveUpperBound: string;
  bindingLimit: PricingBindingLimit;
};

export type PricingExplanation = {
  schemaVersion: typeof PRICING_EXPLANATION_SCHEMA_VERSION;
  summary: string;
  outcome: "priced" | "no_common_limit" | "invalid_tariff" | "missing_input";
  currency: string;
  tariff: TariffExplanation | null;
  market: MarketExplanation;
  congestion: CongestionExplanation | null;
  limits: LimitsExplanation | null;
  calculation: {
    unclampedPrice: string;
    roundedPrice: string;
    finalPrice: string;
    clampDirection: "none" | "lower" | "upper";
  } | null;
  reason: string | null;
};

export type PricingOutcome =
  | {
      algorithmVersion: typeof PRICING_ALGORITHM_VERSION;
      outcome: "priced";
      unitPrice: string;
      explanation: PricingExplanation;
    }
  | {
      algorithmVersion: typeof PRICING_ALGORITHM_VERSION;
      outcome: "no_common_limit" | "invalid_tariff" | "missing_input";
      unitPrice: null;
      explanation: PricingExplanation;
    };

function fixed(value: ExactRational): string {
  return value.roundToFixed(6);
}

function invalidTariff(
  input: PricingInput,
  reason: "tariff_values_out_of_range" | "tariff_protections_cross",
  tariff: TariffExplanation | null,
): PricingOutcome {
  const messages = {
    tariff_values_out_of_range:
      "tariff values are missing or outside their allowed ranges",
    tariff_protections_cross: "the seller and buyer tariff protections cross",
  } satisfies Record<typeof reason, string>;

  return {
    algorithmVersion: PRICING_ALGORITHM_VERSION,
    outcome: "invalid_tariff",
    unitPrice: null,
    explanation: {
      schemaVersion: PRICING_EXPLANATION_SCHEMA_VERSION,
      summary: `No price was created because the tariff configuration is invalid: ${messages[reason]}. The interval is paused for an operator to correct it.`,
      outcome: "invalid_tariff",
      currency: input.currency,
      tariff,
      market: {
        supplyKwh: fixed(ExactRational.fromDecimal(input.supplyKwh)),
        demandKwh: fixed(ExactRational.fromDecimal(input.demandKwh)),
        pressure: "0.000000",
      },
      congestion: null,
      limits: null,
      calculation: null,
      reason,
    },
  };
}

function missingInput(
  input: PricingInput,
  tariff: TariffExplanation,
  reason: "missing_feeder" | "missing_supply" | "missing_demand",
): PricingOutcome {
  const messages = {
    missing_feeder:
      "No price was created because feeder congestion data is missing.",
    missing_supply:
      "No price was created because there is no active local supply.",
    missing_demand:
      "No price was created because there is no active local demand.",
  } satisfies Record<typeof reason, string>;

  return {
    algorithmVersion: PRICING_ALGORITHM_VERSION,
    outcome: "missing_input",
    unitPrice: null,
    explanation: {
      schemaVersion: PRICING_EXPLANATION_SCHEMA_VERSION,
      summary: messages[reason],
      outcome: "missing_input",
      currency: input.currency,
      tariff,
      market: {
        supplyKwh: fixed(ExactRational.fromDecimal(input.supplyKwh)),
        demandKwh: fixed(ExactRational.fromDecimal(input.demandKwh)),
        pressure: "0.000000",
      },
      congestion: null,
      limits: null,
      calculation: null,
      reason,
    },
  };
}

function maximum(left: ExactRational, right: ExactRational): ExactRational {
  return left.compare(right) >= 0 ? left : right;
}

function minimum(left: ExactRational, right: ExactRational): ExactRational {
  return left.compare(right) <= 0 ? left : right;
}

export function calculateIntervalPrice(input: PricingInput): PricingOutcome {
  const feedIn = ExactRational.fromDecimal(input.feedInRate);
  const retail = ExactRational.fromDecimal(input.retailRate);
  const sellerMargin = ExactRational.fromDecimal(input.sellerMarginRatio);
  const buyerDiscount = ExactRational.fromDecimal(input.buyerDiscountRatio);
  const supply = ExactRational.fromDecimal(input.supplyKwh);
  const demand = ExactRational.fromDecimal(input.demandKwh);

  if (
    feedIn.compare(retail) >= 0 ||
    sellerMargin.compare(ONE) > 0 ||
    buyerDiscount.compare(ONE) > 0
  ) {
    return invalidTariff(input, "tariff_values_out_of_range", null);
  }

  const spread = retail.subtract(feedIn);
  const midpoint = feedIn.add(retail).divide(ExactRational.fromInteger(2n));
  const tariffLower = feedIn.add(spread.multiply(sellerMargin));
  const tariffUpper = retail.subtract(spread.multiply(buyerDiscount));
  const tariff: TariffExplanation = {
    feedInRate: fixed(feedIn),
    retailRate: fixed(retail),
    midpoint: fixed(midpoint),
    protectedLowerBound: fixed(tariffLower),
    protectedUpperBound: fixed(tariffUpper),
  };

  if (tariffLower.compare(tariffUpper) > 0) {
    return invalidTariff(input, "tariff_protections_cross", tariff);
  }
  if (input.congestionRatio === null) {
    return missingInput(input, tariff, "missing_feeder");
  }
  if (supply.compare(ZERO) <= 0) {
    return missingInput(input, tariff, "missing_supply");
  }
  if (demand.compare(ZERO) <= 0) {
    return missingInput(input, tariff, "missing_demand");
  }

  const congestion = ExactRational.fromDecimal(input.congestionRatio);
  if (congestion.compare(ONE) > 0) {
    throw new Error("Congestion ratio must be between zero and one.");
  }
  const congestionPressure =
    congestion.compare(HALF) <= 0
      ? ZERO
      : congestion.subtract(HALF).divide(HALF);

  const sellerMinimum = input.highestSellerMinimum
    ? ExactRational.fromDecimal(input.highestSellerMinimum)
    : null;
  const buyerMaximum = input.lowestBuyerMaximum
    ? ExactRational.fromDecimal(input.lowestBuyerMaximum)
    : null;
  const lowerBound = sellerMinimum
    ? maximum(tariffLower, sellerMinimum)
    : tariffLower;
  const upperBound = buyerMaximum
    ? minimum(tariffUpper, buyerMaximum)
    : tariffUpper;

  if (lowerBound.compare(upperBound) > 0) {
    const summary =
      sellerMinimum && buyerMaximum
        ? `No price was created because the highest seller minimum of ${input.currency} ${fixed(sellerMinimum)} per kWh is above the lowest buyer maximum of ${input.currency} ${fixed(buyerMaximum)} per kWh. Users can revise their orders.`
        : `No price was created because the effective lower limit of ${input.currency} ${fixed(lowerBound)} per kWh is above the effective upper limit of ${input.currency} ${fixed(upperBound)} per kWh. Users can revise their orders.`;
    return {
      algorithmVersion: PRICING_ALGORITHM_VERSION,
      outcome: "no_common_limit",
      unitPrice: null,
      explanation: {
        schemaVersion: PRICING_EXPLANATION_SCHEMA_VERSION,
        summary,
        outcome: "no_common_limit",
        currency: input.currency,
        tariff,
        market: {
          supplyKwh: fixed(supply),
          demandKwh: fixed(demand),
          pressure: "0.000000",
        },
        congestion: {
          ratio: fixed(congestion),
          threshold: "0.500000",
          pressure: fixed(congestionPressure),
        },
        limits: {
          highestSellerMinimum: sellerMinimum ? fixed(sellerMinimum) : null,
          lowestBuyerMaximum: buyerMaximum ? fixed(buyerMaximum) : null,
          effectiveLowerBound: fixed(lowerBound),
          effectiveUpperBound: fixed(upperBound),
          bindingLimit: "none",
        },
        calculation: null,
        reason: "order_limits_do_not_overlap",
      },
    };
  }

  const marketPressure = demand.subtract(supply).divide(demand.add(supply));
  const combinedPressure = marketPressure
    .multiply(MARKET_WEIGHT)
    .add(congestionPressure.multiply(CONGESTION_WEIGHT))
    .clamp(ExactRational.fromInteger(-1n), ONE);
  const unclamped = midpoint.add(
    combinedPressure.multiply(spread).divide(ExactRational.fromInteger(2n)),
  );
  const rounded = ExactRational.fromDecimal(unclamped.roundToFixed(6));
  const finalPrice = rounded.clamp(lowerBound, upperBound);

  let clampDirection: "none" | "lower" | "upper" = "none";
  let bindingLimit: PricingBindingLimit = "none";
  if (rounded.compare(lowerBound) < 0) {
    clampDirection = "lower";
    bindingLimit =
      sellerMinimum && sellerMinimum.compare(tariffLower) >= 0
        ? "seller_minimum"
        : "tariff_seller_protection";
  } else if (rounded.compare(upperBound) > 0) {
    clampDirection = "upper";
    bindingLimit =
      buyerMaximum && buyerMaximum.compare(tariffUpper) <= 0
        ? "buyer_maximum"
        : "tariff_buyer_protection";
  }

  const price = fixed(finalPrice);
  let summary: string;
  if (bindingLimit === "seller_minimum") {
    summary = `The price is ${input.currency} ${price} per kWh because the highest seller minimum held it at that lower limit.`;
  } else if (bindingLimit === "buyer_maximum") {
    summary = `The price is ${input.currency} ${price} per kWh because the lowest buyer maximum held it at that upper limit.`;
  } else if (bindingLimit === "tariff_seller_protection") {
    summary = `The price is ${input.currency} ${price} per kWh because the tariff seller protection set the lower limit.`;
  } else if (bindingLimit === "tariff_buyer_protection") {
    summary = `The price is ${input.currency} ${price} per kWh because the tariff buyer protection set the upper limit.`;
  } else if (
    marketPressure.compare(ZERO) === 0 &&
    congestionPressure.compare(ZERO) === 0
  ) {
    summary = `Local supply matches demand and grid import is below the congestion threshold, so the price stays at the tariff midpoint of ${input.currency} ${price} per kWh.`;
  } else {
    summary = `Local supply, demand, and grid import pressure set the price at ${input.currency} ${price} per kWh.`;
  }

  const explanation: PricingExplanation = {
    schemaVersion: PRICING_EXPLANATION_SCHEMA_VERSION,
    summary,
    outcome: "priced",
    currency: input.currency,
    tariff,
    market: {
      supplyKwh: fixed(supply),
      demandKwh: fixed(demand),
      pressure: fixed(marketPressure),
    },
    congestion: {
      ratio: fixed(congestion),
      threshold: "0.500000",
      pressure: fixed(congestionPressure),
    },
    limits: {
      highestSellerMinimum: sellerMinimum ? fixed(sellerMinimum) : null,
      lowestBuyerMaximum: buyerMaximum ? fixed(buyerMaximum) : null,
      effectiveLowerBound: fixed(lowerBound),
      effectiveUpperBound: fixed(upperBound),
      bindingLimit,
    },
    calculation: {
      unclampedPrice: fixed(unclamped),
      roundedPrice: fixed(rounded),
      finalPrice: price,
      clampDirection,
    },
    reason: null,
  };

  return {
    algorithmVersion: PRICING_ALGORITHM_VERSION,
    outcome: "priced",
    unitPrice: price,
    explanation,
  };
}
