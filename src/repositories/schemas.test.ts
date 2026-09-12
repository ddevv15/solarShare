import { describe, expect, it } from "vitest";

import {
  decimal2Schema,
  decimal6Schema,
  latitudeSchema,
  longitudeSchema,
  signedDecimal2Schema,
  updateProfileInputSchema,
} from "./schemas";

describe("decimal contracts", () => {
  it("keeps a decimal exact instead of routing it through a number", () => {
    // numeric(16,6) exceeds the IEEE-754 safe integer range, so the string form
    // is the only representation that survives the trip.
    const exact = "9999999999.123456";
    const parsed = decimal6Schema.parse(exact);

    expect(parsed).toBe(exact);
    expect(String(Number(exact))).not.toBe(exact);
  });

  it("accepts the full declared scale and rejects one digit more", () => {
    expect(decimal6Schema.parse("0.123456")).toBe("0.123456");
    expect(decimal6Schema.safeParse("0.1234567").success).toBe(false);
    expect(decimal2Schema.parse("1.04")).toBe("1.04");
    expect(decimal2Schema.safeParse("1.041").success).toBe(false);
  });

  it("rejects negative energy, prices, and ratios", () => {
    expect(decimal6Schema.safeParse("-0.200000").success).toBe(false);
  });

  it("allows a signed ledger balance so a debited account can read below zero", () => {
    expect(signedDecimal2Schema.parse("-1.04")).toBe("-1.04");
    expect(signedDecimal2Schema.parse("0.00")).toBe("0.00");
  });

  it("rejects leading zeroes and bare separators that PostgreSQL would not accept", () => {
    expect(decimal6Schema.safeParse("01.5").success).toBe(false);
    expect(decimal6Schema.safeParse(".5").success).toBe(false);
    expect(decimal6Schema.safeParse("1.").success).toBe(false);
  });
});

describe("coordinates", () => {
  it("accepts the southern and western hemispheres", () => {
    expect(latitudeSchema.parse("-33.865143")).toBe("-33.865143");
    expect(longitudeSchema.parse("-151.209900")).toBe("-151.209900");
  });

  it("accepts the demo community in Bengaluru", () => {
    expect(latitudeSchema.parse("12.930000")).toBe("12.930000");
    expect(longitudeSchema.parse("77.580000")).toBe("77.580000");
  });

  it("holds latitude to ninety and longitude to one hundred and eighty", () => {
    expect(latitudeSchema.parse("90.000000")).toBe("90.000000");
    expect(latitudeSchema.safeParse("90.000001").success).toBe(false);
    expect(longitudeSchema.parse("-180.000000")).toBe("-180.000000");
    expect(longitudeSchema.safeParse("180.000001").success).toBe(false);
  });

  it("requires both coordinates together or neither", () => {
    expect(
      updateProfileInputSchema.safeParse({ latitudeApprox: "12.930000" })
        .success,
    ).toBe(false);
    expect(
      updateProfileInputSchema.safeParse({
        latitudeApprox: "12.930000",
        longitudeApprox: "77.580000",
      }).success,
    ).toBe(true);
    expect(
      updateProfileInputSchema.safeParse({ displayName: "Asha" }).success,
    ).toBe(true);
  });
});
