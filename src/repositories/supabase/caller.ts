import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  AllocationDetail,
  CommunityMembership,
  CreditAccount,
  DataHealthItem,
  DecimalString,
  EnergyAsset,
  Forecast,
  LedgerEntry,
  MapFeature,
  MarketInterval,
  MarketplaceItem,
  Offer,
  OperatorAuditEvent,
  OperatorMarketItem,
  OperatorMember,
  Page,
  PageRequest,
  Profile,
  Reservation,
  SettlementDetail,
  TariffConfig,
} from "../domain";
import { mapDatabaseError, RepositoryError, unwrap } from "../errors";
import {
  mapAsset,
  mapCommunity,
  mapCreditAccount,
  mapFeeder,
  mapForecastRpc,
  mapInterval,
  mapLedgerEntry,
  mapMembership,
  mapOffer,
  mapProfile,
  mapReservation,
  mapSelectedReading,
  mapTariff,
  mapTariffRow,
  balanceSchema,
} from "../mappers";
import type {
  AppendFeederSnapshotInput,
  AppendTariffInput,
  CreateEnergyAssetInput,
  CreateOfferInput,
  CreateReservationInput,
  SelectForecastInput,
  SelectReadingInput,
  TransitionIntervalInput,
  UpdateEnergyAssetInput,
  UpdateMembershipInput,
  UpdateOfferInput,
  UpdateProfileInput,
  UpdateReservationInput,
} from "../schemas";
import { decimal6Schema, timestampSchema, uuidSchema } from "../schemas";
import type {
  AssetRepository,
  CommunityRepository,
  EnergyDataRepository,
  LedgerRepository,
  MarketRepository,
  OperatorRepository,
  ProfileRepository,
} from "../ports";
import { decodeCursorJson, paginate } from "./paginate";

/**
 * Caller bound repositories. Every read and write goes through the cookie
 * client, so Row Level Security is authoritative and this layer never holds a
 * privileged connection. Reads use the decimal-text `own_*` views; cross
 * household and operator reads use the fixed shape functions.
 */

type Row = Record<string, unknown>;

/** Rows arrive from PostgREST as plain JSON; mappers validate the shape. */
function rows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function requireUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new RepositoryError(
      "forbidden",
      "There is no authenticated session.",
    );
  }
  return data.user.id;
}

/** The operator functions return camelCase JSON, not a base table row shape. */
const membershipJsonSchema = z.object({
  communityId: uuidSchema,
  userId: uuidSchema,
  memberRole: z.enum(["household", "operator"]),
  status: z.enum(["invited", "active", "suspended"]),
  marketAlias: z.string(),
  joinedAt: timestampSchema,
  updatedAt: timestampSchema,
});

const intervalJsonSchema = z.object({
  id: uuidSchema,
  communityId: uuidSchema,
  intervalStart: timestampSchema,
  intervalEnd: timestampSchema,
  status: z.string(),
  updatedAt: timestampSchema,
});

const mapMembershipJson = (value: unknown): CommunityMembership =>
  membershipJsonSchema.parse(value);
const mapIntervalJson = (value: unknown): MarketInterval =>
  intervalJsonSchema.parse(value);

const marketplaceItemSchema = z.object({
  listingId: uuidSchema,
  communityId: uuidSchema,
  intervalId: uuidSchema,
  side: z.string(),
  alias: z.string(),
  availableKwh: decimal6Schema,
  limitPrice: decimal6Schema.nullable(),
  status: z.string(),
  sourceLabel: z.string(),
  cursor: z.record(z.string(), z.string()),
});

const mapFeatureSchema = z.object({
  featureId: uuidSchema,
  latitude: z.string(),
  longitude: z.string(),
  hasSellerAvailability: z.boolean(),
  cursor: z.record(z.string(), z.string()),
});

const operatorMemberSchema = z.object({
  userId: uuidSchema,
  alias: z.string(),
  role: z.string(),
  status: z.string(),
  joinedAt: timestampSchema,
  cursor: z.record(z.string(), z.string()),
});

