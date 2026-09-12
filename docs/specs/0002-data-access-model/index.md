# 0002. Establish the SolarShare data and access model

**Date**: 2026-09-12
**Status**: In Progress

## Summary

SolarShare will use one normalized PostgreSQL schema with a community key on every private or market record. Row Level Security will enforce household and community boundaries, while named database functions will own atomic or privileged work. This spec fixes the columns, constraints, policies, function signatures, repository ports, and repeatable demo data needed to build the complete trading demo without another foundation migration.

## Requirements

**User stories**:

1. As a household user, I want my identity, assets, readings, orders, settlements, and credits kept inside my household and community boundary so that another household cannot inspect or change them.
2. As an operator, I want to manage only my assigned community and see redacted operational data so that I can run the demo without receiving private household details.
3. As a trusted job, I want atomic and repeatable database operations so that retries and concurrent work do not duplicate energy, allocations, settlements, or ledger entries.
4. As a developer, I want one repeatable local seed and generated TypeScript types so that the full judge scenario can be recreated and queried without manual database edits.

**Acceptance criteria**:

1. **AC-1**: Applying all migrations to an empty local Supabase database, then applying `supabase/seed.sql`, creates every table, view, policy, implemented function, index, and deterministic demo record in this spec. The expressly reserved matching and settlement functions are excluded until their governing specs are accepted. Generated TypeScript types match the live schema without manual edits.
2. **AC-2**: Every application entity identifier is a UUID. Energy, power, prices, ratios, coordinates, and credits use the exact PostgreSQL numeric types in this spec. Application facing SQL results return those values as text, and adapters validate them as decimal strings before domain code receives them.
3. **AC-3**: Every community owned relationship is protected by a composite foreign key that includes `community_id`. Invalid intervals, quantities, ratios, source duplicates, and lifecycle states fail at the database boundary.
4. **AC-4**: Anonymous users receive no application table access. An authenticated household cannot read or mutate another household's private records, and membership in one community grants no access to another community.
5. **AC-5**: An active operator can manage memberships and market configuration only in an operated community. Operator reads use the redacted functions in this spec and do not expose raw readings, import object paths, stored coordinates, or another household's ledger.
6. **AC-6**: Readings and forecasts are append only. Corrections preserve prior versions, preferred reading selection follows the fixed source order, and a completed settlement retains the exact reading rows and pricing snapshot it used.
7. **AC-7**: Offers, reservations, allocations, settlements, ledger records, idempotency records, audit events, and outbox events obey the lifecycle, uniqueness, and immutability rules in this spec. A ledger transaction has exactly one equal debit and credit pair in one currency.
8. **AC-8**: Named database functions validate the actor, tenant, lifecycle, request hash, and idempotency key before privileged work. Ordinary browser and authenticated roles cannot execute trusted matching, settlement, outbox, or reset functions.
9. **AC-9**: The canonical seed creates the fixed community, users, memberships, assets, tariffs, intervals, readings, open market activity, historical settlement, and balanced ledger values in this spec. Reapplying the seed produces the same logical scenario without duplicate records.
10. **AC-10**: Reset accepts only the marked demo community, preserves Auth identities and core memberships, replaces only generated scenario rows, records an audit event, and leaves every other community unchanged.
11. **AC-11**: The repository ports in this spec use the caller bound Supabase client for household and operator work, use a secret client only inside trusted adapters, return domain records rather than generated row shapes, and expose no generic privileged query surface.
12. **AC-12**: Database integration checks prove tenant isolation, decimal and interval constraints, provenance selection, immutable records, balanced posting, retry safety, outbox claiming, and reset isolation against a live local database.

## Decision

**Chosen option**: Option 1: Community scoped relational model with server mediated access

Application services will use repositories backed by a Supabase client bound to the caller's cookie session. Row Level Security remains authoritative. The browser client is limited to Auth and privacy safe invalidation topics. Trusted workers use a separate secret client and only the named PostgreSQL functions listed below.

