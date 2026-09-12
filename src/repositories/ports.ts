import type {
  AllocationDetail,
  Community,
  CommunityMembership,
  CreditAccount,
  DataHealthItem,
  DecimalString,
  EnergyAsset,
  FeederSnapshot,
  Forecast,
  LedgerEntry,
  IntervalPricingResult,
  MapFeature,
  MarketInterval,
  MarketplaceItem,
  Offer,
  OperatorAuditEvent,
  OperatorMarketItem,
  OperatorMember,
  OutboxCompletion,
  OutboxEvent,
  Page,
  PageRequest,
  Profile,
  Reservation,
  ResetDemoResult,
  SelectedReading,
  SettlementDetail,
  TariffConfig,
} from "./domain";
import type {
  AppendFeederSnapshotInput,
  AppendTariffInput,
  CompleteOutboxInput,
  CreateEnergyAssetInput,
  CreateOfferInput,
  CreateReservationInput,
  PostLedgerInput,
  ResetDemoInput,
  PriceIntervalInput,
  SelectForecastInput,
  SelectReadingInput,
  TransitionIntervalInput,
  UpdateEnergyAssetInput,
  UpdateMembershipInput,
  UpdateOfferInput,
  UpdateProfileInput,
  UpdateReservationInput,
} from "./schemas";

export interface ProfileRepository {
  getOwnProfile(): Promise<Profile | null>;
  updateOwnProfile(input: UpdateProfileInput): Promise<Profile>;
}

export interface CommunityRepository {
  listOwnMemberships(): Promise<CommunityMembership[]>;
  getCommunity(communityId: string): Promise<Community | null>;
  listMarketplace(
    communityId: string,
    intervalId: string,
    page: PageRequest,
  ): Promise<Page<MarketplaceItem>>;
  listMapFeatures(
    communityId: string,
    from: string,
    to: string,
    page: PageRequest,
  ): Promise<Page<MapFeature>>;
  listOperatorMembers(
    communityId: string,
    page: PageRequest,
  ): Promise<Page<OperatorMember>>;
}

export interface AssetRepository {
  listOwned(communityId: string, page: PageRequest): Promise<Page<EnergyAsset>>;
  getOwned(assetId: string): Promise<EnergyAsset | null>;
  create(input: CreateEnergyAssetInput): Promise<EnergyAsset>;
  update(
    assetId: string,
    expectedVersion: number,
    input: UpdateEnergyAssetInput,
  ): Promise<EnergyAsset>;
}

export interface EnergyDataRepository {
  selectPreferredReading(
    input: SelectReadingInput,
  ): Promise<SelectedReading | null>;
  selectCurrentForecast(input: SelectForecastInput): Promise<Forecast | null>;
  listForecasts(
    assetId: string,
    from: string,
    to: string,
    asOf: string,
    page: PageRequest,
  ): Promise<Page<Forecast>>;
}

export interface MarketRepository {
  listIntervals(
    communityId: string,
    from: string,
    to: string,
    page: PageRequest,
  ): Promise<Page<MarketInterval>>;
  getTariffForInterval(
    communityId: string,
    intervalStart: string,
  ): Promise<TariffConfig | null>;
  getFeederForInterval(
    communityId: string,
    intervalId: string,
  ): Promise<FeederSnapshot | null>;
  createOffer(input: CreateOfferInput): Promise<Offer>;
  updateOffer(
    id: string,
    expectedVersion: number,
    input: UpdateOfferInput,
  ): Promise<Offer>;
  createReservation(input: CreateReservationInput): Promise<Reservation>;
  updateReservation(
    id: string,
    expectedVersion: number,
    input: UpdateReservationInput,
  ): Promise<Reservation>;
  getAllocation(id: string): Promise<AllocationDetail | null>;
  listOwnSettlements(
    communityId: string,
    page: PageRequest,
  ): Promise<Page<SettlementDetail>>;
}

export interface LedgerRepository {
  listOwnAccounts(communityId: string): Promise<CreditAccount[]>;
  listOwnEntries(
    accountId: string,
    page: PageRequest,
  ): Promise<Page<LedgerEntry>>;
  getOwnBalance(accountId: string): Promise<DecimalString>;
}

export interface OperatorRepository {
  listDataHealth(
    communityId: string,
    asOf: string,
    page: PageRequest,
  ): Promise<Page<DataHealthItem>>;
  listMarketSummary(
    communityId: string,
    page: PageRequest,
  ): Promise<Page<OperatorMarketItem>>;
  listAuditEvents(
    communityId: string,
    page: PageRequest,
  ): Promise<Page<OperatorAuditEvent>>;
  updateMembership(input: UpdateMembershipInput): Promise<CommunityMembership>;
  appendTariff(input: AppendTariffInput): Promise<TariffConfig>;
  appendFeederSnapshot(
    input: AppendFeederSnapshotInput,
  ): Promise<FeederSnapshot>;
  transitionInterval(input: TransitionIntervalInput): Promise<MarketInterval>;
}

export interface TrustedOperationsRepository {
  priceInterval(input: PriceIntervalInput): Promise<IntervalPricingResult>;
  claimOutbox(
    workerId: string,
    limit: number,
    claimTtlSeconds: number,
  ): Promise<OutboxEvent[]>;
  completeOutbox(input: CompleteOutboxInput): Promise<OutboxCompletion>;
  postLedger(input: PostLedgerInput): Promise<string | null>;
  resetDemo(input: ResetDemoInput): Promise<ResetDemoResult>;
}
