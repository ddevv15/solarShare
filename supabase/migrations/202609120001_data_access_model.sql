begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create function private.validate_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'invalid timezone' using errcode = '22023';
  end if;
  return new;
end;
$$;

create function private.seed_uuid(p_seed_version text, p_record_kind text, p_stable_key text)
returns uuid
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  value text := encode(extensions.digest(convert_to(p_seed_version || ':' || p_record_kind || ':' || p_stable_key, 'UTF8'), 'sha256'), 'hex');
begin
  value := substr(value, 1, 12) || '4' || substr(value, 14, 3) || '8' || substr(value, 18, 15);
  return (substr(value, 1, 8) || '-' || substr(value, 9, 4) || '-' || substr(value, 13, 4) || '-' || substr(value, 17, 4) || '-' || substr(value, 21, 12))::uuid;
end;
$$;

create function private.opaque_uuid(p_purpose text, p_community_id uuid, p_source_id uuid)
returns uuid
language sql
immutable
strict
set search_path = ''
as $$
  select private.seed_uuid(p_purpose, lower(p_community_id::text), lower(p_source_id::text));
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null constraint profiles_display_name_not_blank check (btrim(display_name) <> ''),
  latitude_approx numeric(9,6),
  longitude_approx numeric(9,6),
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_coordinates_pair check ((latitude_approx is null) = (longitude_approx is null)),
  constraint profiles_latitude_range check (latitude_approx between -90 and 90),
  constraint profiles_longitude_range check (longitude_approx between -180 and 180)
);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null constraint communities_name_not_blank check (btrim(name) <> ''),
  join_code_hash text unique,
  timezone text not null,
  currency text not null default 'INR',
  status text not null default 'active',
  demo_seed_key text unique,
  seed_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communities_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint communities_status_values check (status in ('active', 'paused', 'archived')),
  constraint communities_demo_pair check ((demo_seed_key is null) = (seed_version is null))
);

create table public.community_members (
  community_id uuid not null references public.communities(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  member_role text not null,
  status text not null default 'active',
  market_alias text not null,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (community_id, user_id),
  unique (community_id, market_alias),
  constraint community_members_role_values check (member_role in ('household', 'operator')),
  constraint community_members_status_values check (status in ('invited', 'active', 'suspended')),
  constraint community_members_alias_not_blank check (btrim(market_alias) <> '')
);

create table public.credit_accounts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  owner_user_id uuid not null,
  currency text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (community_id, id),
  unique (community_id, owner_user_id, currency),
  foreign key (community_id, owner_user_id) references public.community_members(community_id, user_id) on delete restrict,
  constraint credit_accounts_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint credit_accounts_status_values check (status in ('active', 'closed'))
);

create table public.energy_assets (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  owner_user_id uuid not null,
  asset_type text not null,
  name text not null,
  capacity_kw numeric(12,6) not null,
  tilt_degrees numeric(9,6),
  azimuth_degrees numeric(9,6),
  reserve_kwh numeric(16,6) not null default 0,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, id),
  unique (community_id, owner_user_id, id),
  foreign key (community_id, owner_user_id) references public.community_members(community_id, user_id) on delete restrict,
  constraint energy_assets_type_values check (asset_type in ('solar', 'battery', 'meter')),
  constraint energy_assets_status_values check (status in ('active', 'inactive', 'retired')),
  constraint energy_assets_capacity_nonnegative check (capacity_kw >= 0 and capacity_kw <> 'NaN'::numeric),
  constraint energy_assets_reserve_nonnegative check (reserve_kwh >= 0 and reserve_kwh <> 'NaN'::numeric),
  constraint energy_assets_tilt_range check (tilt_degrees between 0 and 90),
  constraint energy_assets_azimuth_range check (azimuth_degrees >= 0 and azimuth_degrees < 360),
  constraint energy_assets_version_positive check (version > 0),
  constraint energy_assets_name_not_blank check (btrim(name) <> '')
);

create table public.data_connections (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  asset_id uuid not null,
  connection_type text not null,
  provider text not null,
  status text not null default 'pending',
  credentials_ref text,
  last_sync_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, id),
  unique (community_id, asset_id, id),
  foreign key (community_id, asset_id) references public.energy_assets(community_id, id) on delete restrict,
  constraint data_connections_type_values check (connection_type in ('model', 'csv', 'inverter_api', 'meter_api', 'simulator')),
  constraint data_connections_status_values check (status in ('pending', 'active', 'error', 'revoked')),
  constraint data_connections_provider_not_blank check (btrim(provider) <> '')
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  uploader_user_id uuid not null,
  asset_id uuid not null,
  storage_object_path text not null,
  file_sha256 text not null,
  status text not null default 'uploaded',
  accepted_rows bigint not null default 0,
  rejected_rows bigint not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, id),
  unique (community_id, uploader_user_id, file_sha256),
  unique (community_id, uploader_user_id, asset_id, id),
  foreign key (community_id, uploader_user_id) references public.community_members(community_id, user_id) on delete restrict,
  foreign key (community_id, asset_id) references public.energy_assets(community_id, id) on delete restrict,
  constraint import_jobs_status_values check (status in ('uploaded', 'validated', 'committed', 'failed')),
  constraint import_jobs_counts_nonnegative check (accepted_rows >= 0 and rejected_rows >= 0),
  constraint import_jobs_path_not_blank check (btrim(storage_object_path) <> ''),
  constraint import_jobs_hash_not_blank check (btrim(file_sha256) <> '')
);

create table public.market_intervals (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  interval_start timestamptz not null,
  interval_end timestamptz not null,
  status text not null default 'planned',
  scenario_generation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, id),
  unique (community_id, interval_start),
  unique (community_id, id, interval_start),
  constraint market_intervals_duration check (interval_end = interval_start + interval '15 minutes'),
  constraint market_intervals_grid check ((extract(epoch from interval_start)::bigint % 900) = 0),
  constraint market_intervals_status_values check (status in ('planned', 'open', 'paused', 'matching', 'settlement_pending', 'settled', 'cancelled'))
);

create table public.energy_readings (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  asset_id uuid not null,
  market_interval_id uuid not null,
  metric text not null,
  value_kwh numeric(16,6) not null,
  source_type text not null,
  quality text not null,
  source_record_key text not null,
  original_value numeric(16,6) not null,
  original_unit text not null,
  observed_at timestamptz not null,
  retrieved_at timestamptz not null default now(),
  data_connection_id uuid,
  import_job_id uuid,
  supersedes_id uuid,
  scenario_generation_id uuid,
  created_at timestamptz not null default now(),
  unique (community_id, id),
  unique (community_id, asset_id, market_interval_id, metric, source_type, source_record_key),
  foreign key (community_id, asset_id) references public.energy_assets(community_id, id) on delete restrict,
  foreign key (community_id, market_interval_id) references public.market_intervals(community_id, id) on delete restrict,
  foreign key (community_id, asset_id, data_connection_id) references public.data_connections(community_id, asset_id, id) on delete restrict,
  foreign key (community_id, asset_id, import_job_id) references public.import_jobs(community_id, asset_id, id) on delete restrict,
  foreign key (community_id, supersedes_id) references public.energy_readings(community_id, id) on delete restrict,
  constraint energy_readings_metric_values check (metric in ('generation', 'consumption', 'grid_import', 'grid_export', 'reserve')),
  constraint energy_readings_source_values check (source_type in ('connected', 'imported', 'modeled', 'stored_sample', 'simulated')),
  constraint energy_readings_quality_values check (quality in ('measured', 'estimated', 'corrected', 'missing')),
  constraint energy_readings_value_nonnegative check (value_kwh >= 0 and value_kwh <> 'NaN'::numeric),
  constraint energy_readings_original_nonnegative check (original_value >= 0 and original_value <> 'NaN'::numeric),
  constraint energy_readings_unit_values check (original_unit in ('kWh', 'Wh', 'kW')),
  constraint energy_readings_not_self_superseding check (supersedes_id is null or supersedes_id <> id)
);

create table public.forecasts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  asset_id uuid not null,
  market_interval_id uuid not null,
  metric text not null,
  value_kwh numeric(16,6) not null,
  confidence_low_kwh numeric(16,6),
  confidence_high_kwh numeric(16,6),
  source_type text not null,
  model_version text not null,
  source_record_key text not null,
  source_summary jsonb not null default '{}'::jsonb,
  issued_at timestamptz not null,
  supersedes_id uuid,
  scenario_generation_id uuid,
  created_at timestamptz not null default now(),
  unique (community_id, id),
  unique (community_id, asset_id, market_interval_id, id),
  unique (community_id, asset_id, market_interval_id, metric, source_type, source_record_key),
  foreign key (community_id, asset_id) references public.energy_assets(community_id, id) on delete restrict,
  foreign key (community_id, market_interval_id) references public.market_intervals(community_id, id) on delete restrict,
  foreign key (community_id, supersedes_id) references public.forecasts(community_id, id) on delete restrict,
  constraint forecasts_metric_values check (metric in ('generation', 'consumption', 'reserve', 'surplus')),
  constraint forecasts_source_values check (source_type in ('connected', 'imported', 'modeled', 'stored_sample', 'simulated')),
  constraint forecasts_value_nonnegative check (value_kwh >= 0 and value_kwh <> 'NaN'::numeric),
  constraint forecasts_confidence_pair check ((confidence_low_kwh is null) = (confidence_high_kwh is null)),
  constraint forecasts_confidence_order check (confidence_low_kwh is null or (confidence_low_kwh >= 0 and confidence_low_kwh <= value_kwh and value_kwh <= confidence_high_kwh))
);