**Implementation skills**: `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `supabase-server` (`supabase/server`, `.agents/skills/supabase-server/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`)

## Feature design

### Shared database rules

1. Application tables live in `public`. Policy helpers live in the non exposed `private` schema. Callable functions live in `public`, use explicit grants, and qualify every object name. The Supabase API exposes only `public` and `graphql_public`.
2. Every UUID primary key defaults to `gen_random_uuid()`. Fixed UUIDs are supplied by the seed. Each community owned UUID table also has `unique (community_id, id)` so composite foreign keys can prove tenant consistency.
3. Mutable rows use `created_at timestamptz not null default now()` and `updated_at timestamptz not null default now()`. A shared trigger sets `updated_at`. Immutable rows have only `created_at` or their named event time.
4. Status and kind values use `text` with named check constraints. This keeps migrations explicit without binding generated TypeScript to PostgreSQL enum types.
5. Energy uses `numeric(16,6)`. Power and capacity use `numeric(12,6)`. Prices use `numeric(14,6)`. Ratios and coordinates use `numeric(9,6)`. Ledger values use `numeric(16,2)`. Application facing read functions cast every such field to canonical decimal text. Generated schema types remain unedited and never serve as domain types.
6. Nonnegative energy, power, price, ratio, and credit columns have named checks. They reject PostgreSQL `NaN`, positive infinity, and negative infinity. Latitude is between `-90` and `90`. Longitude is between `-180` and `180`. Ratios are between `0` and `1` unless a later pricing spec explicitly adds a different field. Zod rejects fractional scale beyond the target column before PostgreSQL can round it.
7. All stored instants use UTC `timestamptz`. A trigger validates community and profile timezones against `pg_timezone_names`. `market_intervals.interval_end` is exclusive and exactly fifteen minutes after `interval_start`. Interval start epoch seconds are divisible by `900`, so every row is on the canonical quarter hour grid.
8. Foreign keys required for history use `on delete restrict`. Ephemeral child metadata may use `on delete cascade` only where the parent is itself safe to delete before market use.
9. Every foreign key and every Row Level Security predicate has a matching index. Composite indexes put equality keys first and time ranges last. Partial indexes use the exact lifecycle predicate of the query they serve.
10. The migration revokes default privileges from `anon` and `authenticated`. It then grants only the table operations and function execution described in the access contract. `authenticated` receives `usage` on `private` plus execute on the two policy helpers because policies run with that role, but `private` remains outside PostgREST exposure.
11. JavaScript never receives a database `bigint` or `numeric` as a number. Read functions cast them to text. Repository inputs use validated strings and SQL casts them only inside the query or function call.
12. Every generated scenario row in `market_intervals`, `energy_readings`, `forecasts`, `feeder_snapshots`, `pricing_snapshots`, `offers`, `reservations`, `allocations`, `settlements`, `settlement_inputs`, `ledger_transactions`, `ledger_entries`, and `outbox_events` carries `scenario_generation_id uuid opt`. User created rows leave it null.

### Column contract

`req` means required. `opt` means nullable. Defaults are shown where they affect behavior.

| Table | Columns | Keys and checks |
|---|---|---|
| `profiles` | `id uuid req`, `display_name text req`, `latitude_approx numeric(9,6) opt`, `longitude_approx numeric(9,6) opt`, `timezone text req default 'Asia/Kolkata'`, `created_at timestamptz req`, `updated_at timestamptz req` | Primary key `id`, foreign key `id` to `auth.users(id)` with restrict. Coordinates are both null or both present and within range. `display_name` is not blank. Roles never live here. |
| `communities` | `id uuid req`, `name text req`, `join_code_hash text opt`, `timezone text req`, `currency text req default 'INR'`, `status text req default 'active'`, `demo_seed_key text opt`, `seed_version text opt`, `created_at timestamptz req`, `updated_at timestamptz req` | Primary key `id`. Unique non null `join_code_hash` and `demo_seed_key`. Status is `active`, `paused`, or `archived`. Currency is three uppercase letters. A demo key and seed version are both null or both present. Plain join codes are never stored. |
| `community_members` | `community_id uuid req`, `user_id uuid req`, `member_role text req`, `status text req default 'active'`, `market_alias text req`, `joined_at timestamptz req default now()`, `updated_at timestamptz req` | Primary key `(community_id, user_id)`. Foreign keys to `communities(id)` and `profiles(id)` with restrict. Unique `(community_id, market_alias)`. Role is `household` or `operator`. Status is `invited`, `active`, or `suspended`. Alias is not blank. |
| `credit_accounts` | `id uuid req`, `community_id uuid req`, `owner_user_id uuid req`, `currency text req`, `status text req default 'active'`, `created_at timestamptz req` | Primary key `id`, unique `(community_id, id)`, unique `(community_id, owner_user_id, currency)`. Composite foreign key `(community_id, owner_user_id)` to membership. Currency is three uppercase letters. Status is `active` or `closed`. |
| `energy_assets` | `id uuid req`, `community_id uuid req`, `owner_user_id uuid req`, `asset_type text req`, `name text req`, `capacity_kw numeric(12,6) req`, `tilt_degrees numeric(9,6) opt`, `azimuth_degrees numeric(9,6) opt`, `reserve_kwh numeric(16,6) req default 0`, `status text req default 'active'`, `metadata jsonb req default '{}'`, `version bigint req default 1`, `created_at timestamptz req`, `updated_at timestamptz req` | Primary key `id`, unique `(community_id, id)`. Composite foreign key to membership. Type is `solar`, `battery`, or `meter`. Status is `active`, `inactive`, or `retired`. Capacity and reserve are nonnegative. Tilt is from `0` to `90`. Azimuth is degrees clockwise from true north and is from `0` up to but not including `360`. Version is positive. |
| `data_connections` | `id uuid req`, `community_id uuid req`, `asset_id uuid req`, `connection_type text req`, `provider text req`, `status text req default 'pending'`, `credentials_ref text opt`, `last_sync_at timestamptz opt`, `last_error_code text opt`, `created_at timestamptz req`, `updated_at timestamptz req` | Primary key `id`, unique `(community_id, id)`. Composite foreign key to asset. Type is `model`, `csv`, `inverter_api`, `meter_api`, or `simulator`. Status is `pending`, `active`, `error`, or `revoked`. `credentials_ref` is an external secret reference, never a credential value. |
| `import_jobs` | `id uuid req`, `community_id uuid req`, `uploader_user_id uuid req`, `asset_id uuid req`, `storage_object_path text req`, `file_sha256 text req`, `status text req default 'uploaded'`, `accepted_rows bigint req default 0`, `rejected_rows bigint req default 0`, `warnings jsonb req default '[]'`, `committed_at timestamptz opt`, `created_at timestamptz req`, `updated_at timestamptz req` | Primary key `id`, unique `(community_id, id)`, unique `(community_id, uploader_user_id, file_sha256)`. Composite foreign keys to membership and asset. Status is `uploaded`, `validated`, `committed`, or `failed`. Row counts are nonnegative. Object paths are private and owner readable only. |
| `market_intervals` | `id uuid req`, `community_id uuid req`, `interval_start timestamptz req`, `interval_end timestamptz req`, `status text req default 'planned'`, `created_at timestamptz req`, `updated_at timestamptz req` | Primary key `id`, unique `(community_id, id)`, unique `(community_id, interval_start)`. Composite foreign key to community. End equals start plus fifteen minutes. Status is `planned`, `open`, `paused`, `matching`, `settlement_pending`, `settled`, or `cancelled`. |
| `energy_readings` | `id uuid req`, `community_id uuid req`, `asset_id uuid req`, `market_interval_id uuid req`, `metric text req`, `value_kwh numeric(16,6) req`, `source_type text req`, `quality text req`, `source_record_key text req`, `original_value numeric(16,6) req`, `original_unit text req`, `observed_at timestamptz req`, `retrieved_at timestamptz req default now()`, `data_connection_id uuid opt`, `import_job_id uuid opt`, `supersedes_id uuid opt`, `created_at timestamptz req` | Primary key `id`, unique `(community_id, id)`, unique `(community_id, asset_id, market_interval_id, metric, source_type, source_record_key)`. Composite foreign keys to asset, interval, optional connection, optional import, and optional superseded reading. Metric is `generation`, `consumption`, `grid_import`, `grid_export`, or `reserve`. Source is `connected`, `imported`, `modeled`, `stored_sample`, or `simulated`. Quality is `measured`, `estimated`, `corrected`, or `missing`. Values are nonnegative. A row cannot supersede itself. |
| `forecasts` | `id uuid req`, `community_id uuid req`, `asset_id uuid req`, `market_interval_id uuid req`, `metric text req`, `value_kwh numeric(16,6) req`, `confidence_low_kwh numeric(16,6) opt`, `confidence_high_kwh numeric(16,6) opt`, `source_type text req`, `model_version text req`, `source_record_key text req`, `source_summary jsonb req default '{}'`, `issued_at timestamptz req`, `supersedes_id uuid opt`, `created_at timestamptz req` | Primary key `id`, unique `(community_id, id)`, unique `(community_id, asset_id, market_interval_id, metric, source_type, source_record_key)`. Composite foreign keys to asset, interval, and optional superseded forecast. Metric is `generation`, `consumption`, `reserve`, or `surplus`. Source values match readings. Values are nonnegative. Confidence bounds are both null or ordered around value. |
| `tariff_configs` | `id uuid req`, `community_id uuid req`, `feed_in_rate numeric(14,6) req`, `retail_rate numeric(14,6) req`, `seller_margin_ratio numeric(9,6) req default 0`, `buyer_discount_ratio numeric(9,6) req default 0`, `effective_from timestamptz req`, `effective_to timestamptz opt`, `created_by uuid req`, `created_at timestamptz req` | Primary key `id`, unique `(community_id, id)`, unique `(community_id, effective_from)`. Composite foreign key for creator membership. Rates are nonnegative and feed in rate is less than retail rate. Ratios are from `0` to `1`. Effective end is after start. Versions are append only. |
| `feeder_snapshots` | `id uuid req`, `community_id uuid req`, `market_interval_id uuid req`, `capacity_kw numeric(12,6) req`, `load_kw numeric(12,6) req`, `congestion_ratio numeric(9,6) req`, `source_type text req`, `scenario_key text opt`, `source_record_key text req`, `observed_at timestamptz req`, `created_by uuid opt`, `created_at timestamptz req` | Primary key `id`, unique `(community_id, id)`, unique `(community_id, market_interval_id, source_type, source_record_key)`. Composite foreign keys to interval and optional creator membership. Capacity is positive, load is nonnegative, ratio is from `0` to `1`, and ratio equals `least(load_kw / capacity_kw, 1)` at six decimal places. Source is `connected` or `simulated`. Append only. |
| `pricing_snapshots` | `id uuid req`, `community_id uuid req`, `market_interval_id uuid req`, `tariff_config_id uuid req`, `feeder_snapshot_id uuid req`, `algorithm_version text req`, `supply_kwh numeric(16,6) req`, `demand_kwh numeric(16,6) req`, `unit_price numeric(14,6) req`, `explanation jsonb req`, `created_at timestamptz req` | Primary key `id`, unique `(community_id, id)`. Composite foreign keys to interval, tariff, and feeder snapshot. Numeric inputs are nonnegative. Unit price must be between the referenced feed in and retail rates. Append only. The pricing spec owns the algorithm and explanation schema. |
| `offers` | `id uuid req`, `community_id uuid req`, `market_interval_id uuid req`, `seller_user_id uuid req`, `solar_asset_id uuid req`, `forecast_id uuid opt`, `batch_id uuid opt`, `quantity_kwh numeric(16,6) req`, `remaining_kwh numeric(16,6) req`, `minimum_price numeric(14,6) opt`, `suggested_price numeric(14,6) opt`, `is_manual_quantity boolean req default false`, `auto_adjust boolean req default false`, `status text req default 'draft'`, `version bigint req default 1`, `created_at timestamptz req`, `updated_at timestamptz req` | Primary key `id`, unique `(community_id, id)`. Composite foreign keys to interval, seller membership, solar asset, and optional forecast. Quantity is positive. Remaining is from zero through quantity. Prices are nonnegative. Status is `draft`, `open`, `partly_matched`, `matched`, `closed`, or `cancelled`. Version is positive. |
| `reservations` | `id uuid req`, `community_id uuid req`, `market_interval_id uuid req`, `buyer_user_id uuid req`, `batch_id uuid opt`, `quantity_kwh numeric(16,6) req`, `remaining_kwh numeric(16,6) req`, `maximum_price numeric(14,6) opt`, `auto_adjust boolean req default false`, `status text req default 'pending'`, `version bigint req default 1`, `created_at timestamptz req`, `updated_at timestamptz req` | Primary key `id`, unique `(community_id, id)`. Composite foreign keys to interval and buyer membership. Quantity is positive. Remaining is from zero through quantity. Maximum price is nonnegative. Status is `pending`, `active`, `partly_matched`, `matched`, `closed`, or `cancelled`. Version is positive. |
| `allocations` | `id uuid req`, `community_id uuid req`, `market_interval_id uuid req`, `offer_id uuid req`, `reservation_id uuid req`, `pricing_snapshot_id uuid req`, `allocated_kwh numeric(16,6) req`, `unit_price numeric(14,6) req`, `status text req default 'allocated'`, `created_at timestamptz req` | Primary key `id`, unique `(community_id, id)`, unique `(offer_id, reservation_id, pricing_snapshot_id)`. Composite foreign keys to interval, offer, reservation, and pricing snapshot. Quantity is positive and price is nonnegative. Status is `allocated`, `reduced`, `settled`, or `cancelled`. Append only except the named settlement function may change status from `allocated` to `reduced` or `settled`. |
| `settlements` | `id uuid req`, `community_id uuid req`, `allocation_id uuid req`, `delivered_kwh numeric(16,6) req`, `unit_price numeric(14,6) req`, `credit_amount numeric(16,2) req`, `status text req default 'completed'`, `settled_at timestamptz req`, `created_at timestamptz req` | Primary key `id`, unique `(community_id, id)`, unique `allocation_id`. Composite foreign key to allocation. Delivered energy and credit are nonnegative. Status is only `completed` in Release 1. Credit equals allocation price times delivered energy rounded once, half up, to two places. Append only. |
| `settlement_inputs` | `settlement_id uuid req`, `community_id uuid req`, `input_kind text req`, `energy_reading_id uuid req`, `created_at timestamptz req` | Primary key `(settlement_id, input_kind)`. Composite foreign keys to settlement and reading. Kind is `generation`, `consumption`, or `reserve`, and the reading metric must match it through a deferred constraint trigger. Append only. |
| `ledger_transactions` | `id uuid req`, `community_id uuid req`, `settlement_id uuid req`, `currency text req`, `amount numeric(16,2) req`, `posted_at timestamptz req`, `created_at timestamptz req` | Primary key `id`, unique `(community_id, id)`, unique `settlement_id`. Composite foreign key to settlement. Amount is positive. Currency is three uppercase letters and matches both accounts. Append only. |
| `ledger_entries` | `id uuid req`, `community_id uuid req`, `ledger_transaction_id uuid req`, `account_id uuid req`, `entry_type text req`, `amount numeric(16,2) req`, `created_at timestamptz req` | Primary key `id`, unique `(community_id, id)`, unique `(ledger_transaction_id, entry_type)`. Composite foreign keys to transaction and account. Type is `debit` or `credit`. Amount is positive. A deferred constraint trigger requires exactly two entries with equal values, one of each type, before commit. Append only. |
| `audit_events` | `id uuid req`, `community_id uuid req`, `actor_user_id uuid opt`, `event_type text req`, `subject_type text req`, `subject_id uuid opt`, `request_id text opt`, `details jsonb req default '{}'`, `occurred_at timestamptz req default now()` | Primary key `id`, unique `(community_id, id)`. Composite foreign key for optional actor membership. Event and subject types are not blank. Details must contain redacted metadata only. Append only. |
| `idempotency_records` | `id uuid req`, `community_id uuid req`, `actor_user_id uuid opt`, `operation text req`, `idempotency_key text req`, `request_sha256 text req`, `status text req`, `result_version text req`, `result jsonb opt`, `error_code text opt`, `created_at timestamptz req`, `completed_at timestamptz opt` | Primary key `id`, unique `(community_id, operation, idempotency_key)`. Optional actor uses a composite membership foreign key. Status is `started`, `completed`, or `failed`. Request hash, result version, and keys are not blank. A repeated key with another hash is an error. Records are append only and ordinary users have no access. Transaction functions insert and complete the record in the same transaction, so a committed `started` row is forbidden. |
| `outbox_events` | `id uuid req`, `community_id uuid req`, `topic text req`, `aggregate_type text req`, `aggregate_id uuid req`, `revision bigint req`, `payload jsonb req default '{}'`, `status text req default 'pending'`, `available_at timestamptz req default now()`, `claimed_at timestamptz opt`, `claimed_by text opt`, `claim_token uuid opt`, `claim_expires_at timestamptz opt`, `attempt_count bigint req default 0`, `delivered_at timestamptz opt`, `last_error_code text opt`, `scenario_generation_id uuid opt`, `created_at timestamptz req` | Primary key `id`, unique `(community_id, id)`, unique `(community_id, aggregate_type, aggregate_id, revision, topic)`. Status is `pending`, `claimed`, `delivered`, or `failed`. Revision is positive and attempts are from `0` through `8`. All four claim fields are null or all are present. A delivered event has `delivered_at`; other states do not. Payload contains only community UUID, coarse topic, aggregate UUID, and revision. |

### Cross record constraints

1. `energy_assets` adds unique `(community_id, owner_user_id, id)`. An offer references `(community_id, seller_user_id, solar_asset_id)` and a check trigger requires the asset type to be `solar` and active.
2. `data_connections` adds unique `(community_id, asset_id, id)`. A reading connection reference includes community, asset, and connection. An import reference includes community, uploader, target asset, and import. This prevents another asset's provenance record from being borrowed.
3. `forecasts` adds unique `(community_id, asset_id, market_interval_id, id)`. An offer forecast reference includes seller asset and interval. The forecast metric must be `surplus`.
4. Intervals, feeder snapshots, pricing snapshots, offers, and reservations add unique keys beginning `(community_id, market_interval_id, id)` where needed. Allocation foreign keys include community and interval for the offer, reservation, and pricing snapshot. A constraint trigger rejects any disagreement.
5. A settlement uses the allocation's locked unit price and cannot deliver more than `allocated_kwh`. Its three input rows reference readings from the same community and interval. Generation and reserve belong to the seller's solar asset. Consumption belongs to an active meter owned by the seller. Exactly one input of each kind is required, including an explicit zero reserve reading.
6. A superseding reading or forecast keeps the same community, asset, interval, metric, and source type. It references an older created row and cannot create a cycle. The source record key remains unique.
7. A ledger transaction amount and currency match its settlement and both accounts. Buyer and seller accounts are distinct and owned by the reservation buyer and offer seller. A positive settlement requires exactly one transaction with one equal debit and credit line. A zero credit settlement creates no ledger transaction.
8. A credit account currency equals its community currency in Release 1. A deferred constraint trigger enforces this and every ledger rule before commit.
9. Tariff validity ranges are half open. A `btree_gist` exclusion constraint rejects overlapping ranges in one community. The version covering `market_intervals.interval_start` is authoritative.
10. Supported reading units are `kWh`, `Wh`, and `kW`. Normalization is unchanged for `kWh`, divides `Wh` by `1000`, and multiplies average `kW` by `0.25` for one interval. The normalized result rounds half up to six decimal places. Other units fail.

### Mutation authority

| Record | Caller editable fields | Database owned fields |
|---|---|---|
| Profile | `display_name`, both approximate coordinates together, `timezone` | `id`, audit times |
| Membership | Operator function may change `member_role` and `status` | Tenant, user, alias, joined time. The last active operator cannot be suspended or demoted. |
| Asset | Owner may change `name`, capacity, tilt, azimuth, reserve, and status | Tenant, owner, type, version, audit times. An asset referenced by an immutable market result cannot retire. |
| Connection | Owner may revoke. Trusted ingestion may change health fields | Tenant, asset, provider identity, audit times |
| Import | Owner may create and validate. Trusted commit owns committed counts and state | Tenant, uploader, asset, hash, committed time |
| Offer | Owner may change quantity, minimum price, manual flag, auto adjust, and move draft to open or an eligible state to cancelled | Tenant, seller, asset, interval, forecast, remaining quantity, matched states, version, audit times |
| Reservation | Owner may change quantity, maximum price, auto adjust, and move pending to active or an eligible state to cancelled | Tenant, buyer, interval, remaining quantity, matched states, version, audit times |
| Tariff and feeder | Operator may append a new version or snapshot | Existing versions are immutable |
| Interval | Operator function may pause, resume, or cancel an eligible interval | Matching and settlement functions own all other transitions |
| Allocation and settlement | No ordinary edits | Named matching and settlement functions only |
| Ledger, reading, forecast, audit, idempotency | No updates or deletes | Named trusted functions only where insertion is allowed |

Column grants and `before update` triggers enforce this table. Asset, offer, and reservation versions increment in the database. Linkage, ownership, remaining quantities, system states, version values, and audit timestamps cannot be supplied as user editable updates.

### Observation selection

1. A reading is eligible when its quality is not `missing`, its normalized value passed unit validation, and it is not superseded by another eligible row from the same lineage.
2. Reading order is source rank `connected`, `imported`, `modeled`, `stored_sample`, `simulated`, then `retrieved_at desc`, then `id desc`.
3. Only trusted ingestion can write `connected`, `modeled`, `stored_sample`, or `simulated`. A committed owner import writes `imported`. Ordinary table inserts cannot choose provenance.
4. A forecast is eligible when it is not superseded, `issued_at` is no later than the supplied `as_of`, and its bounds are valid. Selection orders `issued_at desc`, then `id desc`.
5. Settlement selection fixes `as_of` to the transaction start and records the returned reading identifiers before posting any result.

### State transitions

| Record | Allowed transitions | Enforcer |
|---|---|---|
| Membership | `invited` to `active`; `active` to `suspended`; `suspended` to `active` | Operator application service plus Row Level Security. Historical rows are not deleted. |
| Community | `active` to `paused`; `paused` to `active`; either to `archived` | Trusted operator function. Archived is terminal. |
| Interval | `planned` to `open`; `open` to `paused` or `matching`; `paused` to `open` or `cancelled`; `matching` to `settlement_pending`; `settlement_pending` to `settled`; non settled states to `cancelled` when no immutable result would be invalidated | Named transaction functions and a transition trigger. |
| Import | `uploaded` to `validated` or `failed`; `validated` to `committed` or `failed` | Owner application service and import commit function. Committed is terminal. |
| Offer | `draft` to `open` or `cancelled`; `open` to `partly_matched`, `matched`, `closed`, or `cancelled`; `partly_matched` to `matched`, `closed`, or `cancelled`; `matched` to `closed` | Owner services for draft and cancellation. Matching functions own matched states. |
| Reservation | `pending` to `active` or `cancelled`; `active` to `partly_matched`, `matched`, `closed`, or `cancelled`; `partly_matched` to `matched`, `closed`, or `cancelled`; `matched` to `closed` | Owner services for pending and cancellation. Matching functions own matched states. |
| Allocation | `allocated` to `reduced`, `settled`, or `cancelled`; `reduced` to `settled` | Settlement function owns reduced and settled. Matching may cancel only before settlement when its interval is cancelled. Settled and cancelled are terminal. |
| Outbox | `pending` to `claimed`; expired `claimed` to a new `claimed` lease; `claimed` to `delivered`; `claimed` to `pending` after a retryable failure; `claimed` to `failed` after attempt eight | Trusted outbox functions only. |

### Index contract

1. `community_members (user_id, status, community_id)` and partial `(community_id, user_id) where status = 'active'` support membership and policy checks.
2. Every community owned table has an index beginning with `community_id`. Every ownership table also indexes `(community_id, owner_user_id)` or its seller, buyer, or uploader equivalent.
3. `market_intervals (community_id, status, interval_start)` and partial `(community_id, interval_start) where status in ('open', 'matching', 'settlement_pending')` serve due work.
4. `energy_readings (community_id, asset_id, metric, market_interval_id, source_type, retrieved_at desc)` serves preferred selection.
5. `forecasts (community_id, asset_id, metric, market_interval_id, issued_at desc)` serves current forecast selection.
6. `offers (community_id, market_interval_id, minimum_price, created_at, id) where status in ('open', 'partly_matched')` and `reservations (community_id, market_interval_id, maximum_price desc, created_at, id) where status in ('active', 'partly_matched')` serve deterministic matching.
7. `allocations (community_id, market_interval_id, status, id)`, `settlements (community_id, settled_at desc)`, and `ledger_entries (community_id, account_id, created_at desc, id)` serve settlement and history.
8. `outbox_events (status, available_at, created_at, id) where status in ('pending', 'failed')` serves nonblocking claims.
9. All remaining foreign key columns receive a direct or left prefix composite index. The migration includes a verification query that reports any uncovered foreign key.

### Access contract

All exposed application tables enable and force Row Level Security. Policies wrap `auth.uid()` in a scalar subquery. Reusable checks call `private.is_active_member` and `private.is_active_operator`, both `security definer`, both with `set search_path = ''`, and both revoked from direct execution by `anon` and `authenticated`.

| Record or projection | Household access | Operator access | Trusted job access |
|---|---|---|---|
| `profiles` | Select and update only `id = auth.uid()`. Updates cannot change `id`. | No base table access. | No routine access. |
| `communities` | Select communities with an active membership. | Same, limited to operated communities for mutations. | Read by validated function only. |
| `community_members` | Select own rows. | Select and update rows in operated communities. Role and status changes create audit events. | Read by validated function only. |
| `credit_accounts` | Select own rows. No direct mutation. | No base access. | Posting function only. |
| Assets, connections, imports, readings, forecasts | Select own rows. Insert and allowed updates require the caller to own the active membership and target asset. Observations cannot update or delete. | `read_operator_data_health` only. | Future named ingestion and current selection functions. |
| Tariffs, feeder snapshots, intervals | Active members select current community values. | Append tariff and feeder versions, pause or resume through operator services. | Named pricing, matching, and settlement functions. |
| Offers and reservations | Owners select their full rows. Owners insert and update only editable fields while lifecycle permits. Counterparties use `read_community_marketplace`. No direct delete. | `read_operator_market` only. | Named matching function. |
| Allocations and settlements | A user selects a row when they own the referenced offer or reservation. No direct mutation. | `read_operator_market` and `read_operator_settlement_totals` only. | Named matching and settlement functions. |
| Ledger | Account owners select accounts and entries and call `read_own_credit_balances`. No direct mutation. | `read_operator_settlement_totals` only. | Named posting function. |
| Audit | `read_action_receipts` returns only the caller's own events. | `read_operator_audit` returns redacted events for operated communities. | Append within named functions. |
| Idempotency and outbox | No access. | No access. | Named functions only. |
| Demo reset | No access. | May request reset through a server action, but cannot execute SQL function directly. | Secret adapter calls the reset function with the operator UUID for revalidation. |

Owner and active member reads use `security_invoker` views named `own_profiles`, `own_assets`, `own_connections`, `own_imports`, `own_readings`, `own_forecasts`, `own_intervals`, `own_tariffs`, `own_feeders`, `own_offers`, `own_reservations`, `own_allocations`, `own_settlements`, `own_credit_accounts`, and `own_ledger_entries`. Each relies on the underlying table Row Level Security. It returns the allowed base columns, casts every numeric and bigint to canonical text, and omits secret references, internal scenario generation UUIDs, and raw idempotency or outbox state. Mutation repositories use minimal returning data, then refetch through the matching owner view. Adapter generated UUIDs provide the new entity key before insert.

Cross household and operator reads use fixed shape functions, not views. Each function validates `auth.uid()` inside a `security definer` body and returns only its approved fields. This is necessary because an invoker view cannot safely bypass the caller's private base table policies.

| Read function | Exact output fields | Inclusion and order |
|---|---|---|
| `read_community_marketplace` | `listingId uuid`, `communityId uuid`, `intervalId uuid`, `side text`, `alias text`, `availableKwh text`, `limitPrice text opt`, `status text`, `sourceLabel text`, `cursor jsonb` | Active offers with remaining energy and active reservations with remaining demand. Source label is `manual` when no forecast is pinned, otherwise the pinned forecast source. Order is `side asc, created_at asc, opaque listing UUID asc`. |
| `read_community_map` | `featureId uuid`, `latitude text`, `longitude text`, `hasSellerAvailability boolean`, `cursor jsonb` | Active household memberships with both coordinates. Availability means an active solar offer in the explicit `p_from` through `p_to` interval. Coordinates round to two decimals. Order is feature UUID ascending. |
| `read_operator_members` | `userId uuid`, `alias text`, `role text`, `status text`, `joinedAt timestamptz`, `cursor jsonb` | Members of an operated community. Order is alias ascending, then user UUID. No profile join. |
| `read_operator_data_health` | `alias text`, `assetId uuid`, `assetType text`, `connectionStatus text opt`, `lastSyncAt timestamptz opt`, `latestReadingAt timestamptz opt`, `freshness text`, `errorCode text opt`, `cursor jsonb` | All community assets. Freshness at explicit `p_as_of` is `missing`, `fresh` when latest reading is within thirty minutes, or `stale`. Order is alias then asset UUID. No reading value or private path is returned. |
| `read_operator_market` | `intervalId uuid`, `intervalStart timestamptz`, `side text`, `alias text`, `status text`, `quantityKwh text`, `remainingKwh text`, `allocatedKwh text`, `settledKwh text`, `cursor jsonb` | One row per pseudonymous order. Alias is the order owner's membership alias. Quantities aggregate only that order. Order is interval start descending, side, alias, then opaque listing UUID. |
| `read_operator_settlement_totals` | `intervalId uuid`, `intervalStart timestamptz`, `settledKwh text`, `totalInr text`, `cursor jsonb` | One row per settled interval. Order is interval start descending, then interval UUID. Empty totals are canonical `0.000000` kWh and `0.00` INR. |
| `read_operator_audit` | `eventId uuid`, `eventType text`, `alias text opt`, `subjectType text`, `requestId text opt`, `details jsonb`, `occurredAt timestamptz`, `cursor jsonb` | Redacted events for an operated community. Alias comes from the actor membership when `actor_user_id` is present, otherwise null. Order is occurred time descending, then event UUID descending. |
| `read_action_receipts` | `eventId uuid`, `eventType text`, `subjectType text`, `subjectId uuid opt`, `requestId text opt`, `details jsonb`, `occurredAt timestamptz`, `cursor jsonb` | Events whose actor is the current user. Order is occurred time descending, then event UUID descending. |
| `read_own_credit_balances` | `accountId uuid`, `communityId uuid`, `currency text`, `balance text` | Current user's accounts. Balance is credits minus debits and is `0.00` when no entry exists. Order is community UUID then account UUID. |

Every list function accepts `p_limit integer default 25` and `p_after jsonb default null`, except balance. Limit is from `1` through `100`. The cursor contains the exact ordered tuple shown above, using ISO timestamps and UUID or text values. Functions reject missing, extra, or mistyped cursor keys. The repository base64url encodes canonical JSON for transport and never treats the cursor as authorization.

`private.opaque_uuid(p_purpose text, p_community_id uuid, p_source_id uuid)` computes SHA 256 over UTF 8 bytes of `purpose || ':' || lower(community UUID) || ':' || lower(source UUID)`, sets RFC 4122 version and variant bits, and returns a UUID. Map uses purpose `map`; marketplace uses `market`. Null coordinates omit a map row.

Audit details use these fixed allowlists. `membership.changed` contains old and new role and status. `tariff.created` contains tariff UUID and effective range. `feeder.created` contains snapshot UUID and scenario key. `interval.transitioned` contains old and new state. `ledger.posted` contains transaction UUID and amount text. `demo.reset` contains generation UUID, anchor date, and named counts. No authenticated caller supplies arbitrary `details` JSON.

### PostgreSQL function surface

Function decimal inputs are PostgreSQL `numeric`, supplied from validated decimal strings. Application facing results cast every decimal and bigint to text before PostgREST serializes them. JSON results carry a `schemaVersion` and are validated by Zod.

| Function | Signature and result | Caller and behavior |
|---|---|---|
| `private.is_active_member` | `(p_community_id uuid) returns boolean` | Policy helper using only `auth.uid()`. Stable SQL, `security definer`, safe search path. Grant execute to `authenticated` only. |
| `private.is_active_operator` | `(p_community_id uuid) returns boolean` | Policy helper using only `auth.uid()`. Requires an active operator membership. Same grant. |
| `public.select_preferred_energy_reading` | `(p_community_id uuid, p_asset_id uuid, p_market_interval_id uuid, p_metric text) returns table (reading_id uuid, value_kwh text, source_type text, quality text, observed_at timestamptz, retrieved_at timestamptz)` | Caller bound client. Validates active membership and asset ownership. Uses the observation selection contract. Trusted settlement logic uses a private selector inside its own function. |
| `public.select_current_forecast` | `(p_community_id uuid, p_asset_id uuid, p_market_interval_id uuid, p_metric text, p_as_of timestamptz) returns table (forecast_id uuid, value_kwh text, confidence_low_kwh text, confidence_high_kwh text, source_type text, model_version text, issued_at timestamptz)` | Caller bound client. Validates asset ownership and uses the forecast selection contract. |
| `public.read_community_marketplace` | `(p_community_id uuid, p_market_interval_id uuid, p_limit integer default 25, p_after jsonb default null) returns setof jsonb` | Active member. Fixed output and order above. |
| `public.read_community_map` | `(p_community_id uuid, p_from timestamptz, p_to timestamptz, p_limit integer default 25, p_after jsonb default null) returns setof jsonb` | Active member. Requires `p_to` after `p_from` and at most seven days. |
| `public.read_operator_members` | `(p_community_id uuid, p_limit integer default 25, p_after jsonb default null) returns setof jsonb` | Active operator. Fixed output and order above. |
| `public.read_operator_data_health` | `(p_community_id uuid, p_as_of timestamptz, p_limit integer default 25, p_after jsonb default null) returns setof jsonb` | Active operator. Fixed output and order above. |
| `public.read_operator_market` | `(p_community_id uuid, p_limit integer default 25, p_after jsonb default null) returns setof jsonb` | Active operator. Fixed output and order above. |
| `public.read_operator_settlement_totals` | `(p_community_id uuid, p_limit integer default 25, p_after jsonb default null) returns setof jsonb` | Active operator. Fixed output and order above. |
| `public.read_operator_audit` | `(p_community_id uuid, p_limit integer default 25, p_after jsonb default null) returns setof jsonb` | Active operator. Fixed output and redaction allowlist above. |
| `public.read_action_receipts` | `(p_community_id uuid, p_limit integer default 25, p_after jsonb default null) returns setof jsonb` | Active member. Returns only events whose actor equals `auth.uid()`. |
| `public.read_own_credit_balances` | `(p_community_id uuid) returns setof jsonb` | Active member. Returns only the current user's accounts and canonical text balances. |
| `public.operator_update_membership` | `(p_community_id uuid, p_user_id uuid, p_member_role text, p_status text, p_request_id text) returns jsonb` | Active operator. Applies the mutation allowlist, prevents removal of the last active operator, writes `membership.changed`, and returns a versioned membership object. |
| `public.operator_append_tariff` | `(p_community_id uuid, p_feed_in_rate numeric, p_retail_rate numeric, p_seller_margin_ratio numeric, p_buyer_discount_ratio numeric, p_effective_from timestamptz, p_effective_to timestamptz, p_request_id text) returns jsonb` | Active operator. Rejects overlap and invalid corridor, inserts an immutable version, audits, and returns decimals as text. |
| `public.operator_append_feeder_snapshot` | `(p_community_id uuid, p_market_interval_id uuid, p_capacity_kw numeric, p_load_kw numeric, p_source_type text, p_scenario_key text, p_source_record_key text, p_observed_at timestamptz, p_request_id text) returns jsonb` | Active operator for simulated input. Computes congestion in the database, inserts an immutable snapshot, audits, and returns decimals as text. Connected input remains trusted only. |
| `public.operator_transition_interval` | `(p_community_id uuid, p_market_interval_id uuid, p_target_status text, p_request_id text) returns jsonb` | Active operator. Permits only pause, resume, and eligible cancellation, then audits the old and new state. |
| `public.claim_outbox_events` | `(p_worker_id text, p_limit integer default 25, p_claim_ttl_seconds integer default 300) returns setof jsonb` | Secret client only. Validates worker, limit, and TTL. Claims rows ordered by `available_at, created_at, id` using `for update skip locked`. Each claim gets a new token and expiry, and increments attempts. Expired claims are eligible. |
| `public.complete_outbox_event` | `(p_event_id uuid, p_claim_token uuid, p_delivered boolean, p_error_code text default null) returns jsonb` | Secret client only. Requires the current unexpired token. Success delivers. Failure returns to pending with `available_at = now() + make_interval(secs => least((30 * power(2, attempt_count - 1))::integer, 3600))`, or becomes terminal failed after attempt eight. |
| `public.post_ledger_transaction` | `(p_community_id uuid, p_settlement_id uuid, p_buyer_account_id uuid, p_seller_account_id uuid, p_idempotency_key text) returns uuid` | Secret client only. Computes the canonical request hash in PostgreSQL. Validates all ledger rules and inserts transaction, entries, audit, and outbox atomically. A zero credit settlement stores the replay result and returns null without ledger rows. |
| `public.reset_demo_community` | `(p_community_id uuid, p_actor_user_id uuid, p_idempotency_key text, p_anchor_date date default null) returns jsonb` | Secret client only. Revalidates the operator and fixed demo identity, resolves null anchor once, computes the hash, takes the community transaction lock, replaces only generated scenario rows, and returns `{schemaVersion, communityId, generationId, anchorDate, counts}`. Replay returns the stored result. |
| `public.match_market_interval` | `(p_community_id uuid, p_market_interval_id uuid, p_idempotency_key text) returns jsonb` | Reserved contract for the matching spec. Secret client only. Later migration supplies the body. No placeholder is created now. |
| `public.settle_market_interval` | `(p_community_id uuid, p_market_interval_id uuid, p_idempotency_key text) returns jsonb` | Reserved contract for the settlement spec. Secret client only. Later migration supplies the body. No placeholder is created now. |

Every `security definer` function sets `search_path = ''`, qualifies all identifiers, and validates `auth.uid()` or the explicit actor. Read and operator functions grant execute only to `authenticated`. Trusted functions grant execute only to `service_role`. Helpers have the narrow grant described above. The browser cannot execute trusted functions. No application base table is added to the Realtime publication.

Idempotent functions use fixed operation names such as `ledger.post.v1` and `demo.reset.v1`. PostgreSQL computes SHA 256 over canonical `jsonb_build_object` semantic inputs, including actor where relevant and excluding transport fields. A unique key is inserted and completed in the same transaction. Same key and same hash returns the immutable stored result. Same key and another hash raises conflict. A null reset anchor is resolved before hashing and the stored anchor is replayed on later days.

Ingestion, import commit, pricing, matching, and settlement algorithms are outside this migration. Their later specs may add functions without changing these tables. This migration reserves only the two signatures shown above and creates no placeholder body.

### Repository surface

Repositories live under `src/repositories`. They accept `SupabaseClient<Database>` through a factory and do not create clients themselves. Application services pass the caller bound client from `src/lib/supabase/server.ts`. Trusted worker adapters pass a secret client from the worker configuration boundary. Every method returns a domain record or a typed repository error.

```ts
type DecimalString = string;
type PageRequest = { limit: number; cursor?: string };
type Page<T> = { items: T[]; nextCursor?: string };

