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
  unique (community_id, asset_id, id),
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
  -- Entries may vanish only together with their parent transaction (demo reset).
  -- Every other write is validated, including trusted postings, because a balance
  -- guard exists to catch bugs in the trusted writer itself.
  if tg_op = 'DELETE' and not exists (select 1 from public.ledger_transactions where id = tx_id) then return null; end if;
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
  ) select jsonb_build_object('eventId',id,'communityId',community_id,'topic',topic,'aggregateType',aggregate_type,'aggregateId',aggregate_id,'revision',revision::text,'payload',payload,'claimToken',claim_token,'claimExpiresAt',claim_expires_at,'attemptCount',attempt_count::text,'availableAt',available_at) from claimed;
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

create function public.post_ledger_transaction(p_community_id uuid, p_settlement_id uuid, p_buyer_account_id uuid, p_seller_account_id uuid, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare request_hash text; declare prior public.idempotency_records; declare settlement public.settlements; declare allocation public.allocations; declare offer public.offers; declare reservation public.reservations; declare buyer public.credit_accounts; declare seller public.credit_accounts; declare transaction_id uuid;
begin
  if btrim(p_idempotency_key)='' then raise exception 'idempotency key is required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('solarshare:'||p_community_id::text,0));
  request_hash:=encode(extensions.digest(convert_to(jsonb_build_object('communityId',p_community_id,'settlementId',p_settlement_id,'buyerAccountId',p_buyer_account_id,'sellerAccountId',p_seller_account_id)::text,'UTF8'),'sha256'),'hex');
  select * into prior from public.idempotency_records where community_id=p_community_id and operation='ledger.post.v1' and idempotency_key=p_idempotency_key;
  if found then
    if prior.request_sha256<>request_hash then raise exception 'idempotency conflict' using errcode='23505'; end if;
    return nullif(prior.result->>'transactionId','')::uuid;
  end if;
  select * into strict settlement from public.settlements where id=p_settlement_id and community_id=p_community_id;
  select * into strict allocation from public.allocations where id=settlement.allocation_id;
  select * into strict offer from public.offers where id=allocation.offer_id;
  select * into strict reservation from public.reservations where id=allocation.reservation_id;
  select * into strict buyer from public.credit_accounts where id=p_buyer_account_id and community_id=p_community_id for update;
  select * into strict seller from public.credit_accounts where id=p_seller_account_id and community_id=p_community_id for update;
  if buyer.owner_user_id<>reservation.buyer_user_id or seller.owner_user_id<>offer.seller_user_id or buyer.currency<>seller.currency or buyer.id=seller.id then raise exception 'ledger accounts do not match trade parties' using errcode='23514'; end if;
  perform set_config('solarshare.trusted_write','on',true);
  if settlement.credit_amount>0 then
    transaction_id:=gen_random_uuid();
    insert into public.ledger_transactions(id,community_id,settlement_id,currency,amount,posted_at,scenario_generation_id) values(transaction_id,p_community_id,p_settlement_id,buyer.currency,settlement.credit_amount,statement_timestamp(),settlement.scenario_generation_id);
    insert into public.ledger_entries(community_id,ledger_transaction_id,account_id,entry_type,amount,scenario_generation_id) values
      (p_community_id,transaction_id,buyer.id,'debit',settlement.credit_amount,settlement.scenario_generation_id),
      (p_community_id,transaction_id,seller.id,'credit',settlement.credit_amount,settlement.scenario_generation_id);
    insert into public.audit_events(community_id,event_type,subject_type,subject_id,details) values(p_community_id,'ledger.posted','ledger_transaction',transaction_id,jsonb_build_object('transactionId',transaction_id,'amount',to_char(settlement.credit_amount,'FM9999999990.00')));
    insert into public.outbox_events(community_id,topic,aggregate_type,aggregate_id,revision,payload,scenario_generation_id) values(p_community_id,'ledger.posted','ledger_transaction',transaction_id,1,jsonb_build_object('communityId',p_community_id,'topic','ledger.posted','aggregateId',transaction_id,'revision','1'),settlement.scenario_generation_id);
  end if;
  insert into public.idempotency_records(community_id,operation,idempotency_key,request_sha256,status,result_version,result,completed_at) values(p_community_id,'ledger.post.v1',p_idempotency_key,request_hash,'completed','1',jsonb_build_object('transactionId',transaction_id),statement_timestamp());
  return transaction_id;
end; $$;

create function private.seed_demo_scenario(p_community_id uuid, p_anchor_date date, p_generation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare tz text; declare anchor_start timestamptz; declare history_start timestamptz; declare operator_id constant uuid:='20000000-0000-4000-8000-000000000001'; declare seller_id constant uuid:='20000000-0000-4000-8000-000000000002'; declare buyer1_id constant uuid:='20000000-0000-4000-8000-000000000003'; declare solar_id constant uuid:='30000000-0000-4000-8000-000000000001'; declare seller_meter constant uuid:='30000000-0000-4000-8000-000000000101'; declare interval_id uuid; declare history_interval_id uuid; declare pricing_id uuid; declare historical_offer uuid; declare historical_reservation uuid; declare allocation_id uuid; declare settlement_id uuid; declare tariff_id constant uuid:='40000000-0000-4000-8000-000000000001'; declare slot integer; declare generation numeric(16,6); declare seller_consumption numeric(16,6); declare buyer_no integer; declare buyer_value numeric(16,6); declare asset_id uuid; declare user_id uuid; declare reading_id uuid; declare transaction_id uuid; declare buyer_account uuid; declare seller_account uuid; declare counts jsonb;
begin
  select timezone into strict tz from public.communities where id=p_community_id;
  anchor_start:=(p_anchor_date::timestamp at time zone tz);
  history_start:=((p_anchor_date-1)::date::timestamp + time '12:00') at time zone tz;
  perform set_config('solarshare.trusted_write','on',true);

  for slot in 0..95 loop
    interval_id:=private.seed_uuid('1','interval','0:'||slot);
    insert into public.market_intervals(id,community_id,interval_start,interval_end,status,scenario_generation_id,created_at,updated_at) values(interval_id,p_community_id,anchor_start+slot*interval '15 minutes',anchor_start+(slot+1)*interval '15 minutes',case when slot=48 then 'open' else 'planned' end,p_generation_id,anchor_start-interval '1 day',anchor_start-interval '1 day');
    generation:=case when slot between 24 and 72 then round((1.10*sin(pi()*(slot-24)/48))::numeric,6) else 0 end;
    seller_consumption:=case when slot between 28 and 31 or slot between 48 and 51 then 0.320000 else 0.180000 end;
    reading_id:=private.seed_uuid('1','reading','0:'||slot||':'||solar_id||':generation:simulated');
    insert into public.energy_readings(id,community_id,asset_id,market_interval_id,metric,value_kwh,source_type,quality,source_record_key,original_value,original_unit,observed_at,retrieved_at,data_connection_id,scenario_generation_id,created_at) values(reading_id,p_community_id,solar_id,interval_id,'generation',generation,'simulated','estimated','generation:0:'||slot||':'||solar_id,generation,'kWh',anchor_start+(slot+1)*interval '15 minutes',anchor_start+(slot+1)*interval '15 minutes'+interval '1 minute',private.seed_uuid('1','connection',solar_id::text),p_generation_id,anchor_start-interval '1 day');
    insert into public.energy_readings(id,community_id,asset_id,market_interval_id,metric,value_kwh,source_type,quality,source_record_key,original_value,original_unit,observed_at,retrieved_at,data_connection_id,scenario_generation_id,created_at) values(private.seed_uuid('1','reading','0:'||slot||':'||seller_meter||':consumption:simulated'),p_community_id,seller_meter,interval_id,'consumption',seller_consumption,'simulated','estimated','consumption:0:'||slot||':'||seller_meter,seller_consumption,'kWh',anchor_start+(slot+1)*interval '15 minutes',anchor_start+(slot+1)*interval '15 minutes'+interval '1 minute',private.seed_uuid('1','connection',seller_meter::text),p_generation_id,anchor_start-interval '1 day');
    insert into public.energy_readings(id,community_id,asset_id,market_interval_id,metric,value_kwh,source_type,quality,source_record_key,original_value,original_unit,observed_at,retrieved_at,data_connection_id,scenario_generation_id,created_at) values(private.seed_uuid('1','reading','0:'||slot||':'||solar_id||':reserve:simulated'),p_community_id,solar_id,interval_id,'reserve',0.200000,'simulated','estimated','reserve:0:'||slot||':'||solar_id,0.200000,'kWh',anchor_start+(slot+1)*interval '15 minutes',anchor_start+(slot+1)*interval '15 minutes'+interval '1 minute',private.seed_uuid('1','connection',solar_id::text),p_generation_id,anchor_start-interval '1 day');
    for buyer_no in 1..4 loop
      asset_id:=('30000000-0000-4000-8000-'||lpad((100+buyer_no+1)::text,12,'0'))::uuid;
      buyer_value:=case buyer_no when 1 then 0.160000 when 2 then 0.200000 when 3 then 0.120000 else 0.180000 end + case when buyer_no=2 and slot between 48 and 51 then 0.180000 when buyer_no=4 and slot between 44 and 55 then 0.120000 else 0 end;
      insert into public.energy_readings(id,community_id,asset_id,market_interval_id,metric,value_kwh,source_type,quality,source_record_key,original_value,original_unit,observed_at,retrieved_at,data_connection_id,scenario_generation_id,created_at) values(private.seed_uuid('1','reading','0:'||slot||':'||asset_id||':consumption:simulated'),p_community_id,asset_id,interval_id,'consumption',buyer_value,'simulated','estimated','consumption:0:'||slot||':'||asset_id,buyer_value,'kWh',anchor_start+(slot+1)*interval '15 minutes',anchor_start+(slot+1)*interval '15 minutes'+interval '1 minute',private.seed_uuid('1','connection',asset_id::text),p_generation_id,anchor_start-interval '1 day');
    end loop;
    insert into public.forecasts(id,community_id,asset_id,market_interval_id,metric,value_kwh,source_type,model_version,source_record_key,issued_at,scenario_generation_id,created_at) values
      (private.seed_uuid('1','forecast','0:'||slot||':'||solar_id||':generation'),p_community_id,solar_id,interval_id,'generation',generation,'simulated','seed-v1','generation:0:'||slot,anchor_start-interval '6 hours',p_generation_id,anchor_start-interval '1 day'),
      (private.seed_uuid('1','forecast','0:'||slot||':'||seller_meter||':consumption'),p_community_id,seller_meter,interval_id,'consumption',seller_consumption,'simulated','seed-v1','consumption:0:'||slot,anchor_start-interval '6 hours',p_generation_id,anchor_start-interval '1 day'),
      (private.seed_uuid('1','forecast','0:'||slot||':'||solar_id||':reserve'),p_community_id,solar_id,interval_id,'reserve',0.200000,'simulated','seed-v1','reserve:0:'||slot,anchor_start-interval '6 hours',p_generation_id,anchor_start-interval '1 day'),
      (private.seed_uuid('1','forecast','0:'||slot||':'||solar_id||':surplus'),p_community_id,solar_id,interval_id,'surplus',greatest(generation-seller_consumption-0.200000,0),'simulated','seed-v1','surplus:0:'||slot,anchor_start-interval '6 hours',p_generation_id,anchor_start-interval '1 day');
    insert into public.feeder_snapshots(id,community_id,market_interval_id,capacity_kw,load_kw,congestion_ratio,source_type,scenario_key,source_record_key,observed_at,scenario_generation_id,created_at) values(private.seed_uuid('1','feeder',interval_id||':normal'),p_community_id,interval_id,25.000000,12.000000,0.480000,'simulated','normal','normal:'||interval_id,anchor_start+slot*interval '15 minutes',p_generation_id,anchor_start-interval '1 day');
  end loop;

  interval_id:=private.seed_uuid('1','interval','0:48');
  insert into public.feeder_snapshots(id,community_id,market_interval_id,capacity_kw,load_kw,congestion_ratio,source_type,scenario_key,source_record_key,observed_at,scenario_generation_id,created_at) values(private.seed_uuid('1','feeder',interval_id||':constrained'),p_community_id,interval_id,25,22.5,0.9,'simulated','constrained','constrained:'||interval_id,anchor_start+48*interval '15 minutes'+interval '1 minute',p_generation_id,anchor_start-interval '1 day');
  insert into public.offers(id,community_id,market_interval_id,seller_user_id,solar_asset_id,forecast_id,quantity_kwh,remaining_kwh,minimum_price,suggested_price,is_manual_quantity,auto_adjust,status,scenario_generation_id,created_at,updated_at) values('50000000-0000-4000-8000-000000000001',p_community_id,interval_id,seller_id,solar_id,private.seed_uuid('1','forecast','0:48:'||solar_id||':surplus'),0.8,0.8,4.5,5.75,true,false,'open',p_generation_id,anchor_start+47*interval '15 minutes',anchor_start+47*interval '15 minutes');
  for buyer_no in 1..4 loop
    user_id:=('20000000-0000-4000-8000-'||lpad((buyer_no+2)::text,12,'0'))::uuid;
    insert into public.reservations(id,community_id,market_interval_id,buyer_user_id,quantity_kwh,remaining_kwh,maximum_price,auto_adjust,status,scenario_generation_id,created_at,updated_at) values(('50000000-0000-4000-8000-'||lpad((100+buyer_no)::text,12,'0'))::uuid,p_community_id,interval_id,user_id,0.2,0.2,6.5,false,'active',p_generation_id,anchor_start+47*interval '15 minutes',anchor_start+47*interval '15 minutes');
  end loop;

  history_interval_id:=private.seed_uuid('1','interval','-1:48');
  insert into public.market_intervals(id,community_id,interval_start,interval_end,status,scenario_generation_id,created_at,updated_at) values(history_interval_id,p_community_id,history_start,history_start+interval '15 minutes','settled',p_generation_id,anchor_start-interval '1 day',anchor_start-interval '1 day');
  insert into public.energy_readings(id,community_id,asset_id,market_interval_id,metric,value_kwh,source_type,quality,source_record_key,original_value,original_unit,observed_at,retrieved_at,data_connection_id,scenario_generation_id,created_at) values
    (private.seed_uuid('1','reading','-1:48:'||solar_id||':generation:simulated'),p_community_id,solar_id,history_interval_id,'generation',0.58,'simulated','estimated','generation:-1:48:'||solar_id,0.58,'kWh',history_start+interval '15 minutes',history_start+interval '16 minutes',private.seed_uuid('1','connection',solar_id::text),p_generation_id,anchor_start-interval '1 day'),
    (private.seed_uuid('1','reading','-1:48:'||seller_meter||':consumption:simulated'),p_community_id,seller_meter,history_interval_id,'consumption',0.4,'simulated','estimated','consumption:-1:48:'||seller_meter,0.4,'kWh',history_start+interval '15 minutes',history_start+interval '16 minutes',private.seed_uuid('1','connection',seller_meter::text),p_generation_id,anchor_start-interval '1 day'),
    (private.seed_uuid('1','reading','-1:48:'||solar_id||':reserve:simulated'),p_community_id,solar_id,history_interval_id,'reserve',0,'simulated','estimated','reserve:-1:48:'||solar_id,0,'kWh',history_start+interval '15 minutes',history_start+interval '16 minutes',private.seed_uuid('1','connection',solar_id::text),p_generation_id,anchor_start-interval '1 day');
  insert into public.feeder_snapshots(id,community_id,market_interval_id,capacity_kw,load_kw,congestion_ratio,source_type,scenario_key,source_record_key,observed_at,scenario_generation_id,created_at) values(private.seed_uuid('1','feeder',history_interval_id||':normal'),p_community_id,history_interval_id,25,12,0.48,'simulated','normal','normal:'||history_interval_id,history_start,p_generation_id,anchor_start-interval '1 day');
  pricing_id:=private.seed_uuid('1','pricing',history_interval_id::text); historical_offer:=private.seed_uuid('1','offer','historical'); historical_reservation:=private.seed_uuid('1','reservation','historical'); allocation_id:=private.seed_uuid('1','allocation','historical'); settlement_id:=private.seed_uuid('1','settlement','historical');
  insert into public.pricing_snapshots(id,community_id,market_interval_id,tariff_config_id,feeder_snapshot_id,algorithm_version,supply_kwh,demand_kwh,unit_price,explanation,scenario_generation_id,created_at) values(pricing_id,p_community_id,history_interval_id,tariff_id,private.seed_uuid('1','feeder',history_interval_id||':normal'),'seed-v1',0.2,0.2,5.75,jsonb_build_object('schemaVersion','1','source','seed','reason','historical fixture'),p_generation_id,history_start);
  insert into public.offers(id,community_id,market_interval_id,seller_user_id,solar_asset_id,quantity_kwh,remaining_kwh,minimum_price,suggested_price,is_manual_quantity,status,scenario_generation_id,created_at,updated_at) values(historical_offer,p_community_id,history_interval_id,seller_id,solar_id,0.2,0,4.5,5.75,true,'closed',p_generation_id,history_start-interval '1 hour',history_start);
  insert into public.reservations(id,community_id,market_interval_id,buyer_user_id,quantity_kwh,remaining_kwh,maximum_price,status,scenario_generation_id,created_at,updated_at) values(historical_reservation,p_community_id,history_interval_id,buyer1_id,0.2,0,6.5,'closed',p_generation_id,history_start-interval '1 hour',history_start);
  insert into public.allocations(id,community_id,market_interval_id,offer_id,reservation_id,pricing_snapshot_id,allocated_kwh,unit_price,status,scenario_generation_id,created_at) values(allocation_id,p_community_id,history_interval_id,historical_offer,historical_reservation,pricing_id,0.2,5.75,'settled',p_generation_id,history_start);
  insert into public.settlements(id,community_id,allocation_id,delivered_kwh,unit_price,credit_amount,status,settled_at,scenario_generation_id,created_at) values(settlement_id,p_community_id,allocation_id,0.18,5.75,1.04,'completed',history_start+interval '16 minutes',p_generation_id,history_start+interval '16 minutes');
  insert into public.settlement_inputs(settlement_id,community_id,input_kind,energy_reading_id,scenario_generation_id,created_at) values
    (settlement_id,p_community_id,'generation',private.seed_uuid('1','reading','-1:48:'||solar_id||':generation:simulated'),p_generation_id,history_start+interval '16 minutes'),
    (settlement_id,p_community_id,'consumption',private.seed_uuid('1','reading','-1:48:'||seller_meter||':consumption:simulated'),p_generation_id,history_start+interval '16 minutes'),
    (settlement_id,p_community_id,'reserve',private.seed_uuid('1','reading','-1:48:'||solar_id||':reserve:simulated'),p_generation_id,history_start+interval '16 minutes');
  transaction_id:=private.seed_uuid('1','ledger_transaction','historical'); buyer_account:=private.seed_uuid('1','account',buyer1_id::text); seller_account:=private.seed_uuid('1','account',seller_id::text);
  insert into public.ledger_transactions(id,community_id,settlement_id,currency,amount,posted_at,scenario_generation_id,created_at) values(transaction_id,p_community_id,settlement_id,'INR',1.04,history_start+interval '16 minutes',p_generation_id,history_start+interval '16 minutes');
  insert into public.ledger_entries(id,community_id,ledger_transaction_id,account_id,entry_type,amount,scenario_generation_id,created_at) values
    (private.seed_uuid('1','ledger_entry','historical:debit'),p_community_id,transaction_id,buyer_account,'debit',1.04,p_generation_id,history_start+interval '16 minutes'),
    (private.seed_uuid('1','ledger_entry','historical:credit'),p_community_id,transaction_id,seller_account,'credit',1.04,p_generation_id,history_start+interval '16 minutes');
  insert into public.idempotency_records(id,community_id,operation,idempotency_key,request_sha256,status,result_version,result,created_at,completed_at) values(private.seed_uuid('1','idempotency','seed:historical-ledger'),p_community_id,'ledger.post.v1','seed:historical-ledger',encode(extensions.digest(convert_to('seed:historical-ledger','UTF8'),'sha256'),'hex'),'completed','1',jsonb_build_object('transactionId',transaction_id),history_start+interval '16 minutes',history_start+interval '16 minutes') on conflict (community_id,operation,idempotency_key) do nothing;
  insert into public.audit_events(id,community_id,event_type,subject_type,subject_id,details,occurred_at) values(private.seed_uuid('1','audit','ledger.posted'),p_community_id,'ledger.posted','ledger_transaction',transaction_id,jsonb_build_object('transactionId',transaction_id,'amount','1.04'),history_start+interval '16 minutes') on conflict (id) do nothing;
  insert into public.outbox_events(id,community_id,topic,aggregate_type,aggregate_id,revision,payload,status,available_at,attempt_count,delivered_at,scenario_generation_id,created_at) values(private.seed_uuid('1','outbox','ledger.posted'),p_community_id,'ledger.posted','ledger_transaction',transaction_id,1,jsonb_build_object('communityId',p_community_id,'topic','ledger.posted','aggregateId',transaction_id,'revision','1'),'delivered',history_start+interval '16 minutes',1,history_start+interval '16 minutes',p_generation_id,history_start+interval '16 minutes') on conflict (id) do nothing;
  counts:=jsonb_build_object('marketIntervals',97,'energyReadings',675,'forecasts',384,'feederSnapshots',98,'pricingSnapshots',1,'offers',2,'reservations',5,'allocations',1,'settlements',1,'settlementInputs',3,'ledgerTransactions',1,'ledgerEntries',2,'auditEvents',1,'idempotencyRecords',1,'outboxEvents',1);
  return counts;
end; $$;

create function public.reset_demo_community(p_community_id uuid, p_actor_user_id uuid, p_idempotency_key text, p_anchor_date date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare prior public.idempotency_records; declare request_hash text; declare resolved_anchor date; declare old_generation uuid; declare generation_id uuid; declare counts jsonb; declare result_value jsonb; declare tz text;
begin
  if p_community_id<>'10000000-0000-4000-8000-000000000001' or not exists(select 1 from public.communities where id=p_community_id and demo_seed_key='solarshare-demo-v1' and seed_version='1') then raise exception 'community is not the SolarShare demo' using errcode='42501'; end if;
  if not exists(select 1 from public.community_members where community_id=p_community_id and user_id=p_actor_user_id and member_role='operator' and status='active') then raise exception 'actor is not an active operator' using errcode='42501'; end if;
  if btrim(p_idempotency_key)='' then raise exception 'idempotency key is required' using errcode='22023'; end if;
  select * into prior from public.idempotency_records where community_id=p_community_id and operation='demo.reset.v1' and idempotency_key=p_idempotency_key;
  if found then return prior.result; end if;
  select timezone into strict tz from public.communities where id=p_community_id;
  resolved_anchor:=coalesce(p_anchor_date, ((statement_timestamp() at time zone tz)::date+1));
  request_hash:=encode(extensions.digest(convert_to(jsonb_build_object('communityId',p_community_id,'actorUserId',p_actor_user_id,'anchorDate',resolved_anchor)::text,'UTF8'),'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('solarshare:'||p_community_id::text,0));
  select scenario_generation_id into old_generation from public.market_intervals where community_id=p_community_id and scenario_generation_id is not null limit 1;
  generation_id:=private.seed_uuid('1','generation',p_community_id||':'||resolved_anchor);
  perform set_config('solarshare.trusted_write','on',true);
  update public.outbox_events set status='failed',last_error_code='demo_reset',claimed_at=null,claimed_by=null,claim_token=null,claim_expires_at=null where community_id=p_community_id and scenario_generation_id=old_generation and status in ('pending','claimed');
  delete from public.settlement_inputs where community_id=p_community_id and scenario_generation_id=old_generation;
  delete from public.ledger_entries where community_id=p_community_id and scenario_generation_id=old_generation;
  delete from public.ledger_transactions where community_id=p_community_id and scenario_generation_id=old_generation;
  delete from public.settlements where community_id=p_community_id and scenario_generation_id=old_generation;
  delete from public.allocations where community_id=p_community_id and scenario_generation_id=old_generation;
  delete from public.offers where community_id=p_community_id and scenario_generation_id=old_generation;
  delete from public.reservations where community_id=p_community_id and scenario_generation_id=old_generation;
  delete from public.pricing_snapshots where community_id=p_community_id and scenario_generation_id=old_generation;
  delete from public.feeder_snapshots where community_id=p_community_id and scenario_generation_id=old_generation;
  delete from public.forecasts where community_id=p_community_id and scenario_generation_id=old_generation;
  delete from public.energy_readings where community_id=p_community_id and scenario_generation_id=old_generation;
  delete from public.market_intervals where community_id=p_community_id and scenario_generation_id=old_generation;
  counts:=private.seed_demo_scenario(p_community_id,resolved_anchor,generation_id);
  result_value:=jsonb_build_object('schemaVersion','1','communityId',p_community_id,'generationId',generation_id,'anchorDate',resolved_anchor,'counts',counts);
  insert into public.audit_events(community_id,actor_user_id,event_type,subject_type,subject_id,request_id,details) values(p_community_id,p_actor_user_id,'demo.reset','community',p_community_id,p_idempotency_key,jsonb_build_object('generationId',generation_id,'anchorDate',resolved_anchor,'counts',counts));
  insert into public.outbox_events(community_id,topic,aggregate_type,aggregate_id,revision,payload) values(p_community_id,'demo.reset','community',p_community_id,extract(epoch from statement_timestamp())::bigint,jsonb_build_object('communityId',p_community_id,'topic','demo.reset','aggregateId',p_community_id,'revision',extract(epoch from statement_timestamp())::bigint));
  insert into public.idempotency_records(community_id,actor_user_id,operation,idempotency_key,request_sha256,status,result_version,result,completed_at) values(p_community_id,p_actor_user_id,'demo.reset.v1',p_idempotency_key,request_hash,'completed','1',result_value,statement_timestamp());
  return result_value;
end; $$;

create function private.derive_owner_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if tg_table_name='energy_assets' then new.owner_user_id=(select auth.uid());
  elsif tg_table_name='import_jobs' then new.uploader_user_id=(select auth.uid());
  elsif tg_table_name='offers' then new.seller_user_id=(select auth.uid()); new.remaining_kwh=new.quantity_kwh; new.status='draft'; new.version=1;
  elsif tg_table_name='reservations' then new.buyer_user_id=(select auth.uid()); new.remaining_kwh=new.quantity_kwh; new.status='pending'; new.version=1;
  end if;
  return new;
end; $$;

create trigger energy_assets_derive_owner before insert on public.energy_assets for each row execute function private.derive_owner_insert();
create trigger import_jobs_derive_owner before insert on public.import_jobs for each row execute function private.derive_owner_insert();
create trigger offers_derive_owner before insert on public.offers for each row execute function private.derive_owner_insert();
create trigger reservations_derive_owner before insert on public.reservations for each row execute function private.derive_owner_insert();

revoke all on all tables in schema public from anon, authenticated, service_role;
revoke all on all sequences in schema public from anon, authenticated, service_role;
revoke execute on all functions in schema private from public, anon, authenticated, service_role;

grant usage on schema public to authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.is_active_member(uuid), private.is_active_operator(uuid) to authenticated;

grant select on public.profiles to authenticated;
grant update (display_name,latitude_approx,longitude_approx,timezone) on public.profiles to authenticated;
grant select on public.communities,public.community_members,public.credit_accounts,public.energy_assets,public.data_connections,public.import_jobs,public.market_intervals,public.energy_readings,public.forecasts,public.tariff_configs,public.feeder_snapshots,public.pricing_snapshots,public.offers,public.reservations,public.allocations,public.settlements,public.settlement_inputs,public.ledger_transactions,public.ledger_entries to authenticated;
grant insert (id,community_id,asset_type,name,capacity_kw,tilt_degrees,azimuth_degrees,reserve_kwh,status,metadata) on public.energy_assets to authenticated;
grant update (name,capacity_kw,tilt_degrees,azimuth_degrees,reserve_kwh,status) on public.energy_assets to authenticated;
grant insert (id,community_id,asset_id,connection_type,provider,status) on public.data_connections to authenticated;
grant update (status) on public.data_connections to authenticated;
grant insert (id,community_id,asset_id,storage_object_path,file_sha256,status,warnings) on public.import_jobs to authenticated;
grant update (status,warnings) on public.import_jobs to authenticated;
grant insert (id,community_id,market_interval_id,solar_asset_id,forecast_id,batch_id,quantity_kwh,minimum_price,is_manual_quantity,auto_adjust) on public.offers to authenticated;
grant update (quantity_kwh,minimum_price,is_manual_quantity,auto_adjust,status) on public.offers to authenticated;
grant insert (id,community_id,market_interval_id,batch_id,quantity_kwh,maximum_price,auto_adjust) on public.reservations to authenticated;
grant update (quantity_kwh,maximum_price,auto_adjust,status) on public.reservations to authenticated;
grant select on public.own_profiles,public.own_assets,public.own_connections,public.own_imports,public.own_readings,public.own_forecasts,public.own_intervals,public.own_tariffs,public.own_feeders,public.own_offers,public.own_reservations,public.own_allocations,public.own_settlements,public.own_credit_accounts,public.own_ledger_entries to authenticated;

revoke execute on function public.select_preferred_energy_reading(uuid,uuid,uuid,text),public.select_current_forecast(uuid,uuid,uuid,text,timestamptz),public.read_community_marketplace(uuid,uuid,integer,jsonb),public.read_community_map(uuid,timestamptz,timestamptz,integer,jsonb),public.read_operator_members(uuid,integer,jsonb),public.read_operator_data_health(uuid,timestamptz,integer,jsonb),public.read_operator_market(uuid,integer,jsonb),public.read_operator_settlement_totals(uuid,integer,jsonb),public.read_operator_audit(uuid,integer,jsonb),public.read_action_receipts(uuid,integer,jsonb),public.read_own_credit_balances(uuid),public.operator_update_membership(uuid,uuid,text,text,text),public.operator_append_tariff(uuid,numeric,numeric,numeric,numeric,timestamptz,timestamptz,text),public.operator_append_feeder_snapshot(uuid,uuid,numeric,numeric,text,text,text,timestamptz,text),public.operator_transition_interval(uuid,uuid,text,text),public.claim_outbox_events(text,integer,integer),public.complete_outbox_event(uuid,uuid,boolean,text),public.post_ledger_transaction(uuid,uuid,uuid,uuid,text),public.reset_demo_community(uuid,uuid,text,date) from public,anon,authenticated,service_role;
grant execute on function public.select_preferred_energy_reading(uuid,uuid,uuid,text),public.select_current_forecast(uuid,uuid,uuid,text,timestamptz),public.read_community_marketplace(uuid,uuid,integer,jsonb),public.read_community_map(uuid,timestamptz,timestamptz,integer,jsonb),public.read_operator_members(uuid,integer,jsonb),public.read_operator_data_health(uuid,timestamptz,integer,jsonb),public.read_operator_market(uuid,integer,jsonb),public.read_operator_settlement_totals(uuid,integer,jsonb),public.read_operator_audit(uuid,integer,jsonb),public.read_action_receipts(uuid,integer,jsonb),public.read_own_credit_balances(uuid),public.operator_update_membership(uuid,uuid,text,text,text),public.operator_append_tariff(uuid,numeric,numeric,numeric,numeric,timestamptz,timestamptz,text),public.operator_append_feeder_snapshot(uuid,uuid,numeric,numeric,text,text,text,timestamptz,text),public.operator_transition_interval(uuid,uuid,text,text) to authenticated;
grant execute on function public.claim_outbox_events(text,integer,integer),public.complete_outbox_event(uuid,uuid,boolean,text),public.post_ledger_transaction(uuid,uuid,uuid,uuid,text),public.reset_demo_community(uuid,uuid,text,date) to service_role;

do $$
declare relation_name text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach relation_name in array array['profiles','communities','community_members','credit_accounts','energy_assets','data_connections','import_jobs','market_intervals','energy_readings','forecasts','tariff_configs','feeder_snapshots','pricing_snapshots','offers','reservations','allocations','settlements','settlement_inputs','ledger_transactions','ledger_entries','audit_events','idempotency_records','outbox_events'] loop
      if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=relation_name) then raise exception 'application table % must not be in supabase_realtime',relation_name; end if;
    end loop;
  end if;
end; $$;

commit;