const dataHealthSchema = z.object({
  alias: z.string(),
  assetId: uuidSchema,
  assetType: z.string(),
  connectionStatus: z.string().nullable(),
  lastSyncAt: timestampSchema.nullable(),
  latestReadingAt: timestampSchema.nullable(),
  freshness: z.enum(["missing", "fresh", "stale"]),
  errorCode: z.string().nullable(),
  cursor: z.record(z.string(), z.string()),
});

const operatorMarketSchema = z.object({
  intervalId: uuidSchema,
  intervalStart: timestampSchema,
  side: z.string(),
  alias: z.string(),
  status: z.string(),
  quantityKwh: decimal6Schema,
  remainingKwh: decimal6Schema,
  allocatedKwh: decimal6Schema,
  settledKwh: decimal6Schema,
  cursor: z.record(z.string(), z.string()),
});

const operatorAuditSchema = z.object({
  eventId: uuidSchema,
  eventType: z.string(),
  alias: z.string().nullable(),
  subjectType: z.string(),
  requestId: z.string().nullable(),
  details: z.record(z.string(), z.unknown()),
  occurredAt: timestampSchema,
  cursor: z.record(z.string(), z.string()),
});

const byRowCursor = (item: { cursor: Record<string, string> }) => item.cursor;

/** Run one of the `setof jsonb` read functions and page over its rows. */
async function rpcPage<T extends { cursor: Record<string, string> }>(
  client: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
  page: PageRequest,
  map: (row: unknown) => T,
): Promise<Page<T>> {
  const after = decodeCursorJson(page.cursor) ?? null;
  return paginate(
    page.limit,
    async (probe) => {
      const result = await client.rpc(fn, {
        ...args,
        p_limit: probe,
        p_after: after,
      });
      if (result.error) throw mapDatabaseError(result.error);
      return rows(result.data);
    },
    map,
    byRowCursor,
  );
}

export function createProfileRepository(
  client: SupabaseClient,
): ProfileRepository {
  return {
    async getOwnProfile(): Promise<Profile | null> {
      const result = await client
        .from("own_profiles")
        .select("*")
        .maybeSingle();
      if (result.error) throw mapDatabaseError(result.error);
      return result.data ? mapProfile(result.data) : null;
    },

    async updateOwnProfile(input: UpdateProfileInput): Promise<Profile> {
      const userId = await requireUserId(client);
      const patch: Row = {};
      if (input.displayName !== undefined)
        patch.display_name = input.displayName;
      if (input.timezone !== undefined) patch.timezone = input.timezone;
      if (input.latitudeApprox !== undefined)
        patch.latitude_approx = input.latitudeApprox;
      if (input.longitudeApprox !== undefined)
        patch.longitude_approx = input.longitudeApprox;

      const written = await client
        .from("profiles")
        .update(patch)
        .eq("id", userId)
        .select("id");
      if (written.error) throw mapDatabaseError(written.error);
      if (!written.data?.length) {
        throw new RepositoryError("not_found", "The profile was not found.");
      }

      // Refetch through the owner view so decimals come back as canonical text.
      const refreshed = await client
        .from("own_profiles")
        .select("*")
        .eq("id", userId)
        .single();
      return mapProfile(unwrap(refreshed));
    },
  };
}

export function createCommunityRepository(
  client: SupabaseClient,
): CommunityRepository {
  return {
    async listOwnMemberships(): Promise<CommunityMembership[]> {
      const result = await client.from("community_members").select("*");
      if (result.error) throw mapDatabaseError(result.error);
      return rows(result.data).map(mapMembership);
    },

    async getCommunity(communityId: string) {
      const result = await client
        .from("communities")
        .select("*")
        .eq("id", communityId)
        .maybeSingle();
      if (result.error) throw mapDatabaseError(result.error);
      return result.data ? mapCommunity(result.data) : null;
    },

    listMarketplace(
      communityId: string,
      intervalId: string,
      page: PageRequest,
    ): Promise<Page<MarketplaceItem>> {
      return rpcPage(
        client,
        "read_community_marketplace",
        { p_community_id: communityId, p_market_interval_id: intervalId },
        page,
        (row) => marketplaceItemSchema.parse(row),
      );
    },

    listMapFeatures(
      communityId: string,
      from: string,
      to: string,
      page: PageRequest,
    ): Promise<Page<MapFeature>> {
      return rpcPage(
        client,
        "read_community_map",
        { p_community_id: communityId, p_from: from, p_to: to },
        page,
        (row) => mapFeatureSchema.parse(row),
      );
    },

    listOperatorMembers(
      communityId: string,
      page: PageRequest,
    ): Promise<Page<OperatorMember>> {
      return rpcPage(
        client,
        "read_operator_members",
        { p_community_id: communityId },
        page,
        (row) => operatorMemberSchema.parse(row),
      );
    },
  };
}