interface ProfileRepository {
  getOwnProfile(): Promise<Profile | null>;
  updateOwnProfile(input: UpdateProfileInput): Promise<Profile>;
}

interface CommunityRepository {
  listOwnMemberships(): Promise<CommunityMembership[]>;
  getCommunity(communityId: string): Promise<Community | null>;
  listMarketplace(communityId: string, intervalId: string, page: PageRequest): Promise<Page<MarketplaceItem>>;
  listMapFeatures(communityId: string, from: string, to: string, page: PageRequest): Promise<Page<MapFeature>>;
  listOperatorMembers(communityId: string, page: PageRequest): Promise<Page<OperatorMember>>;
}

interface AssetRepository {
  listOwned(communityId: string, page: PageRequest): Promise<Page<EnergyAsset>>;
  getOwned(assetId: string): Promise<EnergyAsset | null>;
  create(input: CreateEnergyAssetInput): Promise<EnergyAsset>;
  update(assetId: string, expectedVersion: number, input: UpdateEnergyAssetInput): Promise<EnergyAsset>;
}

interface EnergyDataRepository {
  selectPreferredReading(input: SelectReadingInput): Promise<SelectedReading | null>;
  selectCurrentForecast(input: SelectForecastInput): Promise<Forecast | null>;
  listForecasts(assetId: string, from: string, to: string, asOf: string, page: PageRequest): Promise<Page<Forecast>>;
}

