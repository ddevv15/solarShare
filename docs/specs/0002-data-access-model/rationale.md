# Rationale for 0002. Establish the SolarShare data and access model

## Context

SolarShare must demonstrate one complete trade from forecast and offer through reservation, allocation, settlement, and balanced prototype credits. The data includes private household readings, approximate locations, tenant-scoped market activity, changing forecasts, and transactional state that concurrent workers must not duplicate.

The application foundation already selected Supabase PostgreSQL, Auth, Row Level Security, Realtime invalidations, Trigger.dev, generated database types, and typed PostgreSQL functions for atomic market operations. The development blueprint proposed the main records, but it left several implementation-changing questions unresolved: whether a user and household are separate entities, whether the browser accesses tables directly, how intervals are identified, how corrections preserve provenance, how operators see household data, how credits relate to users, and how reset avoids damaging non-demo data.

This decision resolves those questions without defining the later pricing, matching, or settlement algorithms.

## Options considered

### Option 1: Community-scoped relational model with server-mediated access

Use normalized PostgreSQL tables with an explicit community tenant key, composite foreign keys, RLS, server application services, privacy-safe read models, immutable observations, and database transaction functions.

**Pros**:

1. PostgreSQL rejects cross-community relationships and duplicate transactional results at the shared data boundary.

2. The application can return clear domain errors while RLS protects against an incomplete query or accidental client exposure.

3. Immutable input versions and exact settlement references preserve provenance.

4. The model remains understandable and testable with ordinary relational tools.

**Cons**:

1. The schema needs more foreign keys, indexes, policies, and integration tests.

2. Purpose-built marketplace, operator, and map projections must be maintained.

### Option 2: Flat user-owned tables with application-only authorization

Put `user_id` on most records, filter in Next.js, and use a service credential for all server database access.

**Pros**:

1. It is the fastest schema to sketch.

2. Authorization logic appears in one application layer.

**Cons**:

1. One missing filter can disclose or mutate another household's data.

2. Community mismatches remain possible between otherwise valid foreign keys.

3. A broad service credential turns every repository bug into a privileged database operation.

4. Multi-community membership and community-specific balances require a later redesign.

### Option 3: Browser-first Supabase access

Let authenticated browser clients query and mutate selected base tables directly under RLS, using server code only for privileged transactions.

**Pros**:

1. It removes an application hop for simple CRUD and aligns with Supabase's client model.

2. Realtime table subscriptions are straightforward.

**Cons**:

1. Business validation and error mapping split across the browser, policies, triggers, and server functions.

2. Base table shapes become a public client contract prematurely.

3. Realtime row payloads increase the chance of exposing private identifiers or values.

4. The first release has one Next.js client and gains little from direct browser persistence.

### Option 4: Event-source all state

Store every identity, market, and settlement change as an event and derive current projections.

**Pros**:

1. It produces complete history and replayability.

2. Immutable events fit audit-heavy domains.

**Cons**:

1. Projection, replay, versioning, and consistency machinery would dominate the prototype.

2. The project needs relational current state and a small immutable audit trail, not a general event-sourcing platform.

## Rationale

Option 1 addresses the actual risks with familiar PostgreSQL mechanisms. SolarShare is a small prototype, but privacy and transaction correctness are not prototype-only concerns. Community identifiers on child rows make tenant filters and RLS efficient, while composite foreign keys prevent a record from borrowing a valid asset, interval, order, or account from another community. Indexing foreign keys and exact policy predicates avoids turning this safety into avoidable query overhead. (basis: `SolarShare_Development_Blueprint.md`, `docs/specs/0001-stack-architecture/index.md`, `supabase-postgres-best-practices`)

Server-mediated access gives the application one place for request parsing, capability checks, lifecycle errors, and response shaping. The database client still carries the user's Auth context, so RLS remains active rather than being replaced by a broad service credential. Browser Supabase use stays valuable for Auth and Realtime, but invalidation messages reveal no private row payload and trigger an authorized refetch. (basis: the defense-in-depth decision in spec 0001 and the confirmed architecture session)

## Identity and membership reasoning

The first release does not need a separate legal household entity. One Auth user represents one household, and assets, orders, and accounts can reference that user's membership. Adding a `households` table now would create membership and delegation states with no current user flow. If shared household access becomes real later, a household aggregate can be introduced deliberately rather than pretending the current user record already supports it.

Authorization does not belong on `profiles.default_role`. The same user may be a household in one community and an operator in another. Keeping the role and status on `community_members` makes the authorization fact tenant-specific. A profile may later store a preferred starting view, but that preference cannot grant a capability.

Membership suspension is a status transition rather than a deletion. Historical offers, allocations, settlements, and ledger entries remain referentially intact while current access stops.

## Interval and order reasoning

