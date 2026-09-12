import { describe, expect, it } from "vitest";

import { mapAsset, mapLedgerEntry, mapProfile } from "./mappers";

const profileRow = {
  id: "0b6f6f4e-2a1e-4c39-9d0f-2f4b1a3c5d6e",
  display_name: "Asha Solar Home",
  latitude_approx: "12.930000",
  longitude_approx: "77.580000",
  timezone: "Asia/Kolkata",
  created_at: "2026-09-11T18:30:00+00:00",
  updated_at: "2026-09-11T18:30:00+00:00",
};

describe("mapProfile", () => {
  it("maps the owner view row to a domain record", () => {
    const profile = mapProfile(profileRow);

    expect(profile.displayName).toBe("Asha Solar Home");
    expect(profile.latitudeApprox).toBe("12.930000");
  });

  it("accepts a household outside the northern and eastern hemispheres", () => {
    const profile = mapProfile({
      ...profileRow,
      latitude_approx: "-33.865143",
      longitude_approx: "-151.209900",
    });

    expect(profile.latitudeApprox).toBe("-33.865143");
    expect(profile.longitudeApprox).toBe("-151.209900");
  });

  it("allows a household that has not shared a location", () => {
    const profile = mapProfile({
      ...profileRow,
      latitude_approx: null,
      longitude_approx: null,
    });

    expect(profile.latitudeApprox).toBeNull();
  });

  it("rejects a coordinate the database could not have stored", () => {
    expect(() =>
      mapProfile({ ...profileRow, latitude_approx: "91.000000" }),
    ).toThrow();
  });
});

describe("mapAsset", () => {
  const assetRow = {
    id: "30000000-0000-4000-8000-000000000001",
    community_id: "10000000-0000-4000-8000-000000000001",
    asset_type: "solar",
    name: "Asha Rooftop Solar",
    capacity_kw: "5.000000",
    tilt_degrees: "12.000000",
    azimuth_degrees: "180.000000",
    reserve_kwh: "0.200000",
    status: "active",
    version: "1",
    created_at: "2026-09-11T18:30:00+00:00",
    updated_at: "2026-09-11T18:30:00+00:00",
  };

  it("keeps the bigint version as text so it cannot lose precision", () => {
    const asset = mapAsset(assetRow);

    expect(asset.version).toBe("1");
    expect(typeof asset.version).toBe("string");
  });

  it("keeps capacity and reserve as exact decimal text", () => {
    const asset = mapAsset(assetRow);

    expect(asset.capacityKw).toBe("5.000000");
    expect(asset.reserveKwh).toBe("0.200000");
  });

  it("rejects a row whose decimals arrived as JSON numbers", () => {
    expect(() => mapAsset({ ...assetRow, capacity_kw: 5 })).toThrow();
  });
});

describe("mapLedgerEntry", () => {
  it("maps a credit line and keeps the amount at two decimal places", () => {
    const entry = mapLedgerEntry({
      id: "b2d1a3c4-5e6f-4a8b-9c0d-1e2f3a4b5c6d",
      account_id: "c3e2b4d5-6f7a-4b9c-8d0e-2f3a4b5c6d7e",
      entry_type: "credit",
      amount: "1.04",
      created_at: "2026-09-11T18:31:00+00:00",
      ledger_transaction_id: "d4f3c5e6-7a8b-4c0d-9e1f-3a4b5c6d7e8f",
      settlement_id: "e5a4d6f7-8b9c-4d1e-8f2a-4b5c6d7e8f90",
    });

    expect(entry.entryType).toBe("credit");
    expect(entry.amount).toBe("1.04");
  });
});