interface MarketRepository {
  listIntervals(communityId: string, from: string, to: string, page: PageRequest): Promise<Page<MarketInterval>>;
  createOffer(input: CreateOfferInput): Promise<Offer>;
  updateOffer(id: string, expectedVersion: number, input: UpdateOfferInput): Promise<Offer>;
  createReservation(input: CreateReservationInput): Promise<Reservation>;
  updateReservation(id: string, expectedVersion: number, input: UpdateReservationInput): Promise<Reservation>;
  getAllocation(id: string): Promise<AllocationDetail | null>;
  listOwnSettlements(communityId: string, page: PageRequest): Promise<Page<SettlementDetail>>;
}

interface LedgerRepository {
  listOwnAccounts(communityId: string): Promise<CreditAccount[]>;
  listOwnEntries(accountId: string, page: PageRequest): Promise<Page<LedgerEntry>>;
  getOwnBalance(accountId: string): Promise<DecimalString>;
}

interface OperatorRepository {
  listDataHealth(communityId: string, asOf: string, page: PageRequest): Promise<Page<DataHealthItem>>;
  listMarketSummary(communityId: string, page: PageRequest): Promise<Page<OperatorMarketItem>>;
  listAuditEvents(communityId: string, page: PageRequest): Promise<Page<OperatorAuditEvent>>;
  updateMembership(input: UpdateMembershipInput): Promise<CommunityMembership>;
  appendTariff(input: AppendTariffInput): Promise<TariffConfig>;
  appendFeederSnapshot(input: AppendFeederSnapshotInput): Promise<FeederSnapshot>;
  transitionInterval(input: TransitionIntervalInput): Promise<MarketInterval>;
}