create table public.tariff_configs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  feed_in_rate numeric(14,6) not null,
  retail_rate numeric(14,6) not null,
  seller_margin_ratio numeric(9,6) not null default 0,
  buyer_discount_ratio numeric(9,6) not null default 0,
  effective_from timestamptz not null,
  effective_to timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (community_id, id),
  unique (community_id, effective_from),
  foreign key (community_id, created_by) references public.community_members(community_id, user_id) on delete restrict,
  constraint tariff_configs_rates check (feed_in_rate >= 0 and retail_rate >= 0 and feed_in_rate < retail_rate),
  constraint tariff_configs_ratios check (seller_margin_ratio between 0 and 1 and buyer_discount_ratio between 0 and 1),
  constraint tariff_configs_effective_range check (effective_to is null or effective_to > effective_from),
  exclude using gist (community_id with =, tstzrange(effective_from, effective_to, '[)') with &&)
);

create table public.feeder_snapshots (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  market_interval_id uuid not null,
  capacity_kw numeric(12,6) not null,
  load_kw numeric(12,6) not null,
  congestion_ratio numeric(9,6) not null,
  source_type text not null,
  scenario_key text,
  source_record_key text not null,
  observed_at timestamptz not null,
  created_by uuid,
  scenario_generation_id uuid,
  created_at timestamptz not null default now(),
  unique (community_id, id),
  unique (community_id, market_interval_id, id),
  unique (community_id, market_interval_id, source_type, source_record_key),
  foreign key (community_id, market_interval_id) references public.market_intervals(community_id, id) on delete restrict,
  foreign key (community_id, created_by) references public.community_members(community_id, user_id) on delete restrict,
  constraint feeder_snapshots_capacity_positive check (capacity_kw > 0 and capacity_kw <> 'NaN'::numeric),
  constraint feeder_snapshots_load_nonnegative check (load_kw >= 0 and load_kw <> 'NaN'::numeric),
  constraint feeder_snapshots_ratio_range check (congestion_ratio between 0 and 1),
  constraint feeder_snapshots_ratio_exact check (congestion_ratio = round(least(load_kw / capacity_kw, 1), 6)),
  constraint feeder_snapshots_source_values check (source_type in ('connected', 'simulated'))
);

create table public.pricing_snapshots (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  market_interval_id uuid not null,
  tariff_config_id uuid not null,
  feeder_snapshot_id uuid not null,
  algorithm_version text not null,
  supply_kwh numeric(16,6) not null,
  demand_kwh numeric(16,6) not null,
  unit_price numeric(14,6) not null,
  explanation jsonb not null,
  scenario_generation_id uuid,
  created_at timestamptz not null default now(),
  unique (community_id, id),
  unique (community_id, market_interval_id, id),
  foreign key (community_id, market_interval_id) references public.market_intervals(community_id, id) on delete restrict,
  foreign key (community_id, tariff_config_id) references public.tariff_configs(community_id, id) on delete restrict,
  foreign key (community_id, market_interval_id, feeder_snapshot_id) references public.feeder_snapshots(community_id, market_interval_id, id) on delete restrict,
  constraint pricing_snapshots_supply_nonnegative check (supply_kwh >= 0 and supply_kwh <> 'NaN'::numeric),
  constraint pricing_snapshots_demand_nonnegative check (demand_kwh >= 0 and demand_kwh <> 'NaN'::numeric),
  constraint pricing_snapshots_price_nonnegative check (unit_price >= 0 and unit_price <> 'NaN'::numeric)
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  market_interval_id uuid not null,
  seller_user_id uuid not null,
  solar_asset_id uuid not null,
  forecast_id uuid,
  batch_id uuid,
  quantity_kwh numeric(16,6) not null,
  remaining_kwh numeric(16,6) not null,
  minimum_price numeric(14,6),
  suggested_price numeric(14,6),
  is_manual_quantity boolean not null default false,
  auto_adjust boolean not null default false,
  status text not null default 'draft',
  version bigint not null default 1,
  scenario_generation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, id),
  unique (community_id, market_interval_id, id),
  foreign key (community_id, market_interval_id) references public.market_intervals(community_id, id) on delete restrict,
  foreign key (community_id, seller_user_id) references public.community_members(community_id, user_id) on delete restrict,
  foreign key (community_id, seller_user_id, solar_asset_id) references public.energy_assets(community_id, owner_user_id, id) on delete restrict,
  foreign key (community_id, solar_asset_id, market_interval_id, forecast_id) references public.forecasts(community_id, asset_id, market_interval_id, id) on delete restrict,
  constraint offers_quantity_positive check (quantity_kwh > 0 and quantity_kwh <> 'NaN'::numeric),
  constraint offers_remaining_range check (remaining_kwh >= 0 and remaining_kwh <= quantity_kwh),
  constraint offers_minimum_price_nonnegative check (minimum_price is null or (minimum_price >= 0 and minimum_price <> 'NaN'::numeric)),
  constraint offers_suggested_price_nonnegative check (suggested_price is null or (suggested_price >= 0 and suggested_price <> 'NaN'::numeric)),
  constraint offers_status_values check (status in ('draft', 'open', 'partly_matched', 'matched', 'closed', 'cancelled')),
  constraint offers_version_positive check (version > 0)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  market_interval_id uuid not null,
  buyer_user_id uuid not null,
  batch_id uuid,
  quantity_kwh numeric(16,6) not null,
  remaining_kwh numeric(16,6) not null,
  maximum_price numeric(14,6),
  auto_adjust boolean not null default false,
  status text not null default 'pending',
  version bigint not null default 1,
  scenario_generation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, id),
  unique (community_id, market_interval_id, id),
  foreign key (community_id, market_interval_id) references public.market_intervals(community_id, id) on delete restrict,
  foreign key (community_id, buyer_user_id) references public.community_members(community_id, user_id) on delete restrict,
  constraint reservations_quantity_positive check (quantity_kwh > 0 and quantity_kwh <> 'NaN'::numeric),
  constraint reservations_remaining_range check (remaining_kwh >= 0 and remaining_kwh <= quantity_kwh),
  constraint reservations_maximum_price_nonnegative check (maximum_price is null or (maximum_price >= 0 and maximum_price <> 'NaN'::numeric)),
  constraint reservations_status_values check (status in ('pending', 'active', 'partly_matched', 'matched', 'closed', 'cancelled')),
  constraint reservations_version_positive check (version > 0)
);

create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  market_interval_id uuid not null,
  offer_id uuid not null,
  reservation_id uuid not null,
  pricing_snapshot_id uuid not null,
  allocated_kwh numeric(16,6) not null,
  unit_price numeric(14,6) not null,
  status text not null default 'allocated',
  scenario_generation_id uuid,
  created_at timestamptz not null default now(),
  unique (community_id, id),
  unique (offer_id, reservation_id, pricing_snapshot_id),
  foreign key (community_id, market_interval_id, offer_id) references public.offers(community_id, market_interval_id, id) on delete restrict,
  foreign key (community_id, market_interval_id, reservation_id) references public.reservations(community_id, market_interval_id, id) on delete restrict,
  foreign key (community_id, market_interval_id, pricing_snapshot_id) references public.pricing_snapshots(community_id, market_interval_id, id) on delete restrict,
  constraint allocations_quantity_positive check (allocated_kwh > 0 and allocated_kwh <> 'NaN'::numeric),
  constraint allocations_price_nonnegative check (unit_price >= 0 and unit_price <> 'NaN'::numeric),
  constraint allocations_status_values check (status in ('allocated', 'reduced', 'settled', 'cancelled'))
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  allocation_id uuid not null unique,
  delivered_kwh numeric(16,6) not null,
  unit_price numeric(14,6) not null,
  credit_amount numeric(16,2) not null,
  status text not null default 'completed',
  settled_at timestamptz not null,
  scenario_generation_id uuid,
  created_at timestamptz not null default now(),
  unique (community_id, id),
  foreign key (community_id, allocation_id) references public.allocations(community_id, id) on delete restrict,
  constraint settlements_delivery_nonnegative check (delivered_kwh >= 0 and delivered_kwh <> 'NaN'::numeric),
  constraint settlements_price_nonnegative check (unit_price >= 0 and unit_price <> 'NaN'::numeric),
  constraint settlements_credit_nonnegative check (credit_amount >= 0 and credit_amount <> 'NaN'::numeric),
  constraint settlements_credit_exact check (credit_amount = round(unit_price * delivered_kwh, 2)),
  constraint settlements_status_values check (status = 'completed')
);

