import { describe, expect, it } from "vitest";

import {
  calculateIntervalPrice,
  PRICING_ALGORITHM_VERSION,
  type PricingInput,
} from "./pricing";

/**
 * The seeded community: feed in 3.5, retail 8.0, both protection ratios 0.1,
 * the normal feeder scenario at 0.48, one offer with a 4.5 minimum and four
 * reservations with a 6.5 maximum.
 */
const seeded: PricingInput = {
  currency: "INR",
  feedInRate: "3.500000",
  retailRate: "8.000000",
  sellerMarginRatio: "0.100000",
  buyerDiscountRatio: "0.100000",
  supplyKwh: "0.800000",
  demandKwh: "0.800000",
  congestionRatio: "0.480000",
  highestSellerMinimum: "4.500000",
  lowestBuyerMaximum: "6.500000",
};

const priceOf = (input: PricingInput) =>
  calculateIntervalPrice(input).unitPrice;

describe("the seeded anchor", () => {
  // 5.75 is the midpoint of 3.5 and 8.0, and it is what the seeded offer's
  // suggested_price and the historical allocation's unit_price already record.
  // If this fails the implementation is wrong, not the fixture.
  it("prices balanced supply and demand under the normal feeder at exactly 5.75", () => {
    const outcome = calculateIntervalPrice(seeded);

    expect(outcome.outcome).toBe("priced");
    expect(outcome.unitPrice).toBe("5.750000");
    expect(outcome.algorithmVersion).toBe(PRICING_ALGORITHM_VERSION);
  });

  it("reports the midpoint and the protected band in the explanation", () => {
    const { explanation } = calculateIntervalPrice(seeded);

    expect(explanation.tariff).toMatchObject({
      midpoint: "5.750000",
      protectedLowerBound: "3.950000",
      protectedUpperBound: "7.550000",
    });
  });
});

describe("determinism", () => {
  it("returns the same price and explanation for identical inputs", () => {
    const first = calculateIntervalPrice(seeded);
    const second = calculateIntervalPrice(seeded);

    expect(second).toEqual(first);
  });

  it("pins the algorithm version so a stored price stays attributable", () => {
    expect(calculateIntervalPrice(seeded).algorithmVersion).toBe(
      "linear-pressure-v1",
    );
  });
});

describe("pressure", () => {
  it("raises the price when demand exceeds supply", () => {
    const tight = priceOf({ ...seeded, demandKwh: "1.600000" });

    expect(tight).not.toBeNull();
    expect(Number(tight)).toBeGreaterThan(5.75);
  });

  it("lowers the price when supply exceeds demand", () => {
    const loose = priceOf({ ...seeded, supplyKwh: "1.600000" });

    expect(loose).not.toBeNull();
    expect(Number(loose)).toBeLessThan(5.75);
  });

  it("treats congestion at or below the threshold as neutral", () => {
    // 0.48 and 0.20 are both under 0.5, so neither should move the price.
    expect(priceOf({ ...seeded, congestionRatio: "0.200000" })).toBe(
      priceOf(seeded),
    );
  });

  it("raises the price when the feeder is constrained", () => {
    // Cross implementation vector. The seeded sharing interval carries a second
    // feeder row at 0.9 observed a minute after the normal one, and the latest
    // observation wins, so this is the case the database actually prices.
    // create_pricing_snapshot returned exactly 6.200000 for these inputs
    // against the live project; PostgreSQL and TypeScript must not drift.
    const constrained = priceOf({ ...seeded, congestionRatio: "0.900000" });

    expect(constrained).toBe("6.200000");
    expect(Number(constrained)).toBeGreaterThan(Number(priceOf(seeded)));
  });
});