interface TrustedOperationsRepository {
  claimOutbox(workerId: string, limit: number, claimTtlSeconds: number): Promise<OutboxEvent[]>;
  completeOutbox(input: CompleteOutboxInput): Promise<OutboxEvent>;
  postLedger(input: PostLedgerInput): Promise<string | null>;
  resetDemo(input: ResetDemoInput): Promise<ResetDemoResult>;
}
```

Input and result names above have these exact fields. Fields marked optional may be omitted. Database defaults supply identifiers, timestamps, initial states, remaining quantity, and versions unless a deterministic seed supplies them.

| Type | Fields |
|---|---|
| `UpdateProfileInput` | `displayName text optional`, `latitudeApprox DecimalString optional`, `longitudeApprox DecimalString optional`, `timezone text optional`. Coordinate fields appear together. |
| `CreateEnergyAssetInput` | `communityId uuid`, `assetType solar or battery or meter`, `name text`, `capacityKw DecimalString`, `tiltDegrees DecimalString optional`, `azimuthDegrees DecimalString optional`, `reserveKwh DecimalString`. Owner is the current user. |
| `UpdateEnergyAssetInput` | Any of `name`, `capacityKw`, `tiltDegrees`, `azimuthDegrees`, `reserveKwh`, or `targetStatus active or inactive or retired`, with at least one present. Tenant, owner, type, version, and times are excluded. |
| `SelectReadingInput` | `communityId uuid`, `assetId uuid`, `intervalId uuid`, `metric text`. |
| `SelectForecastInput` | `communityId uuid`, `assetId uuid`, `intervalId uuid`, `metric text`, `asOf ISO timestamptz`. |
| `CreateOfferInput` | `communityId uuid`, `intervalId uuid`, `solarAssetId uuid`, `forecastId uuid optional`, `batchId uuid optional`, `quantityKwh DecimalString`, `minimumPrice DecimalString optional`, `isManualQuantity boolean`, `autoAdjust boolean`. Seller and initial remaining quantity derive in the database. |
| `UpdateOfferInput` | `quantityKwh`, `minimumPrice`, `isManualQuantity`, `autoAdjust`, or owner target state `open` or `cancelled`. System states and remaining quantity are excluded. |
| `CreateReservationInput` | `communityId uuid`, `intervalId uuid`, `batchId uuid optional`, `quantityKwh DecimalString`, `maximumPrice DecimalString optional`, `autoAdjust boolean`. Buyer and initial remaining quantity derive in the database. |
| `UpdateReservationInput` | `quantityKwh`, `maximumPrice`, `autoAdjust`, or owner target state `active` or `cancelled`. System states and remaining quantity are excluded. |
| `UpdateMembershipInput` | `communityId uuid`, `userId uuid`, `memberRole text`, `status text`, `requestId text`. |
| `AppendTariffInput` | The exact `operator_append_tariff` parameters excluding current actor. Numeric values are decimal strings. |
| `AppendFeederSnapshotInput` | The exact `operator_append_feeder_snapshot` parameters excluding current actor. Numeric values are decimal strings. |
| `TransitionIntervalInput` | `communityId uuid`, `intervalId uuid`, `targetStatus paused or open or cancelled`, `requestId text`. |
| `CompleteOutboxInput` | `eventId uuid`, `claimToken uuid`, `delivered boolean`, `errorCode text optional`. |
| `PostLedgerInput` | `communityId uuid`, `settlementId uuid`, `buyerAccountId uuid`, `sellerAccountId uuid`, `idempotencyKey text`. Amount and currency derive from the settlement and accounts. |
| `ResetDemoInput` | `communityId uuid`, `actorUserId uuid`, `idempotencyKey text`, `anchorDate ISO date optional`. The application service obtains actor UUID from the verified session rather than request data. |
| `ResetDemoResult` | `schemaVersion '1'`, `communityId uuid`, `generationId uuid`, `anchorDate ISO date`, `counts` with every fixture count named in the seed contract. |

Every domain record mirrors its named public output, uses camel case, represents all decimal and bigint values as strings, and excludes database only fields unless the application needs them. `MarketplaceItem`, `MapFeature`, `DataHealthItem`, `OperatorMarketItem`, `OperatorAuditEvent`, and `ResetDemoResult` match their function output fields exactly. `OutboxEvent` includes event UUID, community UUID, topic, aggregate type and UUID, revision string, payload, claim token, claim expiry, attempt count string, and available time.

| Domain record | Exact fields |
|---|---|
| `Profile` | `id`, `displayName`, `latitudeApprox`, `longitudeApprox`, `timezone`, `createdAt`, `updatedAt` |
| `Community` | `id`, `name`, `timezone`, `currency`, `status` |
| `CommunityMembership` | `communityId`, `userId`, `memberRole`, `status`, `marketAlias`, `joinedAt`, `updatedAt` |
| `CreditAccount` | `id`, `communityId`, `currency`, `status`, `createdAt` |
| `EnergyAsset` | `id`, `communityId`, `assetType`, `name`, `capacityKw`, `tiltDegrees`, `azimuthDegrees`, `reserveKwh`, `status`, `version`, `createdAt`, `updatedAt` |
| `SelectedReading` | `readingId`, `valueKwh`, `sourceType`, `quality`, `observedAt`, `retrievedAt` |
| `Forecast` | `forecastId`, `assetId`, `intervalId`, `metric`, `valueKwh`, `confidenceLowKwh`, `confidenceHighKwh`, `sourceType`, `modelVersion`, `issuedAt` |
| `MarketInterval` | `id`, `communityId`, `intervalStart`, `intervalEnd`, `status`, `updatedAt` |
| `Offer` | `id`, `communityId`, `intervalId`, `solarAssetId`, `forecastId`, `batchId`, `quantityKwh`, `remainingKwh`, `minimumPrice`, `suggestedPrice`, `isManualQuantity`, `autoAdjust`, `status`, `version`, `createdAt`, `updatedAt` |
| `Reservation` | `id`, `communityId`, `intervalId`, `batchId`, `quantityKwh`, `remainingKwh`, `maximumPrice`, `autoAdjust`, `status`, `version`, `createdAt`, `updatedAt` |
| `AllocationDetail` | Allocation UUID, interval UUID, allocated and delivered kWh text, locked unit price text, allocation status, pricing algorithm version, pricing explanation, settlement UUID optional, settlement status optional, settled time optional |
| `SettlementDetail` | Settlement UUID, allocation UUID, interval bounds, counterparty alias, delivered kWh text, unit price text, credit amount text, status, settled time, and coarse input source labels. Exact private reading UUIDs appear only when the current user owns those readings. |
| `LedgerEntry` | `id`, `accountId`, `entryType`, `amount`, `createdAt`, plus transaction and settlement UUIDs |
| `TariffConfig` | `id`, `communityId`, all four decimal rate fields as text, effective bounds, creator UUID, created time |
| `FeederSnapshot` | `id`, `communityId`, `intervalId`, capacity, load, and ratio as text, source, scenario key, observed time, created time |

The reset application service accepts only `communityId` and `idempotencyKey` from the request. It obtains `actorUserId` from the verified session, confirms operator capability with a caller bound repository, then calls the secret adapter. Neither actor UUID nor anchor date is accepted from a production browser request. Tests may supply an anchor date directly to the trusted repository.

Repository rules:

1. Inputs are parsed with Zod before a query. UUIDs, timestamps, cursors, statuses, and decimals are never accepted as unchecked strings.
2. `DecimalString` values match `^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$` for energy and prices, and use at most two decimal places for ledger values. Negative signs are permitted only for derived balance output.
3. Cursor pagination encodes the ordered key tuple, never an offset. Default limit is `25`, maximum is `100`.
4. Asset, offer, and reservation update methods require an expected version and use `where version = expectedVersion`. A zero row update maps to `conflict`, not `not_found`, after an authorized existence check. Append only configuration methods create a new version rather than updating an old row.
5. Repositories map PostgreSQL errors to `not_found`, `forbidden`, `conflict`, `invalid_state`, `invalid_input`, or `unavailable`. They do not expose policy, table, or constraint internals to interface code.
6. Generated row types stay in the adapter. Domain records use names from this spec and preserve decimals and bigint values as strings.
7. There is no `adminQuery`, generic table name, or raw SQL method. Trusted operations expose only named function wrappers.
8. This foundation creates the interfaces, input schemas, output schemas, shared mappers, errors, all read function wrappers, operator function wrappers, trusted outbox, ledger, and reset wrappers, plus asset, offer, and reservation owner writes. Later ingestion, pricing, matching, and settlement features add only their expressly reserved methods.

### Value sourcing

| Action | Value produced or displayed | Source |
|---|---|---|
| Resolve current identity | User UUID | Verified Supabase Auth session claim `sub`, surfaced as `auth.uid()` in PostgreSQL. |
| Resolve tenant access | Community and capability | Active `community_members` row for the current user. Role comes only from `member_role`. |
| Present an interval | UTC bounds and local label | Bounds come from `market_intervals`. Local label derives from `communities.timezone`. |
| Persist energy or price | Exact decimal | Validated decimal string input converted to the column's named `numeric` type. Never a JavaScript number. |
| Select a final reading | Reading identifier, value, source, and quality | `select_preferred_energy_reading` over immutable `energy_readings` with the fixed source order. |
| Show a current forecast | Value, confidence, source, and issue time | `select_current_forecast` with explicit `as_of`, using the fixed valid forecast order. |
| Select market configuration | Tariff and feeder snapshot identifiers | Half open tariff range containing interval start. Latest eligible feeder `observed_at`, then UUID descending. A scenario switch appends a newer feeder snapshot. Pricing pins both identifiers. |
| Show marketplace availability | Alias, interval, quantity, price limit, and source label | `read_community_marketplace`, derived from active orders, membership alias, interval, and pinned forecast source. Zero remaining orders are excluded. |
| Show map activity | Anonymous feature UUID, rounded point, and seller availability | `read_community_map`, derived by the exact opaque UUID function, profile coordinates rounded to two decimals, and active offers inside explicit time bounds. |
| Show operator health | Alias, connection state, latest timestamps, freshness, and error code | `read_operator_data_health` with explicit `as_of` and thirty minute threshold. Assets without data return `missing`. No raw value is selected. |
| Show allocation or settlement | Quantity, price, state, credit, and source explanation | Locked allocation columns, pricing snapshot, completed settlement, and settlement input reading identifiers. |
| Show credit balance | INR balance | `read_own_credit_balances`, derived as credits minus debits from immutable ledger entries. Empty balance is `0.00`. Currency comes from `credit_accounts.currency`. |
| Claim outbox work | Event, token, expiry, attempt, and payload | `claim_outbox_events`, ordered by availability, creation time, and UUID. Token is a new database UUID, expiry derives from database time plus validated TTL, and attempt increments at claim. |
| Repeat a command | Original result or hash conflict | `idempotency_records` by fixed operation name and key. PostgreSQL hashes canonical semantic inputs. Same hash returns stored result. Another hash returns conflict. |
| Reset the demo | Anchor date, row counts, and seed version | Explicit input or tomorrow in `communities.timezone`, fixed seed constants below, and the target community's `seed_version`. |

### Demo reset contract

1. `private.seed_uuid(seed_version, record_kind, stable_key)` returns a deterministic UUID by hashing UTF 8 text `seed_version || ':' || record_kind || ':' || stable_key` with SHA 256, taking the first 32 hexadecimal characters, setting RFC 4122 version and variant bits, and casting to UUID.
2. Scenario generation UUID uses record kind `generation` and stable key `community UUID || ':' || anchor date`. Every resettable row carries it.
3. Reset accepts only community `10000000-0000-4000-8000-000000000001` with demo key `solarshare-demo-v1` and seed version `1`. Caller text cannot select another seed implementation.
4. Reset and every trusted writer take `pg_advisory_xact_lock(hashtextextended('solarshare:' || community UUID, 0))` before changing scenario rows. External calls occur outside that transaction.
5. Reset preserves Auth users, profiles, memberships, credit accounts, user created rows with null generation UUID, all audit events, all idempotency records, and delivered outbox events. It moves pending or claimed events for the replaced generation to terminal failed with error `demo_reset`.
6. Reset deletes only rows with the replaced generation UUID, in foreign key order, using a private function that is executable only from `reset_demo_community`. This is the sole exception to ordinary immutability guards.
7. Reset first rejects any preserved row that has a foreign key to a row selected for deletion. It then recreates one full scenario in the same transaction and appends `demo.reset` audit and outbox events.
8. A new idempotency key with no anchor resolves tomorrow once in community time before hashing. Replay on a later day returns the stored anchor, generation UUID, and counts.

### Seed contract

`DEMO_SEED` is `solarshare-demo-v1`. The fixed anchor date for `supabase/seed.sql` is `2026-09-13`. Seed origin time is previous local day midnight converted to UTC. All core creation and join times use that origin unless a row below gives a relative time. The in application reset uses tomorrow in the community timezone unless a test supplies an anchor date. Core identifiers remain stable across both paths.

| Record | Fixed value |
|---|---|
| Community | ID `10000000-0000-4000-8000-000000000001`, name `SolarShare Bengaluru Demo`, timezone `Asia/Kolkata`, currency `INR`, demo key `solarshare-demo-v1`, seed version `1`, active status. |
| Operator | User ID `20000000-0000-4000-8000-000000000001`, email `operator@solarshare.local`, display name `Mira Operator`, alias `Grid Guide`, active operator membership. |
| Seller | User ID `20000000-0000-4000-8000-000000000002`, email `seller@solarshare.local`, display name `Asha Solar Home`, alias `Sun Home`, active household membership. |
| Buyers | User IDs ending `0003` through `0006`, emails `buyer1@solarshare.local` through `buyer4@solarshare.local`, display names `Ravi Buyer`, `Leela Buyer`, `Noor Buyer`, and `Kabir Buyer`, aliases `Lotus Home`, `Mango Home`, `Neem Home`, and `River Home`, all active household members. |
| Coordinates | Seller `12.930000, 77.580000`. Buyers use `12.920000, 77.570000`, `12.940000, 77.570000`, `12.920000, 77.590000`, and `12.940000, 77.590000`. These are coarse demo points, not addresses. |
| Accounts | Six fixed credit accounts, one for each user, with owner mapping by user UUID and currency `INR`. IDs derive from `seed_uuid('account', user UUID)`. |
| Assets | Seller solar ID `30000000-0000-4000-8000-000000000001`, name `Asha Rooftop Solar`, `5.000000` kW, tilt `12.000000`, azimuth `180.000000`, reserve `0.200000` kWh. Household meters use IDs ending `0101` through `0105`, map in seller then buyer order, use the household alias followed by `Meter`, type `meter`, capacity `10.000000`, and reserve zero. Six simulator connections map one to one with the solar and meter assets. |
| Tariff | ID `40000000-0000-4000-8000-000000000001`, feed in `3.500000` INR per kWh, retail `8.000000`, seller margin `0.100000`, buyer discount `0.100000`, effective at historical day midnight with no end. These are demo assumptions, not a utility tariff claim. |
| Intervals | Zero based slots `0` through `95` create ninety six anchor day rows from local midnight in fifteen minute steps. One extra historical interval starts at previous local day `12:00`. IDs derive from relative day and slot. Anchor day states are `open` only at slot `48`, otherwise `planned`. Historical interval is `settled`. |
| Reading identity | IDs derive from relative day, slot, asset UUID, metric, and source. `original_unit` is `kWh`; original and normalized values match. Observation time is interval end. Retrieval time is interval end plus one minute. Source is `simulated`, quality is `estimated`, and source keys concatenate metric, relative day, slot, and asset UUID with colons. |
| Generation readings | Anchor slots `24` through `72` use `round((1.10 * sin(pi() * (slot - 24) / 48))::numeric, 6)` kWh, otherwise zero. The historical generation input is `0.580000`. |
| Seller consumption and reserve | Seller meter consumption is `0.180000` per anchor slot, with `0.320000` at slots `28` through `31` and `48` through `51`. Solar reserve is `0.200000` at every anchor slot. Historical consumption is `0.400000` and reserve is explicit zero, producing `0.400000` final surplus. |
| Buyer consumption | Base values are `0.160000`, `0.200000`, `0.120000`, and `0.180000` per anchor slot. Buyer two adds `0.180000` at slots `48` through `51`. Buyer four adds `0.120000` at slots `44` through `55`. |
| Forecasts | Seller solar generation, seller meter consumption, solar reserve, and seller solar surplus create four rows per anchor slot. Surplus is `greatest(generation minus consumption minus reserve, 0)`. IDs and keys use the same relative tuple, source is `simulated`, model version is `seed-v1`, issue time is previous local day `18:00`, and confidence bounds are null. |
| Feeder snapshots | One normal row per anchor interval and one historical normal row use capacity `25.000000`, load `12.000000`, ratio `0.480000`, source `simulated`, scenario `normal`, observed at interval start. A second anchor sharing interval row observed one minute later uses load `22.500000`, ratio `0.900000`, scenario `constrained`. IDs derive from interval and scenario. Latest observation is authoritative when constrained is selected. |
| Open market | Offer ID `50000000-0000-4000-8000-000000000001` uses anchor slot `48`, seller solar, the surplus forecast, quantity and remaining `0.800000`, minimum `4.500000`, suggested `5.750000`, status `open`, `is_manual_quantity true`, and `auto_adjust false`. The forecast surplus is `0.580000`, so this is an intentional manual overcommit demonstration. Four active reservations use IDs ending `0101` through `0104`, each quantity and remaining `0.200000`, maximum `6.500000`, and `auto_adjust false`. All creation times are interval start minus one hour, ordered by buyer UUID. |
| Historical trade | Previous day interval uses buyer one. Deterministic offer and reservation quantities are `0.200000`. Allocation quantity is `0.200000` at price `5.750000`, pinned to a pricing snapshot with algorithm `seed-v1`, tariff and normal feeder identifiers, supply and demand `0.200000`, and explanation `{schemaVersion:'1', source:'seed', reason:'historical fixture'}`. Settlement delivers `0.180000`, uses three seller readings, and records credit `1.04`. |
| Historical ledger | Buyer one and seller accounts receive one transaction amount `1.04` INR, one buyer debit `1.04`, and one seller credit `1.04`. Posted, audit, and outbox times are historical interval end plus one minute. `ledger.posted` audit and delivered outbox records use the fixed event schema. The idempotency operation is `ledger.post.v1` with key `seed:historical-ledger`. |
| Expected counts | `profiles 6`, `communities 1`, `community_members 6`, `credit_accounts 6`, `energy_assets 6`, `data_connections 6`, `market_intervals 97`, `energy_readings 675`, `forecasts 384`, `tariff_configs 1`, `feeder_snapshots 98`, `pricing_snapshots 1`, `offers 2`, `reservations 5`, `allocations 1`, `settlements 1`, `settlement_inputs 3`, `ledger_transactions 1`, `ledger_entries 2`, `audit_events 2`, `idempotency_records 1`, `outbox_events 1`. |

Every noncore identifier and timestamp derives from the rules above. `supabase/seed.sql` deletes and recreates only the fixed generation UUID, then asserts every expected count before commit. Seed and reset return the same named `counts` object.

The seed first upserts six local Auth identities with fixed UUIDs and emails but no usable password. For each `auth.users` row it sets the zero instance UUID, fixed user UUID, audience and role `authenticated`, email, confirmed time and audit times at seed origin, provider metadata `{provider:'email',providers:['email']}`, display name user metadata, `is_sso_user false`, `is_anonymous false`, and null encrypted password. It also sets `confirmation_token`, `recovery_token`, `email_change`, `email_change_token_new`, `email_change_token_current`, `phone_change`, `phone_change_token`, and `reauthentication_token` to empty string. Auth scans these columns into non-nullable strings, so leaving them null makes every Auth query touching the row fail. The matching `auth.identities` row uses provider `email`, provider ID equal to the email, fixed user UUID, deterministic identity UUID from `seed_uuid('auth_identity', user UUID)`, seed origin audit times, and identity data containing subject and email. Conflict handling updates only email and metadata for the same fixed UUID. Seed assertions fail if the installed local Auth schema cannot represent this contract.

`scripts/activate-demo-users.ts` reads `SOLARSHARE_DEMO_PASSWORD` from local server configuration and sets the password through the local Auth admin API. The password never appears in tracked SQL, generated types, or public configuration. The database test harness runs this activation before caller bound policy checks. The identity feature later owns the normal local setup command.

### Configuration required

1. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` remain the caller bound web configuration used by `@supabase/ssr`.
2. `SUPABASE_URL` and `SUPABASE_SECRET_KEY` remain server only and are required by trusted worker, ledger, outbox, reset, and local activation adapters.
3. `DEMO_SEED` must equal `solarshare-demo-v1` when seed or reset runs.
4. `SOLARSHARE_DEMO_PASSWORD` is a new local and test only server secret used by `scripts/activate-demo-users.ts`. Production configuration rejects it.
5. Caller bound repositories reuse the existing cookie client from `src/lib/supabase/server.ts`. Trusted adapters create only named operation wrappers with `@supabase/server` core utilities. No route or page receives a secret client.