create table public.settlement_inputs (
  settlement_id uuid not null,
  community_id uuid not null,
  input_kind text not null,
  energy_reading_id uuid not null,
  scenario_generation_id uuid,
  created_at timestamptz not null default now(),
  primary key (settlement_id, input_kind),
  foreign key (community_id, settlement_id) references public.settlements(community_id, id) on delete restrict,
  foreign key (community_id, energy_reading_id) references public.energy_readings(community_id, id) on delete restrict,
  constraint settlement_inputs_kind_values check (input_kind in ('generation', 'consumption', 'reserve'))
);

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  settlement_id uuid not null unique,
  currency text not null,
  amount numeric(16,2) not null,
  posted_at timestamptz not null,
  scenario_generation_id uuid,
  created_at timestamptz not null default now(),
  unique (community_id, id),
  foreign key (community_id, settlement_id) references public.settlements(community_id, id) on delete restrict,
  constraint ledger_transactions_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint ledger_transactions_amount_positive check (amount > 0 and amount <> 'NaN'::numeric)
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  ledger_transaction_id uuid not null,
  account_id uuid not null,
  entry_type text not null,
  amount numeric(16,2) not null,
  scenario_generation_id uuid,
  created_at timestamptz not null default now(),
  unique (community_id, id),
  unique (ledger_transaction_id, entry_type),
  foreign key (community_id, ledger_transaction_id) references public.ledger_transactions(community_id, id) on delete restrict,
  foreign key (community_id, account_id) references public.credit_accounts(community_id, id) on delete restrict,
  constraint ledger_entries_type_values check (entry_type in ('debit', 'credit')),
  constraint ledger_entries_amount_positive check (amount > 0 and amount <> 'NaN'::numeric)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  actor_user_id uuid,
  event_type text not null,
  subject_type text not null,
  subject_id uuid,
  request_id text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique (community_id, id),
  foreign key (community_id, actor_user_id) references public.community_members(community_id, user_id) on delete restrict,
  constraint audit_events_event_not_blank check (btrim(event_type) <> ''),
  constraint audit_events_subject_not_blank check (btrim(subject_type) <> '')
);

create table public.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  actor_user_id uuid,
  operation text not null,
  idempotency_key text not null,
  request_sha256 text not null,
  status text not null,
  result_version text not null,
  result jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (community_id, operation, idempotency_key),
  foreign key (community_id, actor_user_id) references public.community_members(community_id, user_id) on delete restrict,
  constraint idempotency_records_status_values check (status in ('started', 'completed', 'failed')),
  constraint idempotency_records_completed_state check (status <> 'started'),
  constraint idempotency_records_strings_not_blank check (btrim(operation) <> '' and btrim(idempotency_key) <> '' and btrim(request_sha256) <> '' and btrim(result_version) <> '')
);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  topic text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  revision bigint not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by text,
  claim_token uuid,
  claim_expires_at timestamptz,
  attempt_count bigint not null default 0,
  delivered_at timestamptz,
  last_error_code text,
  scenario_generation_id uuid,
  created_at timestamptz not null default now(),
  unique (community_id, id),
  unique (community_id, aggregate_type, aggregate_id, revision, topic),
  constraint outbox_events_status_values check (status in ('pending', 'claimed', 'delivered', 'failed')),
  constraint outbox_events_revision_positive check (revision > 0),
  constraint outbox_events_attempt_range check (attempt_count between 0 and 8),
  constraint outbox_events_claim_group check ((claimed_at is null and claimed_by is null and claim_token is null and claim_expires_at is null) or (claimed_at is not null and claimed_by is not null and claim_token is not null and claim_expires_at is not null)),
  constraint outbox_events_delivered_state check ((status = 'delivered') = (delivered_at is not null))
);

create index community_members_user_status_idx on public.community_members (user_id, status, community_id);
create index community_members_active_idx on public.community_members (community_id, user_id) where status = 'active';
create index credit_accounts_owner_idx on public.credit_accounts (community_id, owner_user_id);
create index energy_assets_owner_idx on public.energy_assets (community_id, owner_user_id);
create index data_connections_asset_idx on public.data_connections (community_id, asset_id);
create index import_jobs_owner_asset_idx on public.import_jobs (community_id, uploader_user_id, asset_id);
create index market_intervals_status_start_idx on public.market_intervals (community_id, status, interval_start);
create index market_intervals_due_idx on public.market_intervals (community_id, interval_start) where status in ('open', 'matching', 'settlement_pending');
create index energy_readings_selection_idx on public.energy_readings (community_id, asset_id, metric, market_interval_id, source_type, retrieved_at desc);
create index energy_readings_interval_idx on public.energy_readings (community_id, market_interval_id);
create index energy_readings_connection_idx on public.energy_readings (community_id, asset_id, data_connection_id) where data_connection_id is not null;
create index energy_readings_import_idx on public.energy_readings (community_id, asset_id, import_job_id) where import_job_id is not null;
create index energy_readings_supersedes_idx on public.energy_readings (community_id, supersedes_id) where supersedes_id is not null;
create index forecasts_selection_idx on public.forecasts (community_id, asset_id, metric, market_interval_id, issued_at desc);
create index forecasts_supersedes_idx on public.forecasts (community_id, supersedes_id) where supersedes_id is not null;
create index tariff_configs_creator_idx on public.tariff_configs (community_id, created_by);
create index feeder_snapshots_interval_idx on public.feeder_snapshots (community_id, market_interval_id, observed_at desc, id desc);
create index feeder_snapshots_creator_idx on public.feeder_snapshots (community_id, created_by) where created_by is not null;
create index pricing_snapshots_tariff_idx on public.pricing_snapshots (community_id, tariff_config_id);
create index pricing_snapshots_feeder_idx on public.pricing_snapshots (community_id, market_interval_id, feeder_snapshot_id);
create index offers_seller_idx on public.offers (community_id, seller_user_id);
create index offers_asset_idx on public.offers (community_id, seller_user_id, solar_asset_id);
create index offers_forecast_idx on public.offers (community_id, solar_asset_id, market_interval_id, forecast_id) where forecast_id is not null;
create index offers_matching_idx on public.offers (community_id, market_interval_id, minimum_price, created_at, id) where status in ('open', 'partly_matched');
create index reservations_buyer_idx on public.reservations (community_id, buyer_user_id);
create index reservations_matching_idx on public.reservations (community_id, market_interval_id, maximum_price desc, created_at, id) where status in ('active', 'partly_matched');
create index allocations_interval_status_idx on public.allocations (community_id, market_interval_id, status, id);
create index allocations_offer_idx on public.allocations (community_id, market_interval_id, offer_id);
create index allocations_reservation_idx on public.allocations (community_id, market_interval_id, reservation_id);
create index allocations_pricing_idx on public.allocations (community_id, market_interval_id, pricing_snapshot_id);
create index settlements_history_idx on public.settlements (community_id, settled_at desc);
create index settlement_inputs_reading_idx on public.settlement_inputs (community_id, energy_reading_id);
create index ledger_transactions_settlement_idx on public.ledger_transactions (community_id, settlement_id);
create index ledger_entries_account_idx on public.ledger_entries (community_id, account_id, created_at desc, id);
create index ledger_entries_transaction_idx on public.ledger_entries (community_id, ledger_transaction_id);
create index audit_events_actor_idx on public.audit_events (community_id, actor_user_id, occurred_at desc);
create index idempotency_actor_idx on public.idempotency_records (community_id, actor_user_id) where actor_user_id is not null;
create index outbox_events_claim_idx on public.outbox_events (status, available_at, created_at, id) where status in ('pending', 'failed', 'claimed');

create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger profiles_validate_timezone before insert or update of timezone on public.profiles for each row execute function private.validate_timezone();
create trigger communities_set_updated_at before update on public.communities for each row execute function private.set_updated_at();
create trigger communities_validate_timezone before insert or update of timezone on public.communities for each row execute function private.validate_timezone();
create trigger community_members_set_updated_at before update on public.community_members for each row execute function private.set_updated_at();
create trigger energy_assets_set_updated_at before update on public.energy_assets for each row execute function private.set_updated_at();
create trigger data_connections_set_updated_at before update on public.data_connections for each row execute function private.set_updated_at();
create trigger import_jobs_set_updated_at before update on public.import_jobs for each row execute function private.set_updated_at();
create trigger market_intervals_set_updated_at before update on public.market_intervals for each row execute function private.set_updated_at();
create trigger offers_set_updated_at before update on public.offers for each row execute function private.set_updated_at();
create trigger reservations_set_updated_at before update on public.reservations for each row execute function private.set_updated_at();

