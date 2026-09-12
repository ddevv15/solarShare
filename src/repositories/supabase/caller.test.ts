import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { createMarketRepository } from "./caller";

const ids = {
  community: "10000000-0000-4000-8000-000000000001",
  interval: "10000000-0000-4000-8000-000000000002",
  asset: "10000000-0000-4000-8000-000000000003",
  forecast: "10000000-0000-4000-8000-000000000004",
  order: "10000000-0000-4000-8000-000000000005",
  key: "10000000-0000-4000-8000-000000000006",
} as const;

const timestamp = "2026-09-12T12:30:00.000Z";

function clientReturning(row: Record<string, unknown>) {
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const rpc = vi.fn().mockResolvedValue({ data: ids.order, error: null });
  const client = { from, rpc } as unknown as SupabaseClient;

  return { client, from, rpc };
}

describe("createMarketRepository atomic submissions", () => {
  it("sends exact offer decimals and the retry key through one RPC", async () => {
    const { client, from, rpc } = clientReturning({
      id: ids.order,
      community_id: ids.community,
      market_interval_id: ids.interval,
      solar_asset_id: ids.asset,
      forecast_id: ids.forecast,
      batch_id: null,
      quantity_kwh: "9999999999.123456",
      remaining_kwh: "9999999999.123456",
      minimum_price: "8.765432",
      suggested_price: null,
      is_manual_quantity: false,
      auto_adjust: false,
      status: "open",
      version: "2",
      created_at: timestamp,
      updated_at: timestamp,
    });
    const repository = createMarketRepository(client);

    const result = await repository.submitOffer({
      communityId: ids.community,
      intervalId: ids.interval,
      solarAssetId: ids.asset,
      forecastId: ids.forecast,
      quantityKwh: "9999999999.123456",
      minimumPrice: "8.765432",
      isManualQuantity: false,
      autoAdjust: false,
      idempotencyKey: ids.key,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("submit_offer", {
      p_community_id: ids.community,
      p_market_interval_id: ids.interval,
      p_solar_asset_id: ids.asset,
      p_forecast_id: ids.forecast,
      p_quantity_kwh: "9999999999.123456",
      p_minimum_price: "8.765432",
      p_is_manual_quantity: false,
      p_auto_adjust: false,
      p_idempotency_key: ids.key,
    });
    expect(from).toHaveBeenCalledWith("own_offers");
    expect(result.id).toBe(ids.order);
  });

  it("sends exact reservation decimals and the retry key through one RPC", async () => {
    const { client, from, rpc } = clientReturning({
      id: ids.order,
      community_id: ids.community,
      market_interval_id: ids.interval,
      batch_id: null,
      quantity_kwh: "0.200000",
      remaining_kwh: "0.200000",
      maximum_price: "6.500000",
      auto_adjust: false,
      status: "active",
      version: "2",
      created_at: timestamp,
      updated_at: timestamp,
    });
    const repository = createMarketRepository(client);

    const result = await repository.submitReservation({
      communityId: ids.community,
      intervalId: ids.interval,
      quantityKwh: "0.200000",
      maximumPrice: "6.500000",
      autoAdjust: false,
      idempotencyKey: ids.key,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("submit_reservation", {
      p_community_id: ids.community,
      p_market_interval_id: ids.interval,
      p_quantity_kwh: "0.200000",
      p_maximum_price: "6.500000",
      p_auto_adjust: false,
      p_idempotency_key: ids.key,
    });
    expect(from).toHaveBeenCalledWith("own_reservations");
    expect(result.id).toBe(ids.order);
  });
});
