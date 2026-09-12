import { z } from "zod";

import type {
  Community,
  CommunityMembership,
  CreditAccount,
  EnergyAsset,
  FeederSnapshot,
  Forecast,
  LedgerEntry,
  MarketInterval,
  Offer,
  Profile,
  Reservation,
  SelectedReading,
  TariffConfig,
} from "./domain";
import {
  decimal2Schema,
  decimal6Schema,
  latitudeSchema,
  longitudeSchema,
  signedDecimal2Schema,
  timestampSchema,
  uuidSchema,
} from "./schemas";

const nullableDecimal = decimal6Schema.nullable();
const rowBase = { id: uuidSchema, created_at: timestampSchema };

const profileRowSchema = z.object({
  ...rowBase,
  display_name: z.string(),
  latitude_approx: latitudeSchema.nullable(),
  longitude_approx: longitudeSchema.nullable(),
  timezone: z.string(),
  updated_at: timestampSchema,
});
export const mapProfile = (value: unknown): Profile => {
  const row = profileRowSchema.parse(value);
  return {
    id: row.id,
    displayName: row.display_name,
    latitudeApprox: row.latitude_approx,
    longitudeApprox: row.longitude_approx,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const membershipRowSchema = z.object({
  community_id: uuidSchema,
  user_id: uuidSchema,
  member_role: z.enum(["household", "operator"]),
  status: z.enum(["invited", "active", "suspended"]),
  market_alias: z.string(),
  joined_at: timestampSchema,
  updated_at: timestampSchema,
});
export const mapMembership = (value: unknown): CommunityMembership => {
  const row = membershipRowSchema.parse(value);
  return {
    communityId: row.community_id,
    userId: row.user_id,
    memberRole: row.member_role,
    status: row.status,
    marketAlias: row.market_alias,
    joinedAt: row.joined_at,
    updatedAt: row.updated_at,
  };
};

const communityRowSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  timezone: z.string(),
  currency: z.string(),
  status: z.string(),
});
export const mapCommunity = (value: unknown): Community => {
  const row = communityRowSchema.parse(value);
  return {
    id: row.id,
    name: row.name,
    timezone: row.timezone,
    currency: row.currency,
    status: row.status,
  };
};