create function private.guard_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('solarshare.trusted_write', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  raise exception '% is append only', tg_table_name using errcode = '55000';
end;
$$;

create function private.guard_asset_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.community_id, new.owner_user_id, new.asset_type, new.created_at) is distinct from (old.community_id, old.owner_user_id, old.asset_type, old.created_at) then
    raise exception 'asset identity fields are immutable' using errcode = '42501';
  end if;
  if new.status = 'retired' and exists (select 1 from public.offers where solar_asset_id = old.id) then
    raise exception 'market referenced asset cannot retire' using errcode = '55000';
  end if;
  new.version = old.version + 1;
  return new;
end;
$$;

create function private.guard_order_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'offers' then
    if (new.community_id, new.market_interval_id, new.seller_user_id, new.solar_asset_id, new.forecast_id, new.batch_id, new.remaining_kwh, new.suggested_price, new.created_at)
      is distinct from (old.community_id, old.market_interval_id, old.seller_user_id, old.solar_asset_id, old.forecast_id, old.batch_id, old.remaining_kwh, old.suggested_price, old.created_at)
      and current_setting('solarshare.trusted_write', true) is distinct from 'on' then
      raise exception 'offer database owned fields are immutable' using errcode = '42501';
    end if;
    if current_setting('solarshare.trusted_write', true) is distinct from 'on' and not ((old.status = new.status) or (old.status = 'draft' and new.status in ('open', 'cancelled')) or (old.status in ('open', 'partly_matched') and new.status = 'cancelled')) then
      raise exception 'invalid owner offer transition' using errcode = '55000';
    end if;
  else
    if (new.community_id, new.market_interval_id, new.buyer_user_id, new.batch_id, new.remaining_kwh, new.created_at)
      is distinct from (old.community_id, old.market_interval_id, old.buyer_user_id, old.batch_id, old.remaining_kwh, old.created_at)
      and current_setting('solarshare.trusted_write', true) is distinct from 'on' then
      raise exception 'reservation database owned fields are immutable' using errcode = '42501';
    end if;
    if current_setting('solarshare.trusted_write', true) is distinct from 'on' and not ((old.status = new.status) or (old.status = 'pending' and new.status in ('active', 'cancelled')) or (old.status in ('active', 'partly_matched') and new.status = 'cancelled')) then
      raise exception 'invalid owner reservation transition' using errcode = '55000';
    end if;
  end if;
  new.version = old.version + 1;
  return new;
end;
$$;

create function private.validate_energy_reading()
returns trigger
language plpgsql
set search_path = ''
as $$
declare expected numeric(16,6);
declare prior public.energy_readings;
begin
  expected := case new.original_unit when 'kWh' then round(new.original_value, 6) when 'Wh' then round(new.original_value / 1000, 6) when 'kW' then round(new.original_value * 0.25, 6) end;
  if new.value_kwh <> expected then raise exception 'normalized reading value does not match original value and unit' using errcode = '23514'; end if;
  if new.supersedes_id is not null then
    select * into strict prior from public.energy_readings where id = new.supersedes_id;
    if (prior.community_id, prior.asset_id, prior.market_interval_id, prior.metric, prior.source_type) is distinct from (new.community_id, new.asset_id, new.market_interval_id, new.metric, new.source_type) or prior.created_at >= new.created_at then
      raise exception 'invalid reading supersession lineage' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create function private.validate_forecast()
returns trigger
language plpgsql
set search_path = ''
as $$
declare prior public.forecasts;
begin
  if new.supersedes_id is not null then
    select * into strict prior from public.forecasts where id = new.supersedes_id;
    if (prior.community_id, prior.asset_id, prior.market_interval_id, prior.metric, prior.source_type) is distinct from (new.community_id, new.asset_id, new.market_interval_id, new.metric, new.source_type) or prior.created_at >= new.created_at then
      raise exception 'invalid forecast supersession lineage' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create function private.validate_market_records()
returns trigger
language plpgsql
set search_path = ''
as $$
declare asset public.energy_assets;
declare forecast public.forecasts;
declare tariff public.tariff_configs;
declare allocation public.allocations;
begin
  if tg_table_name = 'offers' then
    select * into strict asset from public.energy_assets where id = new.solar_asset_id;
    if asset.asset_type <> 'solar' or asset.status <> 'active' then raise exception 'offer requires an active solar asset' using errcode = '23514'; end if;
    if new.forecast_id is not null then
      select * into strict forecast from public.forecasts where id = new.forecast_id;
      if forecast.metric <> 'surplus' then raise exception 'offer forecast must be surplus' using errcode = '23514'; end if;
    end if;
  elsif tg_table_name = 'pricing_snapshots' then
    select * into strict tariff from public.tariff_configs where id = new.tariff_config_id;
    if new.unit_price < tariff.feed_in_rate or new.unit_price > tariff.retail_rate then raise exception 'price is outside tariff corridor' using errcode = '23514'; end if;
  elsif tg_table_name = 'settlements' then
    select * into strict allocation from public.allocations where id = new.allocation_id;
    if new.delivered_kwh > allocation.allocated_kwh or new.unit_price <> allocation.unit_price then raise exception 'settlement disagrees with allocation' using errcode = '23514'; end if;
  end if;
  return new;
end;
$$;

create function private.validate_credit_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.currency <> (select currency from public.communities where id = new.community_id) then raise exception 'account currency must match community' using errcode = '23514'; end if;
  return new;
end;
$$;

create function private.validate_ledger_pair()
returns trigger
language plpgsql
set search_path = ''
as $$
declare tx_id uuid := coalesce(new.ledger_transaction_id, old.ledger_transaction_id);
declare debit_count integer;
declare credit_count integer;
declare debit_amount numeric;
declare credit_amount numeric;
begin
  select count(*) filter (where entry_type = 'debit'), count(*) filter (where entry_type = 'credit'), max(amount) filter (where entry_type = 'debit'), max(amount) filter (where entry_type = 'credit')
    into debit_count, credit_count, debit_amount, credit_amount
    from public.ledger_entries where ledger_transaction_id = tx_id;
  if debit_count <> 1 or credit_count <> 1 or debit_amount <> credit_amount then raise exception 'ledger transaction must contain one equal debit and credit' using errcode = '23514'; end if;
  return null;
end;
$$;

create function private.validate_settlement_input()
returns trigger
language plpgsql
set search_path = ''
as $$
declare reading public.energy_readings;
declare settlement public.settlements;
declare allocation public.allocations;
begin
  select * into strict reading from public.energy_readings where id = new.energy_reading_id;
  select * into strict settlement from public.settlements where id = new.settlement_id;
  select * into strict allocation from public.allocations where id = settlement.allocation_id;
  if reading.market_interval_id <> allocation.market_interval_id or reading.metric <> new.input_kind then raise exception 'settlement input does not match settlement interval or kind' using errcode = '23514'; end if;
  return null;
end;
$$;

create trigger energy_assets_guard before update on public.energy_assets for each row execute function private.guard_asset_update();
create trigger offers_guard before update on public.offers for each row execute function private.guard_order_update();
create trigger reservations_guard before update on public.reservations for each row execute function private.guard_order_update();
create trigger energy_readings_validate before insert on public.energy_readings for each row execute function private.validate_energy_reading();
create trigger forecasts_validate before insert on public.forecasts for each row execute function private.validate_forecast();
create trigger offers_validate before insert or update on public.offers for each row execute function private.validate_market_records();
create trigger pricing_snapshots_validate before insert on public.pricing_snapshots for each row execute function private.validate_market_records();
create trigger settlements_validate before insert on public.settlements for each row execute function private.validate_market_records();
create trigger credit_accounts_validate before insert or update on public.credit_accounts for each row execute function private.validate_credit_account();
create constraint trigger ledger_entries_pair after insert or update or delete on public.ledger_entries deferrable initially deferred for each row execute function private.validate_ledger_pair();
create constraint trigger settlement_inputs_validate after insert or update on public.settlement_inputs deferrable initially deferred for each row execute function private.validate_settlement_input();

create trigger tariff_configs_immutable before update or delete on public.tariff_configs for each row execute function private.guard_immutable();
create trigger feeder_snapshots_immutable before update or delete on public.feeder_snapshots for each row execute function private.guard_immutable();
create trigger pricing_snapshots_immutable before update or delete on public.pricing_snapshots for each row execute function private.guard_immutable();
create trigger energy_readings_immutable before update or delete on public.energy_readings for each row execute function private.guard_immutable();
create trigger forecasts_immutable before update or delete on public.forecasts for each row execute function private.guard_immutable();
create trigger settlements_immutable before update or delete on public.settlements for each row execute function private.guard_immutable();
create trigger settlement_inputs_immutable before update or delete on public.settlement_inputs for each row execute function private.guard_immutable();
create trigger ledger_transactions_immutable before update or delete on public.ledger_transactions for each row execute function private.guard_immutable();
create trigger ledger_entries_immutable before update or delete on public.ledger_entries for each row execute function private.guard_immutable();
create trigger audit_events_immutable before update or delete on public.audit_events for each row execute function private.guard_immutable();
create trigger idempotency_records_immutable before update or delete on public.idempotency_records for each row execute function private.guard_immutable();