export function createAssetRepository(client: SupabaseClient): AssetRepository {
  return {
    listOwned(
      communityId: string,
      page: PageRequest,
    ): Promise<Page<EnergyAsset>> {
      const after = decodeCursorJson(page.cursor);
      return paginate(
        page.limit,
        async (probe) => {
          let query = client
            .from("own_assets")
            .select("*")
            .eq("community_id", communityId)
            .order("id", { ascending: true })
            .limit(probe);
          if (after?.id) query = query.gt("id", after.id);
          const result = await query;
          if (result.error) throw mapDatabaseError(result.error);
          return rows(result.data);
        },
        mapAsset,
        (asset) => ({ id: asset.id }),
      );
    },

    async getOwned(assetId: string): Promise<EnergyAsset | null> {
      const result = await client
        .from("own_assets")
        .select("*")
        .eq("id", assetId)
        .maybeSingle();
      if (result.error) throw mapDatabaseError(result.error);
      return result.data ? mapAsset(result.data) : null;
    },

    async create(input: CreateEnergyAssetInput): Promise<EnergyAsset> {
      // Spec 0002: the adapter supplies the new entity key before insert.
      const id = crypto.randomUUID();
      const userId = await requireUserId(client);
      const written = await client
        .from("energy_assets")
        .insert({
          id,
          community_id: input.communityId,
          owner_user_id: userId,
          asset_type: input.assetType,
          name: input.name,
          capacity_kw: input.capacityKw,
          tilt_degrees: input.tiltDegrees ?? null,
          azimuth_degrees: input.azimuthDegrees ?? null,
          reserve_kwh: input.reserveKwh,
        })
        .select("id");
      if (written.error) throw mapDatabaseError(written.error);

      const refreshed = await client
        .from("own_assets")
        .select("*")
        .eq("id", id)
        .single();
      return mapAsset(unwrap(refreshed));
    },

    async update(
      assetId: string,
      expectedVersion: number,
      input: UpdateEnergyAssetInput,
    ): Promise<EnergyAsset> {
      const patch: Row = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.capacityKw !== undefined) patch.capacity_kw = input.capacityKw;
      if (input.tiltDegrees !== undefined)
        patch.tilt_degrees = input.tiltDegrees;
      if (input.azimuthDegrees !== undefined)
        patch.azimuth_degrees = input.azimuthDegrees;
      if (input.reserveKwh !== undefined) patch.reserve_kwh = input.reserveKwh;
      if (input.targetStatus !== undefined) patch.status = input.targetStatus;

      const written = await client
        .from("energy_assets")
        .update(patch)
        .eq("id", assetId)
        .eq("version", expectedVersion)
        .select("id");
      if (written.error) throw mapDatabaseError(written.error);
      if (!written.data?.length) {
        throw new RepositoryError(
          "conflict",
          "The asset changed since it was read.",
        );
      }

      const refreshed = await client
        .from("own_assets")
        .select("*")
        .eq("id", assetId)
        .single();
      return mapAsset(unwrap(refreshed));
    },
  };
}