const assetRowSchema = z.object({
  ...rowBase,
  community_id: uuidSchema,
  asset_type: z.enum(["solar", "battery", "meter"]),
  name: z.string(),
  capacity_kw: decimal6Schema,
  tilt_degrees: nullableDecimal,
  azimuth_degrees: nullableDecimal,
  reserve_kwh: decimal6Schema,
  status: z.enum(["active", "inactive", "retired"]),
  version: z.string().regex(/^\d+$/),
  updated_at: timestampSchema,
});
export const mapAsset = (value: unknown): EnergyAsset => {
  const row = assetRowSchema.parse(value);
  return {
    id: row.id,
    communityId: row.community_id,
    assetType: row.asset_type,
    name: row.name,
    capacityKw: row.capacity_kw,
    tiltDegrees: row.tilt_degrees,
    azimuthDegrees: row.azimuth_degrees,
    reserveKwh: row.reserve_kwh,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const readingRowSchema = z.object({
  reading_id: uuidSchema,
  value_kwh: decimal6Schema,
  source_type: z.string(),
  quality: z.string(),
  observed_at: timestampSchema,
  retrieved_at: timestampSchema,
});
export const mapSelectedReading = (value: unknown): SelectedReading => {
  const row = readingRowSchema.parse(value);
  return {
    readingId: row.reading_id,
    valueKwh: row.value_kwh,
    sourceType: row.source_type,
    quality: row.quality,
    observedAt: row.observed_at,
    retrievedAt: row.retrieved_at,
  };
};

const forecastRpcSchema = z.object({
  forecast_id: uuidSchema,
  value_kwh: decimal6Schema,
  confidence_low_kwh: nullableDecimal,
  confidence_high_kwh: nullableDecimal,
  source_type: z.string(),
  model_version: z.string(),
  issued_at: timestampSchema,
});
export const mapForecastRpc = (
  value: unknown,
  assetId: string,
  intervalId: string,
  metric: string,
): Forecast => {
  const row = forecastRpcSchema.parse(value);
  return {
    forecastId: row.forecast_id,
    assetId,
    intervalId,
    metric,
    valueKwh: row.value_kwh,
    confidenceLowKwh: row.confidence_low_kwh,
    confidenceHighKwh: row.confidence_high_kwh,
    sourceType: row.source_type,
    modelVersion: row.model_version,
    issuedAt: row.issued_at,
  };
};

const intervalRowSchema = z.object({
  id: uuidSchema,
  community_id: uuidSchema,
  interval_start: timestampSchema,
  interval_end: timestampSchema,
  status: z.string(),
  updated_at: timestampSchema,
});
export const mapInterval = (value: unknown): MarketInterval => {
  const row = intervalRowSchema.parse(value);
  return {
    id: row.id,
    communityId: row.community_id,
    intervalStart: row.interval_start,
    intervalEnd: row.interval_end,
    status: row.status,
    updatedAt: row.updated_at,
  };
};

const offerRowSchema = z.object({
  ...rowBase,
  community_id: uuidSchema,
  market_interval_id: uuidSchema,
  solar_asset_id: uuidSchema,
  forecast_id: uuidSchema.nullable(),
  batch_id: uuidSchema.nullable(),
  quantity_kwh: decimal6Schema,
  remaining_kwh: decimal6Schema,
  minimum_price: nullableDecimal,
  suggested_price: nullableDecimal,
  is_manual_quantity: z.boolean(),
  auto_adjust: z.boolean(),
  status: z.string(),
  version: z.string().regex(/^\d+$/),
  updated_at: timestampSchema,
});
export const mapOffer = (value: unknown): Offer => {
  const r = offerRowSchema.parse(value);
  return {
    id: r.id,
    communityId: r.community_id,
    intervalId: r.market_interval_id,
    solarAssetId: r.solar_asset_id,
    forecastId: r.forecast_id,
    batchId: r.batch_id,
    quantityKwh: r.quantity_kwh,
    remainingKwh: r.remaining_kwh,
    minimumPrice: r.minimum_price,
    suggestedPrice: r.suggested_price,
    isManualQuantity: r.is_manual_quantity,
    autoAdjust: r.auto_adjust,
    status: r.status,
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};

const reservationRowSchema = z.object({
  ...rowBase,
  community_id: uuidSchema,
  market_interval_id: uuidSchema,
  batch_id: uuidSchema.nullable(),
  quantity_kwh: decimal6Schema,
  remaining_kwh: decimal6Schema,
  maximum_price: nullableDecimal,
  auto_adjust: z.boolean(),
  status: z.string(),
  version: z.string().regex(/^\d+$/),
  updated_at: timestampSchema,
});
export const mapReservation = (value: unknown): Reservation => {
  const r = reservationRowSchema.parse(value);
  return {
    id: r.id,
    communityId: r.community_id,
    intervalId: r.market_interval_id,
    batchId: r.batch_id,
    quantityKwh: r.quantity_kwh,
    remainingKwh: r.remaining_kwh,
    maximumPrice: r.maximum_price,
    autoAdjust: r.auto_adjust,
    status: r.status,
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};

const accountRowSchema = z.object({
  ...rowBase,
  community_id: uuidSchema,
  currency: z.string(),
  status: z.enum(["active", "closed"]),
});
export const mapCreditAccount = (value: unknown): CreditAccount => {
  const r = accountRowSchema.parse(value);
  return {
    id: r.id,
    communityId: r.community_id,
    currency: r.currency,
    status: r.status,
    createdAt: r.created_at,
  };
};

const ledgerRowSchema = z.object({
  ...rowBase,
  account_id: uuidSchema,
  entry_type: z.enum(["debit", "credit"]),
  amount: decimal2Schema,
  ledger_transaction_id: uuidSchema,
  settlement_id: uuidSchema,
});
export const mapLedgerEntry = (value: unknown): LedgerEntry => {
  const r = ledgerRowSchema.parse(value);
  return {
    id: r.id,
    accountId: r.account_id,
    entryType: r.entry_type,
    amount: r.amount,
    createdAt: r.created_at,
    transactionId: r.ledger_transaction_id,
    settlementId: r.settlement_id,
  };
};

const tariffSchema = z.object({
  id: uuidSchema,
  communityId: uuidSchema,
  feedInRate: decimal6Schema,
  retailRate: decimal6Schema,
  sellerMarginRatio: decimal6Schema,
  buyerDiscountRatio: decimal6Schema,
  effectiveFrom: timestampSchema,
  effectiveTo: timestampSchema.nullable(),
  createdBy: uuidSchema,
  createdAt: timestampSchema,
});
export const mapTariff = (value: unknown): TariffConfig => {
  return tariffSchema.parse(value);
};

const feederSchema = z.object({
  id: uuidSchema,
  communityId: uuidSchema,
  intervalId: uuidSchema,
  capacityKw: decimal6Schema,
  loadKw: decimal6Schema,
  congestionRatio: decimal6Schema,
  sourceType: z.string(),
  scenarioKey: z.string().nullable(),
  observedAt: timestampSchema,
  createdAt: timestampSchema,
});
export const mapFeeder = (value: unknown): FeederSnapshot => {
  return feederSchema.parse(value);
};

export const balanceSchema = signedDecimal2Schema;