create function private.is_active_member(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.community_members
    where community_id = p_community_id and user_id = (select auth.uid()) and status = 'active'
  );
$$;

create function private.is_active_operator(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.community_members
    where community_id = p_community_id and user_id = (select auth.uid()) and member_role = 'operator' and status = 'active'
  );
$$;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.communities enable row level security;
alter table public.communities force row level security;
alter table public.community_members enable row level security;
alter table public.community_members force row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_accounts force row level security;
alter table public.energy_assets enable row level security;
alter table public.energy_assets force row level security;
alter table public.data_connections enable row level security;
alter table public.data_connections force row level security;
alter table public.import_jobs enable row level security;
alter table public.import_jobs force row level security;
alter table public.market_intervals enable row level security;
alter table public.market_intervals force row level security;
alter table public.energy_readings enable row level security;
alter table public.energy_readings force row level security;
alter table public.forecasts enable row level security;
alter table public.forecasts force row level security;
alter table public.tariff_configs enable row level security;
alter table public.tariff_configs force row level security;
alter table public.feeder_snapshots enable row level security;
alter table public.feeder_snapshots force row level security;
alter table public.pricing_snapshots enable row level security;
alter table public.pricing_snapshots force row level security;
alter table public.offers enable row level security;
alter table public.offers force row level security;
alter table public.reservations enable row level security;
alter table public.reservations force row level security;
alter table public.allocations enable row level security;
alter table public.allocations force row level security;
alter table public.settlements enable row level security;
alter table public.settlements force row level security;
alter table public.settlement_inputs enable row level security;
alter table public.settlement_inputs force row level security;
alter table public.ledger_transactions enable row level security;
alter table public.ledger_transactions force row level security;
alter table public.ledger_entries enable row level security;
alter table public.ledger_entries force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;
alter table public.idempotency_records enable row level security;
alter table public.idempotency_records force row level security;
alter table public.outbox_events enable row level security;
alter table public.outbox_events force row level security;

create policy profiles_own_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_own_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy communities_member_select on public.communities for select to authenticated using ((select private.is_active_member(id)));
create policy community_members_own_select on public.community_members for select to authenticated using (user_id = (select auth.uid()));
create policy credit_accounts_own_select on public.credit_accounts for select to authenticated using (owner_user_id = (select auth.uid()) and (select private.is_active_member(community_id)));
create policy energy_assets_own_select on public.energy_assets for select to authenticated using (owner_user_id = (select auth.uid()) and (select private.is_active_member(community_id)));
create policy energy_assets_own_insert on public.energy_assets for insert to authenticated with check (owner_user_id = (select auth.uid()) and (select private.is_active_member(community_id)));
create policy energy_assets_own_update on public.energy_assets for update to authenticated using (owner_user_id = (select auth.uid()) and (select private.is_active_member(community_id))) with check (owner_user_id = (select auth.uid()) and (select private.is_active_member(community_id)));
create policy data_connections_own_select on public.data_connections for select to authenticated using (exists (select 1 from public.energy_assets a where a.id = asset_id and a.community_id = data_connections.community_id and a.owner_user_id = (select auth.uid())));
create policy data_connections_own_insert on public.data_connections for insert to authenticated with check (exists (select 1 from public.energy_assets a where a.id = asset_id and a.community_id = data_connections.community_id and a.owner_user_id = (select auth.uid())));
create policy data_connections_own_update on public.data_connections for update to authenticated using (exists (select 1 from public.energy_assets a where a.id = asset_id and a.community_id = data_connections.community_id and a.owner_user_id = (select auth.uid()))) with check (exists (select 1 from public.energy_assets a where a.id = asset_id and a.community_id = data_connections.community_id and a.owner_user_id = (select auth.uid())));
create policy import_jobs_own_select on public.import_jobs for select to authenticated using (uploader_user_id = (select auth.uid()) and (select private.is_active_member(community_id)));
create policy import_jobs_own_insert on public.import_jobs for insert to authenticated with check (uploader_user_id = (select auth.uid()) and (select private.is_active_member(community_id)));
create policy import_jobs_own_update on public.import_jobs for update to authenticated using (uploader_user_id = (select auth.uid()) and (select private.is_active_member(community_id))) with check (uploader_user_id = (select auth.uid()) and (select private.is_active_member(community_id)));
create policy market_intervals_member_select on public.market_intervals for select to authenticated using ((select private.is_active_member(community_id)));
create policy energy_readings_owner_select on public.energy_readings for select to authenticated using (exists (select 1 from public.energy_assets a where a.id = asset_id and a.community_id = energy_readings.community_id and a.owner_user_id = (select auth.uid())));
create policy forecasts_owner_select on public.forecasts for select to authenticated using (exists (select 1 from public.energy_assets a where a.id = asset_id and a.community_id = forecasts.community_id and a.owner_user_id = (select auth.uid())));
create policy tariff_configs_member_select on public.tariff_configs for select to authenticated using ((select private.is_active_member(community_id)));
create policy feeder_snapshots_member_select on public.feeder_snapshots for select to authenticated using ((select private.is_active_member(community_id)));
create policy pricing_snapshots_member_select on public.pricing_snapshots for select to authenticated using ((select private.is_active_member(community_id)));
create policy offers_owner_select on public.offers for select to authenticated using (seller_user_id = (select auth.uid()) and (select private.is_active_member(community_id)));
create policy offers_owner_insert on public.offers for insert to authenticated with check (seller_user_id = (select auth.uid()) and (select private.is_active_member(community_id)));
create policy offers_owner_update on public.offers for update to authenticated using (seller_user_id = (select auth.uid()) and (select private.is_active_member(community_id))) with check (seller_user_id = (select auth.uid()) and (select private.is_active_member(community_id)));
create policy reservations_owner_select on public.reservations for select to authenticated using (buyer_user_id = (select auth.uid()) and (select private.is_active_member(community_id)));
create policy reservations_owner_insert on public.reservations for insert to authenticated with check (buyer_user_id = (select auth.uid()) and (select private.is_active_member(community_id)));
create policy reservations_owner_update on public.reservations for update to authenticated using (buyer_user_id = (select auth.uid()) and (select private.is_active_member(community_id))) with check (buyer_user_id = (select auth.uid()) and (select private.is_active_member(community_id)));
create policy allocations_party_select on public.allocations for select to authenticated using (exists (select 1 from public.offers o join public.reservations r on r.id = allocations.reservation_id where o.id = allocations.offer_id and (o.seller_user_id = (select auth.uid()) or r.buyer_user_id = (select auth.uid()))));
create policy settlements_party_select on public.settlements for select to authenticated using (exists (select 1 from public.allocations a join public.offers o on o.id = a.offer_id join public.reservations r on r.id = a.reservation_id where a.id = settlements.allocation_id and (o.seller_user_id = (select auth.uid()) or r.buyer_user_id = (select auth.uid()))));
create policy settlement_inputs_owner_select on public.settlement_inputs for select to authenticated using (exists (select 1 from public.settlements s join public.allocations a on a.id = s.allocation_id join public.offers o on o.id = a.offer_id join public.reservations r on r.id = a.reservation_id where s.id = settlement_inputs.settlement_id and (o.seller_user_id = (select auth.uid()) or r.buyer_user_id = (select auth.uid()))));
create policy ledger_transactions_owner_select on public.ledger_transactions for select to authenticated using (exists (select 1 from public.ledger_entries e join public.credit_accounts ca on ca.id = e.account_id where e.ledger_transaction_id = ledger_transactions.id and ca.owner_user_id = (select auth.uid())));
create policy ledger_entries_owner_select on public.ledger_entries for select to authenticated using (exists (select 1 from public.credit_accounts ca where ca.id = account_id and ca.community_id = ledger_entries.community_id and ca.owner_user_id = (select auth.uid())));