### Critical test scenarios

1. Happy path: reset the local database, generate types, query each seeded role with a caller bound client, and confirm the expected private and redacted records, verifies **AC-1**, **AC-9**, and **AC-11**.
2. Decimal boundary: round trip six decimal energy, price, coordinate, ratio, and two decimal ledger strings through PostgREST without JSON number conversion, verifies **AC-2**.
3. Constraint failure: attempt cross community, wrong owner, wrong asset, wrong interval, wrong metric, non fifteen minute, negative quantity, unsupported unit, and duplicate source records, and confirm each transaction fails, verifies **AC-3**.
4. Household permission: seller and buyer sessions attempt every other household private table and receive no rows or a policy rejection, verifies **AC-4**.
5. Operator permission: an operator manages its own membership and configuration, then attempts another community and raw household reads, verifies **AC-5**.
6. Provenance: insert a newer imported correction, an invalid cross lineage supersession, and tied forecasts, then confirm history and deterministic selection at two `as_of` values, verifies **AC-6**.
7. Ledger integrity: attempt one sided, unequal, wrong owner, wrong currency, duplicate, updated, and deleted ledger records, then post a valid pair and a zero credit settlement, verifies **AC-7**.
8. Function privilege: call trusted functions as anonymous, authenticated, operator, and secret clients, then confirm only the intended path succeeds, verifies **AC-8**.
9. Retry and concurrency: repeat one idempotency key with equal and unequal semantic inputs, then race outbox claims, expire one token, reclaim it, and prove the stale token cannot complete the event, verifies **AC-8** and **AC-12**.
10. Read contract: paginate every member and operator read, including identical visible values, and confirm stable nonoverlapping cursors, decimal text, null handling, redaction, and zero balances, verifies **AC-4**, **AC-5**, and **AC-11**.
11. Reset isolation: reset the demo twice around a second unmarked community and a user created row, while a stale outbox event exists. Confirm fixed core identities and preserved history remain, scenario counts match, the old event becomes failed, and the other community is byte for byte unchanged, verifies **AC-10** and **AC-12**.