export function createEnergyDataRepository(
  client: SupabaseClient,
): EnergyDataRepository {
  return {
    async selectPreferredReading(input: SelectReadingInput) {
      const result = await client.rpc("select_preferred_energy_reading", {
        p_community_id: input.communityId,
        p_asset_id: input.assetId,
        p_market_interval_id: input.intervalId,
        p_metric: input.metric,
      });
      if (result.error) throw mapDatabaseError(result.error);
      const [first] = rows(result.data);
      return first ? mapSelectedReading(first) : null;
    },

    async selectCurrentForecast(
      input: SelectForecastInput,
    ): Promise<Forecast | null> {
      const result = await client.rpc("select_current_forecast", {
        p_community_id: input.communityId,
        p_asset_id: input.assetId,
        p_market_interval_id: input.intervalId,
        p_metric: input.metric,
        p_as_of: input.asOf,
      });
      if (result.error) throw mapDatabaseError(result.error);
      const [first] = rows(result.data);
      return first
        ? mapForecastRpc(first, input.assetId, input.intervalId, input.metric)
        : null;
    },

    async listForecasts(
      assetId: string,
      from: string,
      to: string,
      asOf: string,
      page: PageRequest,
    ): Promise<Page<Forecast>> {
      // The owner view carries interval ids, not interval times, so the window
      // is resolved against `own_intervals` first.
      const window = await client
        .from("own_intervals")
        .select("id")
        .gte("interval_start", from)
        .lt("interval_start", to);
      if (window.error) throw mapDatabaseError(window.error);
      const intervalIds = rows(window.data).map(
        (row) => (row as { id: string }).id,
      );
      if (intervalIds.length === 0) return { items: [] };

      const after = decodeCursorJson(page.cursor);
      return paginate(
        page.limit,
        async (probe) => {
          let query = client
            .from("own_forecasts")
            .select("*")
            .eq("asset_id", assetId)
            .in("market_interval_id", intervalIds)
            .lte("issued_at", asOf)
            .order("id", { ascending: true })
            .limit(probe);
          if (after?.id) query = query.gt("id", after.id);
          const result = await query;
          if (result.error) throw mapDatabaseError(result.error);
          return rows(result.data);
        },
        (row) => {
          const record = row as Record<string, string>;
          return mapForecastRpc(
            { ...record, forecast_id: record.id },
            record.asset_id,
            record.market_interval_id,
            record.metric,
          );
        },
        (forecast) => ({ id: forecast.forecastId }),
      );
    },
  };
}