create view public.own_profiles with (security_invoker = true) as
select id, display_name, latitude_approx::text as latitude_approx, longitude_approx::text as longitude_approx, timezone, created_at, updated_at from public.profiles;
create view public.own_assets with (security_invoker = true) as
select id, community_id, asset_type, name, capacity_kw::text as capacity_kw, tilt_degrees::text as tilt_degrees, azimuth_degrees::text as azimuth_degrees, reserve_kwh::text as reserve_kwh, status, version::text as version, created_at, updated_at from public.energy_assets;
create view public.own_connections with (security_invoker = true) as
select id, community_id, asset_id, connection_type, provider, status, last_sync_at, last_error_code, created_at, updated_at from public.data_connections;
create view public.own_imports with (security_invoker = true) as
select id, community_id, asset_id, file_sha256, status, accepted_rows::text as accepted_rows, rejected_rows::text as rejected_rows, warnings, committed_at, created_at, updated_at from public.import_jobs;
create view public.own_readings with (security_invoker = true) as
select id, community_id, asset_id, market_interval_id, metric, value_kwh::text as value_kwh, source_type, quality, original_value::text as original_value, original_unit, observed_at, retrieved_at, data_connection_id, import_job_id, supersedes_id, created_at from public.energy_readings;
create view public.own_forecasts with (security_invoker = true) as
select id, community_id, asset_id, market_interval_id, metric, value_kwh::text as value_kwh, confidence_low_kwh::text as confidence_low_kwh, confidence_high_kwh::text as confidence_high_kwh, source_type, model_version, issued_at, supersedes_id, created_at from public.forecasts;
create view public.own_intervals with (security_invoker = true) as
select id, community_id, interval_start, interval_end, status, created_at, updated_at from public.market_intervals;
create view public.own_tariffs with (security_invoker = true) as
select id, community_id, feed_in_rate::text as feed_in_rate, retail_rate::text as retail_rate, seller_margin_ratio::text as seller_margin_ratio, buyer_discount_ratio::text as buyer_discount_ratio, effective_from, effective_to, created_by, created_at from public.tariff_configs;
create view public.own_feeders with (security_invoker = true) as
select id, community_id, market_interval_id, capacity_kw::text as capacity_kw, load_kw::text as load_kw, congestion_ratio::text as congestion_ratio, source_type, scenario_key, observed_at, created_at from public.feeder_snapshots;
create view public.own_offers with (security_invoker = true) as
select id, community_id, market_interval_id, solar_asset_id, forecast_id, batch_id, quantity_kwh::text as quantity_kwh, remaining_kwh::text as remaining_kwh, minimum_price::text as minimum_price, suggested_price::text as suggested_price, is_manual_quantity, auto_adjust, status, version::text as version, created_at, updated_at from public.offers;
create view public.own_reservations with (security_invoker = true) as
select id, community_id, market_interval_id, batch_id, quantity_kwh::text as quantity_kwh, remaining_kwh::text as remaining_kwh, maximum_price::text as maximum_price, auto_adjust, status, version::text as version, created_at, updated_at from public.reservations;
create view public.own_allocations with (security_invoker = true) as
select id, community_id, market_interval_id, offer_id, reservation_id, pricing_snapshot_id, allocated_kwh::text as allocated_kwh, unit_price::text as unit_price, status, created_at from public.allocations;
create view public.own_settlements with (security_invoker = true) as
select id, community_id, allocation_id, delivered_kwh::text as delivered_kwh, unit_price::text as unit_price, credit_amount::text as credit_amount, status, settled_at, created_at from public.settlements;
create view public.own_credit_accounts with (security_invoker = true) as
select id, community_id, currency, status, created_at from public.credit_accounts;
create view public.own_ledger_entries with (security_invoker = true) as
select e.id, e.community_id, e.account_id, e.entry_type, e.amount::text as amount, e.created_at, e.ledger_transaction_id, t.settlement_id from public.ledger_entries e join public.ledger_transactions t on t.id = e.ledger_transaction_id;

create function private.require_page(p_limit integer, p_after jsonb, p_keys text[])
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare key text;
begin
  if p_limit < 1 or p_limit > 100 then raise exception 'limit must be between 1 and 100' using errcode = '22023'; end if;
  if p_after is null then return; end if;
  if jsonb_typeof(p_after) <> 'object' or jsonb_object_length(p_after) <> cardinality(p_keys) then raise exception 'invalid cursor' using errcode = '22023'; end if;
  foreach key in array p_keys loop
    if not (p_after ? key) or jsonb_typeof(p_after -> key) not in ('string', 'null') then raise exception 'invalid cursor' using errcode = '22023'; end if;
  end loop;
end;
$$;