An explicit `market_intervals` row is necessary because pause, matching, settlement readiness, tariff selection, and feeder state all concern the same community window. Coordinating those states through repeated timestamps on unrelated tables would allow contradictory interval state and complicate locks. A canonical row also gives workers one stable advisory-lock key and one authoritative lifecycle.

Matching is interval-local, so one offer or reservation per interval is the simplest safe unit. A batch identifier preserves the user experience of submitting several intervals at once without introducing range overlap rules or partial cancellation ambiguity.

## Decimal reasoning

PostgreSQL `numeric` is required because binary floating-point can make limits, remaining quantities, and balanced credits disagree. Six decimal kWh precision is finer than the prototype's expected readings without allowing unbounded numeric storage. Prices retain six decimals so pricing and allocation can defer rounding. Ledger credits round once to two decimal places because they are presented as INR/paisa values.

Both sides of a settlement reuse the same rounded value. Calculating and rounding buyer and seller lines independently would allow an avoidable imbalance. At the application boundary, decimal strings preserve database values exactly; display formatting is not used as a calculation type.

## Provenance reasoning

Provider, imported, modeled, stored-sample, and simulated values can all exist for the same interval. Overwriting the current row would destroy evidence of why a forecast or settlement changed. Immutable observations plus a deterministic selection function preserve that history without adopting event sourcing for every table.

A settlement stores concrete input-reading references rather than only an `input_source` label. Source labels explain the category; identifiers prove the exact data. Offers and reservations remain mutable only because users must edit or cancel open orders, and audit events preserve meaningful transitions.

## Operator privacy reasoning

An operator needs enough information to manage membership, configuration, interval health, and failed workflows. That does not imply routine access to raw household readings, import files, exact or stored approximate locations, or another household's ledger history. Fixed shape redacted functions and pseudonymous market summaries satisfy the operational flow with less data exposure.

Trusted settlement code may use private readings without displaying them to the operator. This separates the ability to run an authorized process from the ability to inspect all of its private inputs.

## Credit account reasoning

Putting only `user_id` on a ledger entry answers who owns it but not which balance it changes. A credit account references both the user and community, plus its currency. Ledger entries reference that account, and an authorized balance function derives the current user's value without joining profile data.

This small indirection prevents credits from separate communities or currencies being mixed. It also avoids duplicating `user_id` on every entry, where the account owner and duplicated user value could drift. Balances remain derived from immutable entries because a mutable balance column would create another value that every posting path must keep synchronized.

A ledger transaction header groups the two lines created by a settlement. A database posting function validates equal buyer debit and seller credit before commit. An optional hash chain from the blueprint is omitted because it does not prevent a privileged database writer from recomputing hashes and could imply tamper resistance the prototype does not provide.

## Concurrency and operational reasoning

Transaction-scoped advisory locks coordinate work per community interval without a separate lock table. Row locks then protect the actual mutable orders and allocations. Stable lock ordering reduces deadlocks, and short transactions keep external providers and task dispatch outside locked sections.

The outbox is claimed with `skip locked` so workers do not wait on one another. Claim and delivery are separate short transactions because Trigger.dev dispatch is an external call. Idempotency records, unique result constraints, and lifecycle predicates remain the final defense when a task is retried or a stale outbox claim is recovered.

## Seed and reset reasoning

Full local recreation belongs to Supabase migrations and `seed.sql`. The operator demo needs a narrower reset that preserves judge credentials and cannot touch arbitrary tenant data. A unique demo marker makes the reset target explicit. The server verifies the operator, and the privileged function revalidates the actor and community before rebuilding only generated scenario records in one transaction.

Fixed identifiers and a versioned seed allow tests and demonstrations to compare known results. Resetting generated rows rather than Auth users also avoids coupling ordinary application code to authentication administration.

## Consequences accepted

1. More database constraints and policy tests are worthwhile because later matching and settlement work can rely on stable tenant and numeric invariants.

2. Read projections are deliberate contracts. They prevent the interface from depending on private base-table shapes and make privacy review concrete.

3. Immutable interval history increases row count, but the seeded prototype is small and the audit benefit is immediate.

4. The design leaves pricing and settlement algorithms open while fixing the records and transaction boundaries those algorithms require.

## References

1. `SolarShare_Development_Blueprint.md`, especially sections 2, 3, 6, 12-15, 18-19, and 23-25.

2. `docs/specs/0001-stack-architecture/index.md`, the governing Supabase, authorization, transaction, outbox, and Realtime decisions.

3. `docs/scope/scope.md`, the data and access model completion criteria and Beta verification level.

4. `.agents/skills/supabase-postgres-best-practices/`, schema, foreign-key indexing, least privilege, RLS performance, composite and partial indexing, locking, and queue guidance.