export function createMarketRepository(
  client: SupabaseClient,
): MarketRepository {
  const refetchOffer = async (id: string): Promise<Offer> =>
    mapOffer(
      unwrap(await client.from("own_offers").select("*").eq("id", id).single()),
    );

  const refetchReservation = async (id: string): Promise<Reservation> =>
    mapReservation(
      unwrap(
        await client.from("own_reservations").select("*").eq("id", id).single(),
      ),
    );

  return {
    listIntervals(
      communityId: string,
      from: string,
      to: string,
      page: PageRequest,
    ): Promise<Page<MarketInterval>> {
      const after = decodeCursorJson(page.cursor);
      return paginate(
        page.limit,
        async (probe) => {
          let query = client
            .from("own_intervals")
            .select("*")
            .eq("community_id", communityId)
            .gte("interval_start", from)
            .lt("interval_start", to)
            .order("interval_start", { ascending: true })
            .order("id", { ascending: true })
            .limit(probe);
          if (after?.interval_start)
            query = query.gt("interval_start", after.interval_start);
          const result = await query;
          if (result.error) throw mapDatabaseError(result.error);
          return rows(result.data);
        },
        mapInterval,
        (interval) => ({
          interval_start: interval.intervalStart,
          id: interval.id,
        }),
      );
    },

    async getTariffForInterval(
      communityId: string,
      intervalStart: string,
    ): Promise<TariffConfig | null> {
      const parsedCommunityId = uuidSchema.parse(communityId);
      const parsedIntervalStart = timestampSchema.parse(intervalStart);
      const result = await client
        .from("own_tariffs")
        .select("*")
        .eq("community_id", parsedCommunityId)
        .lte("effective_from", parsedIntervalStart)
        .or(`effective_to.is.null,effective_to.gt.${parsedIntervalStart}`)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (result.error) throw mapDatabaseError(result.error);
      return result.data ? mapTariffRow(result.data) : null;
    },

    async createOffer(input: CreateOfferInput): Promise<Offer> {
      const id = crypto.randomUUID();
      const written = await client
        .from("offers")
        .insert({
          id,
          community_id: input.communityId,
          market_interval_id: input.intervalId,
          solar_asset_id: input.solarAssetId,
          forecast_id: input.forecastId ?? null,
          batch_id: input.batchId ?? null,
          quantity_kwh: input.quantityKwh,
          minimum_price: input.minimumPrice ?? null,
          is_manual_quantity: input.isManualQuantity,
          auto_adjust: input.autoAdjust,
        })
        .select("id");
      if (written.error) throw mapDatabaseError(written.error);
      return refetchOffer(id);
    },

    async updateOffer(
      id: string,
      expectedVersion: number,
      input: UpdateOfferInput,
    ): Promise<Offer> {
      const patch: Row = {};
      if (input.quantityKwh !== undefined)
        patch.quantity_kwh = input.quantityKwh;
      if (input.minimumPrice !== undefined)
        patch.minimum_price = input.minimumPrice;
      if (input.isManualQuantity !== undefined)
        patch.is_manual_quantity = input.isManualQuantity;
      if (input.autoAdjust !== undefined) patch.auto_adjust = input.autoAdjust;
      if (input.targetStatus !== undefined) patch.status = input.targetStatus;

      const written = await client
        .from("offers")
        .update(patch)
        .eq("id", id)
        .eq("version", expectedVersion)
        .select("id");
      if (written.error) throw mapDatabaseError(written.error);
      if (!written.data?.length) {
        throw new RepositoryError(
          "conflict",
          "The offer changed since it was read.",
        );
      }
      return refetchOffer(id);
    },

    async createReservation(
      input: CreateReservationInput,
    ): Promise<Reservation> {
      const id = crypto.randomUUID();
      const written = await client
        .from("reservations")
        .insert({
          id,
          community_id: input.communityId,
          market_interval_id: input.intervalId,
          batch_id: input.batchId ?? null,
          quantity_kwh: input.quantityKwh,
          maximum_price: input.maximumPrice ?? null,
          auto_adjust: input.autoAdjust,
        })
        .select("id");
      if (written.error) throw mapDatabaseError(written.error);
      return refetchReservation(id);
    },

    async updateReservation(
      id: string,
      expectedVersion: number,
      input: UpdateReservationInput,
    ): Promise<Reservation> {
      const patch: Row = {};
      if (input.quantityKwh !== undefined)
        patch.quantity_kwh = input.quantityKwh;
      if (input.maximumPrice !== undefined)
        patch.maximum_price = input.maximumPrice;
      if (input.autoAdjust !== undefined) patch.auto_adjust = input.autoAdjust;
      if (input.targetStatus !== undefined) patch.status = input.targetStatus;

      const written = await client
        .from("reservations")
        .update(patch)
        .eq("id", id)
        .eq("version", expectedVersion)
        .select("id");
      if (written.error) throw mapDatabaseError(written.error);
      if (!written.data?.length) {
        throw new RepositoryError(
          "conflict",
          "The reservation changed since it was read.",
        );
      }
      return refetchReservation(id);
    },

    async getAllocation(id: string): Promise<AllocationDetail | null> {
      const found = await client
        .from("own_allocations")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (found.error) throw mapDatabaseError(found.error);
      if (!found.data) return null;
      const allocation = found.data as Record<string, string>;

      const pricing = await client
        .from("pricing_snapshots")
        .select("algorithm_version, explanation")
        .eq("id", allocation.pricing_snapshot_id)
        .maybeSingle();
      if (pricing.error) throw mapDatabaseError(pricing.error);

      const settlement = await client
        .from("own_settlements")
        .select("*")
        .eq("allocation_id", id)
        .maybeSingle();
      if (settlement.error) throw mapDatabaseError(settlement.error);
      const settled = settlement.data as Record<string, string> | null;

      const snapshot = pricing.data as {
        algorithm_version: string;
        explanation: unknown;
      } | null;
      return {
        id: allocation.id,
        intervalId: allocation.market_interval_id,
        allocatedKwh: allocation.allocated_kwh,
        deliveredKwh: settled?.delivered_kwh ?? null,
        unitPrice: allocation.unit_price,
        status: allocation.status,
        algorithmVersion: snapshot?.algorithm_version ?? "",
        explanation: snapshot?.explanation ?? null,
        settlementId: settled?.id ?? null,
        settlementStatus: settled?.status ?? null,
        settledAt: settled?.settled_at ?? null,
      };
    },

    async listOwnSettlements(
      communityId: string,
      page: PageRequest,
    ): Promise<Page<SettlementDetail>> {
      const after = decodeCursorJson(page.cursor);
      const settlements = await paginate(
        page.limit,
        async (probe) => {
          let query = client
            .from("own_settlements")
            .select("*")
            .eq("community_id", communityId)
            .order("settled_at", { ascending: false })
            .order("id", { ascending: true })
            .limit(probe);
          if (after?.settled_at)
            query = query.lt("settled_at", after.settled_at);
          const result = await query;
          if (result.error) throw mapDatabaseError(result.error);
          return rows(result.data);
        },
        (row) => row as Record<string, string>,
        (row) => ({ settled_at: row.settled_at, id: row.id }),
      );

      if (settlements.items.length === 0) {
        return {
          items: [],
          ...(settlements.nextCursor
            ? { nextCursor: settlements.nextCursor }
            : {}),
        };
      }

      // Resolve interval bounds and provenance in batches rather than per row.
      const allocationIds = settlements.items.map((row) => row.allocation_id);
      const allocations = await client
        .from("own_allocations")
        .select("id, market_interval_id")
        .in("id", allocationIds);
      if (allocations.error) throw mapDatabaseError(allocations.error);
      const intervalByAllocation = new Map(
        rows(allocations.data).map((row) => {
          const record = row as { id: string; market_interval_id: string };
          return [record.id, record.market_interval_id];
        }),
      );

      const intervals = await client
        .from("own_intervals")
        .select("id, interval_start, interval_end")
        .in("id", [...new Set(intervalByAllocation.values())]);
      if (intervals.error) throw mapDatabaseError(intervals.error);
      const boundsByInterval = new Map(
        rows(intervals.data).map((row) => {
          const record = row as {
            id: string;
            interval_start: string;
            interval_end: string;
          };
          return [record.id, record];
        }),
      );

      const inputs = await client
        .from("settlement_inputs")
        .select("settlement_id, input_kind, energy_reading_id")
        .in(
          "settlement_id",
          settlements.items.map((row) => row.id),
        );
      if (inputs.error) throw mapDatabaseError(inputs.error);
      const inputsBySettlement = new Map<
        string,
        { kinds: string[]; readings: string[] }
      >();
      for (const row of rows(inputs.data)) {
        const record = row as {
          settlement_id: string;
          input_kind: string;
          energy_reading_id: string;
        };
        const entry = inputsBySettlement.get(record.settlement_id) ?? {
          kinds: [],
          readings: [],
        };
        entry.kinds.push(record.input_kind);
        entry.readings.push(record.energy_reading_id);
        inputsBySettlement.set(record.settlement_id, entry);
      }

      const items = settlements.items.map((row): SettlementDetail => {
        const intervalId = intervalByAllocation.get(row.allocation_id);
        const bounds = intervalId
          ? boundsByInterval.get(intervalId)
          : undefined;
        const provenance = inputsBySettlement.get(row.id);
        return {
          id: row.id,
          allocationId: row.allocation_id,
          intervalStart: bounds?.interval_start ?? "",
          intervalEnd: bounds?.interval_end ?? "",
          // counterpartyAlias is intentionally absent: `community_members` only
          // exposes the caller's own row, so a household cannot resolve the
          // other party's alias without a new fixed shape read function.
          deliveredKwh: row.delivered_kwh,
          unitPrice: row.unit_price,
          creditAmount: row.credit_amount,
          status: row.status,
          settledAt: row.settled_at,
          inputSources: provenance?.kinds ?? [],
          ...(provenance?.readings.length
            ? { readingIds: provenance.readings }
            : {}),
        };
      });

      return {
        items,
        ...(settlements.nextCursor
          ? { nextCursor: settlements.nextCursor }
          : {}),
      };
    },
  };
}