## Build plan

The Skateboard approach starts with one complete identity to community to private data thread, then grows the same schema through market settlement and operations.

1. [ ] Add Supabase local configuration and start one forward migration with the `private` schema, identity, community, asset, interval, reading, forecast, policy helpers, cross record constraints, grants, and first tenant isolation checks. Add the generated type command, satisfies **AC-1**, **AC-2**, **AC-3**, and **AC-4**.
2. [ ] Complete the migration with tariff range exclusion, feeder, pricing, order, allocation, settlement provenance, ledger, audit, idempotency, fenced outbox, scenario generation columns, all indexes, transition guards, immutability guards, and atomic ledger posting, satisfies **AC-2**, **AC-3**, **AC-6**, **AC-7**, and **AC-8**.
3. [ ] Add household and operator policies, decimal text owner views, fixed shape redacted read functions, operator mutation functions, preferred observation functions, outbox functions, explicit grants, audit allowlists, and the Realtime publication check, satisfies **AC-2**, **AC-4**, **AC-5**, **AC-6**, and **AC-8**.
4. [ ] Add deterministic UUID helpers, community locking, scoped reset deletion, the reset function, and canonical `supabase/seed.sql` with the full manifest and count assertions. Add local Auth activation for tests without a tracked password, satisfies **AC-9** and **AC-10**.
5. [ ] Generate `src/types/database.generated.ts`, then add the exact domain records, Zod input and output schemas, error mapping, cursor codecs, repository interfaces, caller bound implementations, operator function wrappers, trusted operation wrappers, and the reset application boundary under `src/repositories` and `src/application`, satisfies **AC-2** and **AC-11**.
6. [ ] Apply the migration to an empty local database and confirm live tables, constraints, policies, functions, indexes, grants, Realtime exclusion, seed counts, deterministic replay, and generated types through catalog introspection and smoke queries, satisfies **AC-1** through **AC-11**.
7. [ ] Add live database integration coverage for tenant and ownership isolation, editable field allowlists, constraints, unit conversion, selection order, immutable records, ledger balance and zero credit behavior, idempotency replay, fenced outbox concurrency, and reset isolation. Keep mapper, cursor, and decimal contract checks beside repository source with Vitest, satisfies **AC-12**.

