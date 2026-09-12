import { describe, expect, it } from "vitest";

import {
  compareDecimalStrings,
  estimateReservation,
  multiplyDecimalStrings,
  normalizeDecimalString,
  subtractDecimalStrings,
} from "@/domain/decimal";

describe("decimal string calculations", () => {
  it("normalizes equivalent values without converting them to numbers", () => {
    expect(normalizeDecimalString("0.000000")).toBe("0");
    expect(normalizeDecimalString("4.500000")).toBe("4.5");
  });

  it("compares values with different scales exactly", () => {
    expect(compareDecimalStrings("0.580000", "0.58")).toBe(0);
    expect(compareDecimalStrings("8", "6.500000")).toBe(1);
  });

  it("multiplies exact decimal strings without floating point drift", () => {
    expect(multiplyDecimalStrings("0.2", "4.5")).toBe("0.9");
    expect(multiplyDecimalStrings("0.000001", "0.000001")).toBe(
      "0.000000000001",
    );
  });

  it("subtracts aligned decimal strings", () => {
    expect(subtractDecimalStrings("8.000000", "6.5")).toBe("1.5");
  });

  it("rejects subtraction that would produce a negative value", () => {
    expect(() => subtractDecimalStrings("3.5", "4.5")).toThrow(
      "negative value",
    );
  });

  it("calculates the buyer estimate from quantity and tariff strings", () => {
    expect(estimateReservation("0.2", "6.5", "8.0")).toEqual({
      estimatedCost: "1.3",
      estimatedSaving: "0.3",
    });
  });

  it("never reports a negative saving above the retail rate", () => {
    expect(estimateReservation("0.2", "9", "8")).toEqual({
      estimatedCost: "1.8",
      estimatedSaving: "0",
    });
  });

  it("rejects exponent notation and signed input", () => {
    expect(() => multiplyDecimalStrings("1e-2", "4")).toThrow(
      "unsigned decimal string",
    );
    expect(() => normalizeDecimalString("-1")).toThrow(
      "unsigned decimal string",
    );
  });
});