export function createLedgerRepository(
  client: SupabaseClient,
): LedgerRepository {
  return {
    async listOwnAccounts(communityId: string): Promise<CreditAccount[]> {
      const result = await client
        .from("own_credit_accounts")
        .select("*")
        .eq("community_id", communityId);
      if (result.error) throw mapDatabaseError(result.error);
      return rows(result.data).map(mapCreditAccount);
    },

    listOwnEntries(
      accountId: string,
      page: PageRequest,
    ): Promise<Page<LedgerEntry>> {
      const after = decodeCursorJson(page.cursor);
      return paginate(
        page.limit,
        async (probe) => {
          let query = client
            .from("own_ledger_entries")
            .select("*")
            .eq("account_id", accountId)
            .order("created_at", { ascending: false })
            .order("id", { ascending: true })
            .limit(probe);
          if (after?.created_at)
            query = query.lt("created_at", after.created_at);
          const result = await query;
          if (result.error) throw mapDatabaseError(result.error);
          return rows(result.data);
        },
        mapLedgerEntry,
        (entry) => ({ created_at: entry.createdAt, id: entry.id }),
      );
    },

    async getOwnBalance(accountId: string): Promise<DecimalString> {
      const account = await client
        .from("own_credit_accounts")
        .select("community_id")
        .eq("id", accountId)
        .single();
      const communityId = (unwrap(account) as { community_id: string })
        .community_id;

      const result = await client.rpc("read_own_credit_balances", {
        p_community_id: communityId,
      });
      if (result.error) throw mapDatabaseError(result.error);

      const balance = rows(result.data).find(
        (row) => (row as { accountId: string }).accountId === accountId,
      );
      // An account with no entry reports a canonical zero, never a missing value.
      return balance
        ? balanceSchema.parse((balance as { balance: string }).balance)
        : "0.00";
    },
  };
}