create function public.select_preferred_energy_reading(p_community_id uuid, p_asset_id uuid, p_market_interval_id uuid, p_metric text)
returns table (reading_id uuid, value_kwh text, source_type text, quality text, observed_at timestamptz, retrieved_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_active_member(p_community_id) or not exists (select 1 from public.energy_assets where id = p_asset_id and community_id = p_community_id and owner_user_id = (select auth.uid())) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select r.id, to_char(r.value_kwh, 'FM9999999990.000000'), r.source_type, r.quality, r.observed_at, r.retrieved_at
    from public.energy_readings r
    where r.community_id = p_community_id and r.asset_id = p_asset_id and r.market_interval_id = p_market_interval_id and r.metric = p_metric and r.quality <> 'missing'
      and not exists (select 1 from public.energy_readings newer where newer.supersedes_id = r.id and newer.quality <> 'missing')
    order by case r.source_type when 'connected' then 1 when 'imported' then 2 when 'modeled' then 3 when 'stored_sample' then 4 else 5 end, r.retrieved_at desc, r.id desc
    limit 1;
end;
$$;

create function public.select_current_forecast(p_community_id uuid, p_asset_id uuid, p_market_interval_id uuid, p_metric text, p_as_of timestamptz)
returns table (forecast_id uuid, value_kwh text, confidence_low_kwh text, confidence_high_kwh text, source_type text, model_version text, issued_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_active_member(p_community_id) or not exists (select 1 from public.energy_assets where id = p_asset_id and community_id = p_community_id and owner_user_id = (select auth.uid())) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select f.id, to_char(f.value_kwh, 'FM9999999990.000000'), case when f.confidence_low_kwh is null then null else to_char(f.confidence_low_kwh, 'FM9999999990.000000') end, case when f.confidence_high_kwh is null then null else to_char(f.confidence_high_kwh, 'FM9999999990.000000') end, f.source_type, f.model_version, f.issued_at
    from public.forecasts f
    where f.community_id = p_community_id and f.asset_id = p_asset_id and f.market_interval_id = p_market_interval_id and f.metric = p_metric and f.issued_at <= p_as_of
      and not exists (select 1 from public.forecasts newer where newer.supersedes_id = f.id and newer.issued_at <= p_as_of)
    order by f.issued_at desc, f.id desc limit 1;
end;
$$;

create function public.read_community_marketplace(p_community_id uuid, p_market_interval_id uuid, p_limit integer default 25, p_after jsonb default null)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_active_member(p_community_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform private.require_page(p_limit, p_after, array['side','createdAt','listingId']);
  return query with listings as (
    select private.opaque_uuid('market', o.community_id, o.id) listing_id, o.community_id, o.market_interval_id interval_id, 'offer'::text side, m.market_alias alias, o.remaining_kwh available, o.minimum_price limit_price, o.status, coalesce(f.source_type, 'manual') source_label, o.created_at
    from public.offers o join public.community_members m on (m.community_id, m.user_id) = (o.community_id, o.seller_user_id) left join public.forecasts f on f.id = o.forecast_id
    where o.community_id = p_community_id and o.market_interval_id = p_market_interval_id and o.status in ('open','partly_matched') and o.remaining_kwh > 0
    union all
    select private.opaque_uuid('market', r.community_id, r.id), r.community_id, r.market_interval_id, 'reservation', m.market_alias, r.remaining_kwh, r.maximum_price, r.status, 'manual', r.created_at
    from public.reservations r join public.community_members m on (m.community_id, m.user_id) = (r.community_id, r.buyer_user_id)
    where r.community_id = p_community_id and r.market_interval_id = p_market_interval_id and r.status in ('active','partly_matched') and r.remaining_kwh > 0
  )
  select jsonb_build_object('listingId', listing_id, 'communityId', community_id, 'intervalId', interval_id, 'side', side, 'alias', alias, 'availableKwh', to_char(available, 'FM9999999990.000000'), 'limitPrice', case when limit_price is null then null else to_char(limit_price, 'FM9999999990.000000') end, 'status', status, 'sourceLabel', source_label, 'cursor', jsonb_build_object('side', side, 'createdAt', created_at, 'listingId', listing_id))
  from listings
  where p_after is null or (side, created_at, listing_id) > (p_after->>'side', (p_after->>'createdAt')::timestamptz, (p_after->>'listingId')::uuid)
  order by side, created_at, listing_id limit p_limit;
end;
$$;

create function public.read_community_map(p_community_id uuid, p_from timestamptz, p_to timestamptz, p_limit integer default 25, p_after jsonb default null)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_active_member(p_community_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_to <= p_from or p_to > p_from + interval '7 days' then raise exception 'invalid map range' using errcode = '22023'; end if;
  perform private.require_page(p_limit, p_after, array['featureId']);
  return query
  select jsonb_build_object('featureId', feature_id, 'latitude', to_char(latitude_approx, 'FM990.00'), 'longitude', to_char(longitude_approx, 'FM990.00'), 'hasSellerAvailability', available, 'cursor', jsonb_build_object('featureId', feature_id))
  from (
    select private.opaque_uuid('map', m.community_id, m.user_id) feature_id, p.latitude_approx, p.longitude_approx,
      exists (select 1 from public.offers o join public.market_intervals i on i.id = o.market_interval_id where o.community_id = m.community_id and o.seller_user_id = m.user_id and o.status in ('open','partly_matched') and o.remaining_kwh > 0 and i.interval_start >= p_from and i.interval_start < p_to) available
    from public.community_members m join public.profiles p on p.id = m.user_id
    where m.community_id = p_community_id and m.member_role = 'household' and m.status = 'active' and p.latitude_approx is not null
  ) points where p_after is null or feature_id > (p_after->>'featureId')::uuid order by feature_id limit p_limit;
end;
$$;

create function public.read_operator_members(p_community_id uuid, p_limit integer default 25, p_after jsonb default null)
returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_active_operator(p_community_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform private.require_page(p_limit, p_after, array['alias','userId']);
  return query select jsonb_build_object('userId', user_id, 'alias', market_alias, 'role', member_role, 'status', status, 'joinedAt', joined_at, 'cursor', jsonb_build_object('alias', market_alias, 'userId', user_id)) from public.community_members
    where community_id = p_community_id and (p_after is null or (market_alias, user_id) > (p_after->>'alias', (p_after->>'userId')::uuid)) order by market_alias, user_id limit p_limit;
end; $$;

create function public.read_operator_data_health(p_community_id uuid, p_as_of timestamptz, p_limit integer default 25, p_after jsonb default null)
returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_active_operator(p_community_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform private.require_page(p_limit, p_after, array['alias','assetId']);
  return query
    select jsonb_build_object('alias', m.market_alias, 'assetId', a.id, 'assetType', a.asset_type, 'connectionStatus', c.status, 'lastSyncAt', c.last_sync_at, 'latestReadingAt', x.latest_at, 'freshness', case when x.latest_at is null then 'missing' when x.latest_at >= p_as_of - interval '30 minutes' then 'fresh' else 'stale' end, 'errorCode', c.last_error_code, 'cursor', jsonb_build_object('alias', m.market_alias, 'assetId', a.id))
    from public.energy_assets a join public.community_members m on (m.community_id,m.user_id)=(a.community_id,a.owner_user_id)
    left join lateral (select dc.status, dc.last_sync_at, dc.last_error_code from public.data_connections dc where dc.asset_id=a.id order by dc.created_at desc limit 1) c on true
    left join lateral (select max(r.observed_at) latest_at from public.energy_readings r where r.asset_id=a.id) x on true
    where a.community_id=p_community_id and (p_after is null or (m.market_alias,a.id)>(p_after->>'alias',(p_after->>'assetId')::uuid)) order by m.market_alias,a.id limit p_limit;
end; $$;

create function public.read_operator_market(p_community_id uuid, p_limit integer default 25, p_after jsonb default null)
returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_active_operator(p_community_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform private.require_page(p_limit, p_after, array['intervalStart','side','alias','listingId']);
  return query with orders as (
    select i.id interval_id,i.interval_start,'offer'::text side,m.market_alias alias,o.status,o.quantity_kwh quantity,o.remaining_kwh remaining,o.id listing_id,coalesce(sum(a.allocated_kwh),0) allocated,coalesce(sum(s.delivered_kwh),0) settled
    from public.offers o join public.market_intervals i on i.id=o.market_interval_id join public.community_members m on (m.community_id,m.user_id)=(o.community_id,o.seller_user_id) left join public.allocations a on a.offer_id=o.id left join public.settlements s on s.allocation_id=a.id where o.community_id=p_community_id group by i.id,i.interval_start,m.market_alias,o.id
    union all
    select i.id,i.interval_start,'reservation',m.market_alias,r.status,r.quantity_kwh,r.remaining_kwh,r.id,coalesce(sum(a.allocated_kwh),0),coalesce(sum(s.delivered_kwh),0)
    from public.reservations r join public.market_intervals i on i.id=r.market_interval_id join public.community_members m on (m.community_id,m.user_id)=(r.community_id,r.buyer_user_id) left join public.allocations a on a.reservation_id=r.id left join public.settlements s on s.allocation_id=a.id where r.community_id=p_community_id group by i.id,i.interval_start,m.market_alias,r.id
  ) select jsonb_build_object('intervalId',interval_id,'intervalStart',interval_start,'side',side,'alias',alias,'status',status,'quantityKwh',to_char(quantity,'FM9999999990.000000'),'remainingKwh',to_char(remaining,'FM9999999990.000000'),'allocatedKwh',to_char(allocated,'FM9999999990.000000'),'settledKwh',to_char(settled,'FM9999999990.000000'),'cursor',jsonb_build_object('intervalStart',interval_start,'side',side,'alias',alias,'listingId',listing_id)) from orders
  where p_after is null or (interval_start,side,alias,listing_id)<((p_after->>'intervalStart')::timestamptz,p_after->>'side',p_after->>'alias',(p_after->>'listingId')::uuid) order by interval_start desc,side,alias,listing_id limit p_limit;
end; $$;

create function public.read_operator_settlement_totals(p_community_id uuid, p_limit integer default 25, p_after jsonb default null)
returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_active_operator(p_community_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform private.require_page(p_limit, p_after, array['intervalStart','intervalId']);
  return query select jsonb_build_object('intervalId',i.id,'intervalStart',i.interval_start,'settledKwh',to_char(coalesce(sum(s.delivered_kwh),0),'FM9999999990.000000'),'totalInr',to_char(coalesce(sum(s.credit_amount),0),'FM9999999990.00'),'cursor',jsonb_build_object('intervalStart',i.interval_start,'intervalId',i.id))
    from public.market_intervals i left join public.allocations a on a.market_interval_id=i.id left join public.settlements s on s.allocation_id=a.id where i.community_id=p_community_id and i.status='settled' and (p_after is null or (i.interval_start,i.id)<((p_after->>'intervalStart')::timestamptz,(p_after->>'intervalId')::uuid)) group by i.id order by i.interval_start desc,i.id limit p_limit;
end; $$;

create function public.read_operator_audit(p_community_id uuid, p_limit integer default 25, p_after jsonb default null)
returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_active_operator(p_community_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform private.require_page(p_limit, p_after, array['occurredAt','eventId']);
  return query select jsonb_build_object('eventId',a.id,'eventType',a.event_type,'alias',m.market_alias,'subjectType',a.subject_type,'requestId',a.request_id,'details',a.details,'occurredAt',a.occurred_at,'cursor',jsonb_build_object('occurredAt',a.occurred_at,'eventId',a.id)) from public.audit_events a left join public.community_members m on (m.community_id,m.user_id)=(a.community_id,a.actor_user_id)
    where a.community_id=p_community_id and (p_after is null or (a.occurred_at,a.id)<((p_after->>'occurredAt')::timestamptz,(p_after->>'eventId')::uuid)) order by a.occurred_at desc,a.id desc limit p_limit;
end; $$;

create function public.read_action_receipts(p_community_id uuid, p_limit integer default 25, p_after jsonb default null)
returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_active_member(p_community_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  perform private.require_page(p_limit, p_after, array['occurredAt','eventId']);
  return query select jsonb_build_object('eventId',id,'eventType',event_type,'subjectType',subject_type,'subjectId',subject_id,'requestId',request_id,'details',details,'occurredAt',occurred_at,'cursor',jsonb_build_object('occurredAt',occurred_at,'eventId',id)) from public.audit_events
    where community_id=p_community_id and actor_user_id=(select auth.uid()) and (p_after is null or (occurred_at,id)<((p_after->>'occurredAt')::timestamptz,(p_after->>'eventId')::uuid)) order by occurred_at desc,id desc limit p_limit;
end; $$;

create function public.read_own_credit_balances(p_community_id uuid)
returns setof jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_active_member(p_community_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select jsonb_build_object('accountId',a.id,'communityId',a.community_id,'currency',a.currency,'balance',to_char(coalesce(sum(case e.entry_type when 'credit' then e.amount else -e.amount end),0),'FM9999999990.00')) from public.credit_accounts a left join public.ledger_entries e on e.account_id=a.id where a.community_id=p_community_id and a.owner_user_id=(select auth.uid()) group by a.id order by a.community_id,a.id;
end; $$;

create function public.operator_update_membership(p_community_id uuid, p_user_id uuid, p_member_role text, p_status text, p_request_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare old_row public.community_members; declare new_row public.community_members;
begin
  if not private.is_active_operator(p_community_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_member_role not in ('household','operator') or p_status not in ('invited','active','suspended') or btrim(p_request_id)='' then raise exception 'invalid membership change' using errcode='22023'; end if;
  select * into strict old_row from public.community_members where community_id=p_community_id and user_id=p_user_id for update;
  if old_row.member_role='operator' and old_row.status='active' and (p_member_role<>'operator' or p_status<>'active') and not exists (select 1 from public.community_members where community_id=p_community_id and user_id<>p_user_id and member_role='operator' and status='active') then raise exception 'last active operator cannot be removed' using errcode='55000'; end if;
  update public.community_members set member_role=p_member_role,status=p_status where community_id=p_community_id and user_id=p_user_id returning * into new_row;
  insert into public.audit_events(community_id,actor_user_id,event_type,subject_type,subject_id,request_id,details) values(p_community_id,(select auth.uid()),'membership.changed','community_member',p_user_id,p_request_id,jsonb_build_object('oldRole',old_row.member_role,'newRole',new_row.member_role,'oldStatus',old_row.status,'newStatus',new_row.status));
  return jsonb_build_object('schemaVersion','1','communityId',new_row.community_id,'userId',new_row.user_id,'memberRole',new_row.member_role,'status',new_row.status,'marketAlias',new_row.market_alias,'joinedAt',new_row.joined_at,'updatedAt',new_row.updated_at);
end; $$;

create function public.operator_append_tariff(p_community_id uuid, p_feed_in_rate numeric, p_retail_rate numeric, p_seller_margin_ratio numeric, p_buyer_discount_ratio numeric, p_effective_from timestamptz, p_effective_to timestamptz, p_request_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare row public.tariff_configs;
begin
  if not private.is_active_operator(p_community_id) then raise exception 'forbidden' using errcode='42501'; end if;
  insert into public.tariff_configs(community_id,feed_in_rate,retail_rate,seller_margin_ratio,buyer_discount_ratio,effective_from,effective_to,created_by) values(p_community_id,p_feed_in_rate,p_retail_rate,p_seller_margin_ratio,p_buyer_discount_ratio,p_effective_from,p_effective_to,(select auth.uid())) returning * into row;
  insert into public.audit_events(community_id,actor_user_id,event_type,subject_type,subject_id,request_id,details) values(p_community_id,(select auth.uid()),'tariff.created','tariff',row.id,p_request_id,jsonb_build_object('tariffId',row.id,'effectiveFrom',row.effective_from,'effectiveTo',row.effective_to));
  return jsonb_build_object('schemaVersion','1','id',row.id,'communityId',row.community_id,'feedInRate',to_char(row.feed_in_rate,'FM9999999990.000000'),'retailRate',to_char(row.retail_rate,'FM9999999990.000000'),'sellerMarginRatio',to_char(row.seller_margin_ratio,'FM990.000000'),'buyerDiscountRatio',to_char(row.buyer_discount_ratio,'FM990.000000'),'effectiveFrom',row.effective_from,'effectiveTo',row.effective_to,'createdBy',row.created_by,'createdAt',row.created_at);
end; $$;

create function public.operator_append_feeder_snapshot(p_community_id uuid, p_market_interval_id uuid, p_capacity_kw numeric, p_load_kw numeric, p_source_type text, p_scenario_key text, p_source_record_key text, p_observed_at timestamptz, p_request_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare row public.feeder_snapshots;
begin
  if not private.is_active_operator(p_community_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_source_type<>'simulated' then raise exception 'operators may append simulated feeder input only' using errcode='42501'; end if;
  insert into public.feeder_snapshots(community_id,market_interval_id,capacity_kw,load_kw,congestion_ratio,source_type,scenario_key,source_record_key,observed_at,created_by) values(p_community_id,p_market_interval_id,p_capacity_kw,p_load_kw,round(least(p_load_kw/p_capacity_kw,1),6),p_source_type,p_scenario_key,p_source_record_key,p_observed_at,(select auth.uid())) returning * into row;
  insert into public.audit_events(community_id,actor_user_id,event_type,subject_type,subject_id,request_id,details) values(p_community_id,(select auth.uid()),'feeder.created','feeder_snapshot',row.id,p_request_id,jsonb_build_object('snapshotId',row.id,'scenarioKey',row.scenario_key));
  return jsonb_build_object('schemaVersion','1','id',row.id,'communityId',row.community_id,'intervalId',row.market_interval_id,'capacityKw',to_char(row.capacity_kw,'FM9999999990.000000'),'loadKw',to_char(row.load_kw,'FM9999999990.000000'),'congestionRatio',to_char(row.congestion_ratio,'FM990.000000'),'sourceType',row.source_type,'scenarioKey',row.scenario_key,'observedAt',row.observed_at,'createdAt',row.created_at);
end; $$;

create function public.operator_transition_interval(p_community_id uuid, p_market_interval_id uuid, p_target_status text, p_request_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare row public.market_intervals; declare old_status text;
begin
  if not private.is_active_operator(p_community_id) then raise exception 'forbidden' using errcode='42501'; end if;
  select status into strict old_status from public.market_intervals where community_id=p_community_id and id=p_market_interval_id for update;
  if not ((old_status='open' and p_target_status='paused') or (old_status='paused' and p_target_status in ('open','cancelled')) or (old_status='planned' and p_target_status='cancelled')) then raise exception 'invalid operator interval transition' using errcode='55000'; end if;
  update public.market_intervals set status=p_target_status where id=p_market_interval_id returning * into row;
  insert into public.audit_events(community_id,actor_user_id,event_type,subject_type,subject_id,request_id,details) values(p_community_id,(select auth.uid()),'interval.transitioned','market_interval',row.id,p_request_id,jsonb_build_object('oldStatus',old_status,'newStatus',row.status));
  return jsonb_build_object('schemaVersion','1','id',row.id,'communityId',row.community_id,'intervalStart',row.interval_start,'intervalEnd',row.interval_end,'status',row.status,'updatedAt',row.updated_at);
end; $$;

create function public.claim_outbox_events(p_worker_id text, p_limit integer default 25, p_claim_ttl_seconds integer default 300)
returns setof jsonb language plpgsql security definer set search_path = '' as $$
begin
  if btrim(p_worker_id)='' or p_limit<1 or p_limit>100 or p_claim_ttl_seconds<30 or p_claim_ttl_seconds>3600 then raise exception 'invalid claim parameters' using errcode='22023'; end if;
  perform set_config('solarshare.trusted_write','on',true);
  return query with candidates as (
    select id from public.outbox_events where ((status in ('pending','failed') and available_at<=statement_timestamp()) or (status='claimed' and claim_expires_at<=statement_timestamp())) and attempt_count<8 order by available_at,created_at,id limit p_limit for update skip locked
  ), claimed as (
    update public.outbox_events e set status='claimed',claimed_at=statement_timestamp(),claimed_by=p_worker_id,claim_token=gen_random_uuid(),claim_expires_at=statement_timestamp()+make_interval(secs=>p_claim_ttl_seconds),attempt_count=e.attempt_count+1,last_error_code=null from candidates c where e.id=c.id returning e.*
  ) select jsonb_build_object('eventId',id,'communityId',community_id,'topic',topic,'aggregateType',aggregate_type,'aggregateaggregateId',aggregate_id,'revision',revision::text,'payload',payload,'claimToken',claim_token,'claimExpiresAt',claim_expires_at,'attemptCount',attempt_count::text,'availableAt',available_at) from claimed;
end; $$;

create function public.complete_outbox_event(p_event_id uuid, p_claim_token uuid, p_delivered boolean, p_error_code text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare row public.outbox_events;
begin
  perform set_config('solarshare.trusted_write','on',true);
  select * into strict row from public.outbox_events where id=p_event_id for update;
  if row.status<>'claimed' or row.claim_token<>p_claim_token or row.claim_expires_at<=statement_timestamp() then raise exception 'stale outbox claim' using errcode='55000'; end if;
  if p_delivered then
    update public.outbox_events set status='delivered',delivered_at=statement_timestamp() where id=p_event_id returning * into row;
  elsif row.attempt_count>=8 then
    update public.outbox_events set status='failed',last_error_code=coalesce(nullif(p_error_code,''),'delivery_failed'),claimed_at=null,claimed_by=null,claim_token=null,claim_expires_at=null where id=p_event_id returning * into row;
  else
    update public.outbox_events set status='pending',available_at=statement_timestamp()+make_interval(secs=>least((30*power(2,row.attempt_count-1))::integer,3600)),last_error_code=coalesce(nullif(p_error_code,''),'delivery_failed'),claimed_at=null,claimed_by=null,claim_token=null,claim_expires_at=null where id=p_event_id returning * into row;
  end if;
  return jsonb_build_object('eventId',row.id,'communityId',row.community_id,'status',row.status,'attemptCount',row.attempt_count::text,'availableAt',row.available_at,'deliveredAt',row.delivered_at);
end; $$;