## Consequences

**Positive**:

1. Later pricing, matching, and settlement features inherit exact tenant, decimal, provenance, and transaction boundaries.
2. Database policies and composite keys reject privacy and tenant errors even when an application query is incomplete.
3. Fixed seed inputs and exact repository ports make the demo reproducible and keep generated database shapes out of domain code.

**Negative and tradeoffs**:

1. The foundation migration is large and policy heavy. It costs more to write and verify than a flat prototype schema.
2. Composite tenant keys duplicate `community_id` on many rows and require careful indexes.
3. Server mediated reads add one application hop, while owner views and redacted functions add objects that must evolve with the interface.
4. Random UUID primary keys are acceptable at prototype volume but have poorer index locality than ordered identifiers.
5. The canonical seed creates disabled local Auth identities first. A separate local activation step is required before seeded password sign in works.

**Neutral**:

1. Matching and settlement function signatures are reserved here, but their bodies wait for their governing algorithm specs.
2. Pricing explanations remain `jsonb` until the pricing spec fixes their versioned shape.
3. Public onboarding, exact addresses, real money, production identity verification, and multi currency exchange remain outside Release 1.

## Follow-up

1. [ ] Ratify the pricing formula and `pricing_snapshots.explanation` shape before implementing `match_market_interval`.
2. [ ] Ratify matching order, cutoffs, partial fills, and remainder rounding before implementing the matching function body.
3. [ ] Ratify final surplus and delivery reduction before implementing the settlement function body.
4. [ ] Capture `supabase-postgres-best-practices`, `supabase-server`, and `vitest` as project conventions in the appropriate `AGENTS.md` during the next context sync.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