export function createOperatorRepository(
  client: SupabaseClient,
): OperatorRepository {
  return {
    listDataHealth(
      communityId: string,
      asOf: string,
      page: PageRequest,
    ): Promise<Page<DataHealthItem>> {
      return rpcPage(
        client,
        "read_operator_data_health",
        { p_community_id: communityId, p_as_of: asOf },
        page,
        (row) => dataHealthSchema.parse(row),
      );
    },

    listMarketSummary(
      communityId: string,
      page: PageRequest,
    ): Promise<Page<OperatorMarketItem>> {
      return rpcPage(
        client,
        "read_operator_market",
        { p_community_id: communityId },
        page,
        (row) => operatorMarketSchema.parse(row),
      );
    },

    listAuditEvents(
      communityId: string,
      page: PageRequest,
    ): Promise<Page<OperatorAuditEvent>> {
      return rpcPage(
        client,
        "read_operator_audit",
        { p_community_id: communityId },
        page,
        (row) => operatorAuditSchema.parse(row),
      );
    },

    async updateMembership(
      input: UpdateMembershipInput,
    ): Promise<CommunityMembership> {
      const result = await client.rpc("operator_update_membership", {
        p_community_id: input.communityId,
        p_user_id: input.userId,
        p_member_role: input.memberRole,
        p_status: input.status,
        p_request_id: input.requestId,
      });
      return mapMembershipJson(unwrap(result));
    },

    async appendTariff(input: AppendTariffInput) {
      const result = await client.rpc("operator_append_tariff", {
        p_community_id: input.communityId,
        p_feed_in_rate: input.feedInRate,
        p_retail_rate: input.retailRate,
        p_seller_margin_ratio: input.sellerMarginRatio,
        p_buyer_discount_ratio: input.buyerDiscountRatio,
        p_effective_from: input.effectiveFrom,
        p_effective_to: input.effectiveTo ?? null,
        p_request_id: input.requestId,
      });
      return mapTariff(unwrap(result));
    },

    async appendFeederSnapshot(input: AppendFeederSnapshotInput) {
      const result = await client.rpc("operator_append_feeder_snapshot", {
        p_community_id: input.communityId,
        p_market_interval_id: input.intervalId,
        p_capacity_kw: input.capacityKw,
        p_load_kw: input.loadKw,
        p_source_type: input.sourceType,
        p_scenario_key: input.scenarioKey ?? null,
        p_source_record_key: input.sourceRecordKey,
        p_observed_at: input.observedAt,
        p_request_id: input.requestId,
      });
      return mapFeeder(unwrap(result));
    },

    async transitionInterval(
      input: TransitionIntervalInput,
    ): Promise<MarketInterval> {
      const result = await client.rpc("operator_transition_interval", {
        p_community_id: input.communityId,
        p_market_interval_id: input.intervalId,
        p_target_status: input.targetStatus,
        p_request_id: input.requestId,
      });
      return mapIntervalJson(unwrap(result));
    },
  };
}
