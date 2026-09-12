import type { PricingExplanation, PricingOutcome } from "@/domain/pricing";

export type DecimalString = string;
export type PageRequest = { limit: number; cursor?: string };
export type Page<T> = { items: T[]; nextCursor?: string };

export type Profile = {
  id: string;
  displayName: string;
  latitudeApprox: DecimalString | null;
  longitudeApprox: DecimalString | null;
  timezone: string;
  createdAt: string;
  updatedAt: string;
};

export type Community = {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  status: string;
};

export type CommunityMembership = {
  communityId: string;
  userId: string;
  memberRole: "household" | "operator";
  status: "invited" | "active" | "suspended";
  marketAlias: string;
  joinedAt: string;
  updatedAt: string;
};

export type CreditAccount = {
  id: string;
  communityId: string;
  currency: string;
  status: "active" | "closed";
  createdAt: string;
};

export type EnergyAsset = {
  id: string;
  communityId: string;
  assetType: "solar" | "battery" | "meter";
  name: string;
  capacityKw: DecimalString;
  tiltDegrees: DecimalString | null;
  azimuthDegrees: DecimalString | null;
  reserveKwh: DecimalString;
  status: "active" | "inactive" | "retired";
  version: string;
  createdAt: string;
  updatedAt: string;
};

export type SelectedReading = {
  readingId: string;
  valueKwh: DecimalString;
  sourceType: string;
  quality: string;
  observedAt: string;
  retrievedAt: string;
};

export type Forecast = {
  forecastId: string;
  assetId: string;
  intervalId: string;
  metric: string;
  valueKwh: DecimalString;
  confidenceLowKwh: DecimalString | null;
  confidenceHighKwh: DecimalString | null;
  sourceType: string;
  modelVersion: string;
  issuedAt: string;
};

export type MarketInterval = {
  id: string;
  communityId: string;
  intervalStart: string;
  intervalEnd: string;
  status: string;
  updatedAt: string;
};
export type Offer = {
  id: string;
  communityId: string;
  intervalId: string;
  solarAssetId: string;
  forecastId: string | null;
  batchId: string | null;
  quantityKwh: DecimalString;
  remainingKwh: DecimalString;
  minimumPrice: DecimalString | null;
  suggestedPrice: DecimalString | null;
  isManualQuantity: boolean;
  autoAdjust: boolean;
  status: string;
  version: string;
  createdAt: string;
  updatedAt: string;
};
export type Reservation = {
  id: string;
  communityId: string;
  intervalId: string;
  batchId: string | null;
  quantityKwh: DecimalString;
  remainingKwh: DecimalString;
  maximumPrice: DecimalString | null;
  autoAdjust: boolean;
  status: string;
  version: string;
  createdAt: string;
  updatedAt: string;
};
export type AllocationDetail = {
  id: string;
  intervalId: string;
  allocatedKwh: DecimalString;
  deliveredKwh: DecimalString | null;
  unitPrice: DecimalString;
  status: string;
  algorithmVersion: string;
  explanation: unknown;
  settlementId: string | null;
  settlementStatus: string | null;
  settledAt: string | null;
};
export type SettlementDetail = {
  id: string;
  allocationId: string;
  intervalStart: string;
  intervalEnd: string;
  counterpartyAlias?: string;
  deliveredKwh: DecimalString;
  unitPrice: DecimalString;
  creditAmount: DecimalString;
  status: string;
  settledAt: string;
  inputSources: string[];
  readingIds?: string[];
};
export type LedgerEntry = {
  id: string;
  accountId: string;
  entryType: "debit" | "credit";
  amount: DecimalString;
  createdAt: string;
  transactionId: string;
  settlementId: string;
};
export type TariffConfig = {
  id: string;
  communityId: string;
  feedInRate: DecimalString;
  retailRate: DecimalString;
  sellerMarginRatio: DecimalString;
  buyerDiscountRatio: DecimalString;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: string;
  createdAt: string;
};
export type FeederSnapshot = {
  id: string;
  communityId: string;
  intervalId: string;
  capacityKw: DecimalString;
  loadKw: DecimalString;
  congestionRatio: DecimalString;
  sourceType: string;
  scenarioKey: string | null;
  observedAt: string;
  createdAt: string;
};
export type IntervalPricingResult = PricingOutcome & {
  schemaVersion: "1";
  pricingSnapshotId: string | null;
  communityId: string;
  marketIntervalId: string;
  tariffConfigId: string | null;
  feederSnapshotId: string | null;
  supplyKwh: DecimalString;
  demandKwh: DecimalString;
  explanation: PricingExplanation;
};

export type MarketplaceItem = {
  listingId: string;
  communityId: string;
  intervalId: string;
  side: string;
  alias: string;
  availableKwh: DecimalString;
  limitPrice: DecimalString | null;
  status: string;
  sourceLabel: string;
  cursor: Record<string, string>;
};
export type MapFeature = {
  featureId: string;
  latitude: DecimalString;
  longitude: DecimalString;
  hasSellerAvailability: boolean;
  cursor: Record<string, string>;
};
export type OperatorMember = {
  userId: string;
  alias: string;
  role: string;
  status: string;
  joinedAt: string;
  cursor: Record<string, string>;
};
export type DataHealthItem = {
  alias: string;
  assetId: string;
  assetType: string;
  connectionStatus: string | null;
  lastSyncAt: string | null;
  latestReadingAt: string | null;
  freshness: "missing" | "fresh" | "stale";
  errorCode: string | null;
  cursor: Record<string, string>;
};
export type OperatorMarketItem = {
  intervalId: string;
  intervalStart: string;
  side: string;
  alias: string;
  status: string;
  quantityKwh: DecimalString;
  remainingKwh: DecimalString;
  allocatedKwh: DecimalString;
  settledKwh: DecimalString;
  cursor: Record<string, string>;
};
export type OperatorAuditEvent = {
  eventId: string;
  eventType: string;
  alias: string | null;
  subjectType: string;
  requestId: string | null;
  details: Record<string, unknown>;
  occurredAt: string;
  cursor: Record<string, string>;
};
export type OutboxEvent = {
  eventId: string;
  communityId: string;
  topic: string;
  aggregateType: string;
  aggregateId: string;
  revision: string;
  payload: Record<string, unknown>;
  claimToken: string;
  claimExpiresAt: string;
  attemptCount: string;
  availableAt: string;
};

/**
 * `complete_outbox_event` returns a completion summary, not the claimed event:
 * the payload and claim lease are deliberately not echoed back.
 */
export type OutboxCompletion = {
  eventId: string;
  communityId: string;
  status: string;
  attemptCount: string;
  availableAt: string;
  deliveredAt: string | null;
};

export type ResetDemoResult = {
  schemaVersion: "1";
  communityId: string;
  generationId: string;
  anchorDate: string;
  counts: Record<string, number>;
};