describe("the executable band", () => {
  it("never prices below the highest active seller minimum", () => {
    // Heavy oversupply drives the raw price down, but the seller's floor holds.
    const outcome = calculateIntervalPrice({
      ...seeded,
      supplyKwh: "100.000000",
      demandKwh: "0.100000",
      highestSellerMinimum: "5.000000",
    });

    expect(outcome.unitPrice).toBe("5.000000");
    expect(outcome.explanation.limits?.bindingLimit).toBe("seller_minimum");
  });

  it("never prices above the lowest active buyer maximum", () => {
    const outcome = calculateIntervalPrice({
      ...seeded,
      supplyKwh: "0.100000",
      demandKwh: "100.000000",
      lowestBuyerMaximum: "6.000000",
    });

    expect(outcome.unitPrice).toBe("6.000000");
    expect(outcome.explanation.limits?.bindingLimit).toBe("buyer_maximum");
  });

  it("stays inside the tariff corridor even with no user limits", () => {
    const outcome = calculateIntervalPrice({
      ...seeded,
      supplyKwh: "0.100000",
      demandKwh: "100.000000",
      congestionRatio: "1.000000",
      highestSellerMinimum: null,
      lowestBuyerMaximum: null,
    });

    // The database trigger rejects anything outside 3.5 to 8.0; the calculation
    // must clamp before insert rather than rely on that final guard.
    expect(Number(outcome.unitPrice)).toBeGreaterThanOrEqual(3.5);
    expect(Number(outcome.unitPrice)).toBeLessThanOrEqual(8);
  });

  it("treats absent user limits as not narrowing the band", () => {
    const withLimits = calculateIntervalPrice(seeded);
    const withoutLimits = calculateIntervalPrice({
      ...seeded,
      highestSellerMinimum: null,
      lowestBuyerMaximum: null,
    });

    // 5.75 sits inside 4.5 to 6.5, so removing the limits changes nothing.
    expect(withoutLimits.unitPrice).toBe(withLimits.unitPrice);
  });
});

describe("outcomes that do not price", () => {
  it("produces no price when the seller floor sits above the buyer ceiling", () => {
    const outcome = calculateIntervalPrice({
      ...seeded,
      highestSellerMinimum: "7.000000",
      lowestBuyerMaximum: "5.000000",
    });

    expect(outcome.outcome).toBe("no_common_limit");
    expect(outcome.unitPrice).toBeNull();
  });

  it("names both bounds so a household can see why nothing priced", () => {
    const { explanation } = calculateIntervalPrice({
      ...seeded,
      highestSellerMinimum: "7.000000",
      lowestBuyerMaximum: "5.000000",
    });

    expect(explanation.limits).toMatchObject({
      highestSellerMinimum: "7.000000",
      lowestBuyerMaximum: "5.000000",
    });
  });

  it("rejects a tariff whose feed in rate is not below its retail rate", () => {
    const outcome = calculateIntervalPrice({
      ...seeded,
      feedInRate: "8.000000",
      retailRate: "8.000000",
    });

    expect(outcome.outcome).toBe("invalid_tariff");
    expect(outcome.unitPrice).toBeNull();
    expect(outcome.explanation.reason).toBeTruthy();
  });

  it("reports a missing feeder reading as a missing input", () => {
    const outcome = calculateIntervalPrice({
      ...seeded,
      congestionRatio: null,
    });

    expect(outcome.unitPrice).toBeNull();
    expect(outcome.outcome).toBe("missing_input");
  });

  it("reports zero active supply as a missing input rather than pricing it", () => {
    const outcome = calculateIntervalPrice({ ...seeded, supplyKwh: "0" });

    expect(outcome.unitPrice).toBeNull();
    expect(outcome.outcome).toBe("missing_input");
  });
});

describe("exactness", () => {
  it("returns every price at six decimal places", () => {
    expect(calculateIntervalPrice(seeded).unitPrice).toMatch(/^\d+\.\d{6}$/);
  });

  it("survives a quantity far beyond the safe integer range", () => {
    // 9007199254740993 is the first integer a double cannot represent, so a
    // float implementation would silently disagree here.
    const outcome = calculateIntervalPrice({
      ...seeded,
      supplyKwh: "9007199254740993.000000",
      demandKwh: "9007199254740993.000000",
    });

    expect(outcome.unitPrice).toBe("5.750000");
  });
});
