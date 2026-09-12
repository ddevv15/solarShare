# 0005. Define explainable market pricing

**Date**: 2026-09-12
**Status**: Accepted

## Summary

SolarShare will calculate one exact, versioned price for a community interval from tariffs, local supply and demand, user limits, and feeder congestion. A linear pressure curve keeps balanced normal conditions at the tariff midpoint and moves the price predictably as pressure changes. PostgreSQL will own the durable calculation so later matching can price and allocate in one transaction, while the TypeScript domain implementation will provide exact previews and shared contract tests.

## Requirements

**User stories**:

1. As a household, I want a stable local energy price and a plain explanation so that I can understand what I may pay or receive.
2. As an operator, I want invalid tariff settings to pause an interval safely so that market work cannot continue with an unusable price.
3. As a future matching job, I want pricing to run inside the same database transaction as allocation so that the snapshot reflects the locked market inputs.

**Acceptance criteria**:

1. **AC-1**: Identical tariff, feeder, supply, demand, and active order limit inputs produce the same six decimal unit price, the same explanation content, and algorithm version `linear-pressure-v1`. Generated identifiers and creation times are not deterministic outputs.
2. **AC-2**: Feed in `3.500000`, retail `8.000000`, equal supply and demand, and congestion `0.480000` produce exactly `5.750000`. Demand above supply raises the unclamped price, supply above demand lowers it, and congestion `0.900000` raises it compared with `0.480000` when other inputs match.
3. **AC-3**: Every stored price is clamped before insert to the inclusive tariff corridor and to the tariff protection band derived from seller margin and buyer discount ratios. The existing corridor trigger remains a final guard rather than the normal control path.
4. **AC-4**: The executable lower bound includes the highest active seller minimum. The executable upper bound includes the lowest active buyer maximum. A stored price never violates either common user limit.
5. **AC-5**: A missing or invalid tariff, including tariff protections that cross, creates no pricing snapshot and changes an eligible interval to `paused` in the same transaction. The result explains which tariff rule failed.
6. **AC-6**: When the common user limit band does not overlap, pricing creates no snapshot and leaves the interval `open`. The returned explanation names the highest seller minimum and lowest buyer maximum and says that users can revise their orders.
7. **AC-7**: Missing feeder input, zero active supply, or zero active demand creates no snapshot and does not pause the interval. The returned outcome identifies the missing input.
8. **AC-8**: A created snapshot pins the selected tariff and feeder rows, exact aggregate supply and demand, algorithm version, six decimal unit price, and a validated explanation with `schemaVersion` `1`. Pricing snapshots remain append only.
9. **AC-9**: The trusted pricing function is executable only by `service_role`. It locks the community, interval, and active orders in a stable order before reading inputs or writing state.
10. **AC-10**: The buyer reservation estimate uses the calculated market price, capped by the buyer maximum, instead of treating the maximum as the expected price. Cost and saving remain exact decimal calculations and the buyer screen keeps its current structure.
11. **AC-11**: No price, ratio, quantity, cost, or saving enters JavaScript arithmetic as a `number`. TypeScript and PostgreSQL follow the same formula, clamp order, six decimal rounding rule, and shared pricing vectors.

## Decision

**Chosen option**: Option 1: PostgreSQL transaction calculation with an exact TypeScript mirror

The durable pricing calculation will live in a new trusted PostgreSQL function. A pure TypeScript domain implementation will use the same versioned formula for previews and focused tests. Shared vectors will make any difference between the two implementations visible.

**Implementation skills**: `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `supabase-server` (`supabase/server`, `.agents/skills/supabase-server/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`)

## Feature design

### Formula

All calculations use exact decimal or rational arithmetic. PostgreSQL uses `numeric`. TypeScript uses `BigInt` coefficients with an explicit scale.

Let `F` be the feed in rate, `R` the retail rate, `SM` the seller margin ratio, `BD` the buyer discount ratio, `S` active remaining supply, `D` active remaining demand, and `C` the congestion ratio.

1. `spread = R - F`
2. `midpoint = (F + R) / 2`
3. `tariffLower = F + spread * SM`
4. `tariffUpper = R - spread * BD`
5. `marketPressure = (D - S) / (D + S)`
6. `congestionPressure = 0` when `C <= 0.5`, otherwise `(C - 0.5) / 0.5`
7. `combinedPressure = clamp(0.75 * marketPressure + 0.25 * congestionPressure, -1, 1)`
8. `unclampedPrice = midpoint + combinedPressure * spread / 2`
9. `lowerBound = max(F, tariffLower, highest active seller minimum when present)`
10. `upperBound = min(R, tariffUpper, lowest active buyer maximum when present)`
11. `unitPrice = clamp(roundHalfUp(unclampedPrice, 6), lowerBound, upperBound)`

The function checks `lowerBound <= upperBound` before calculating or inserting a price. Active supply comes from offers in `open` or `partly_matched` status with positive `remaining_kwh`. Active demand comes from reservations in `active` or `partly_matched` status with positive `remaining_kwh`. Null order limits do not narrow the band.

### Data model

No table changes are needed. The new migration adds functions and grants only.

| Record | Existing fields used | Rule |
|---|---|---|
| `tariff_configs` | `id`, `community_id`, four tariff values, effective range | Select the one range containing the interval start |
| `feeder_snapshots` | `id`, `community_id`, `market_interval_id`, `congestion_ratio`, `observed_at` | Select latest `observed_at`, then UUID descending |
| `offers` | `remaining_kwh`, `minimum_price`, `status` | Sum active remaining supply and take the highest nonnull minimum |
| `reservations` | `remaining_kwh`, `maximum_price`, `status` | Sum active remaining demand and take the lowest nonnull maximum |
| `pricing_snapshots` | Existing snapshot columns and `explanation` | Append one row only for a priced outcome |
| `market_intervals` | `status`, `updated_at` | Pause only for a missing or invalid tariff |

### Explanation schema

Every pricing outcome returns an explanation object. A priced outcome stores the same object in `pricing_snapshots.explanation`.

| Field | Type | Meaning |
|---|---|---|
| `schemaVersion` | literal `1` | Explanation contract version |
| `summary` | string | One household readable sentence describing the outcome |
| `outcome` | `priced`, `no_common_limit`, `invalid_tariff`, or `missing_input` | Result category |
| `currency` | string | Community currency |
| `tariff` | object or null | Feed in rate, retail rate, midpoint, protected lower bound, and protected upper bound as decimal strings |
| `market` | object | Supply, demand, and market pressure as decimal strings |
| `congestion` | object or null | Feeder ratio, threshold `0.500000`, and congestion pressure as decimal strings |
| `limits` | object | Highest seller minimum, lowest buyer maximum, effective bounds, and binding limit |
| `calculation` | object or null | Unclamped price, rounded price, final price, and clamp direction as decimal strings or named values |
| `reason` | string or null | Stable machine readable reason for an outcome without a snapshot |

`limits.bindingLimit` is `none`, `seller_minimum`, `buyer_maximum`, `tariff_seller_protection`, or `tariff_buyer_protection`. When a limit clamps the price, `summary` states the limit and value plainly. For `no_common_limit`, `summary` names both conflicting order limits and says no price was created.

### State transitions

| Starting state | Outcome | Ending state |
|---|---|---|
| `open` or `matching` | Priced | Unchanged |
| `open` or `matching` | Missing or invalid tariff | `paused` |
| `open` | Common user limits do not overlap | `open` |
| `open` | Feeder, supply, or demand missing | `open` |

Other interval states reject pricing without changing data.

### API surface

| Surface | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `private.calculate_interval_price` | PostgreSQL function | Locked tariff, feeder, aggregate quantities, and common limits | Versioned outcome and explanation | Called only inside trusted database functions | Invalid numeric input |
| `public.create_pricing_snapshot` | PostgreSQL function | `p_community_id uuid`, `p_market_interval_id uuid` | `jsonb` outcome with nullable snapshot ID, pinned input IDs, price, and explanation | `service_role` only | Unknown community or interval, ineligible interval state |
| `calculateIntervalPrice` | Pure TypeScript function | Validated decimal string inputs | Versioned pricing outcome | Internal domain code | Invalid decimal input |
| `priceInterval` | Trusted repository method | Community ID and interval ID | Validated pricing outcome | Secret client only | Mapped database error or invalid response |

### Value sourcing

| Action | Value produced or displayed | Source |
|---|---|---|
| Select market input | Interval start and status | `market_intervals` by both community and interval ID |
| Select tariff | Tariff row and currency | Effective tariff range at interval start, plus `communities.currency` |
| Select congestion | Feeder row | Latest eligible feeder ordered by `observed_at desc, id desc` |
| Calculate pressure | Supply and demand | Sums of positive `remaining_kwh` on active offers and reservations |
| Calculate common limits | Lower and upper order limits | Maximum seller minimum and minimum buyer maximum |
| Create snapshot | IDs, quantities, algorithm, price, explanation | Locked selected inputs and the formula in this spec |
| Show reservation estimate | Unit price | Current server calculated pricing preview, capped by the entered buyer maximum |
| Show cost and saving | INR decimal strings | Quantity times effective preview price, and quantity times retail minus effective preview price |

### Key invariants

1. The algorithm version changes whenever formula, selection, rounding, or explanation meaning changes.
2. Clamping occurs before insert. The stored price is inside the raw tariff corridor, tariff protection band, and common order limit band.
3. A failed or unavailable pricing outcome inserts no snapshot.
4. Invalid tariff is the only pricing outcome that pauses an interval.
5. The function obtains the existing community advisory lock, then the interval row lock, then active offer and reservation row locks ordered by table and UUID.
6. Explanation numeric values are canonical six decimal strings. No timestamps or generated snapshot IDs participate in deterministic explanation equality.
7. PostgreSQL `round(numeric, 6)` and the TypeScript exact division helper both use half up rounding for the nonnegative unit price.

### Security model

Authenticated users retain select access to pricing snapshots under existing community Row Level Security. They receive no insert grant and cannot execute the trusted writer. The secret client calls only the named pricing function through the trusted repository. The function uses an empty `search_path`, schema qualified names, fixed result fields, and the minimum `service_role` execute grant.

No new environment values are required.

### Critical test scenarios

1. Seed consistency: balanced `0.800000` supply and demand with the seeded tariff and normal congestion returns exactly `5.750000`, verifies **AC-1** and **AC-2**.
2. Pressure movement: demand imbalance, supply imbalance, normal congestion, and constrained congestion move the unclamped price in the required directions, verifies **AC-2**.
3. Corridor and protection limits: extreme pressures clamp before insert at every tariff and protection boundary, verifies **AC-3**.
4. User limits: seller and buyer limits clamp the price and identify the binding limit, verifies **AC-4** and **AC-8**.
5. Invalid tariff: crossed tariff protections pause the interval and create no snapshot, verifies **AC-5**.
6. Limit conflict: seller minimum above buyer maximum leaves the interval open, creates no snapshot, and returns both limits in plain language, verifies **AC-6**.
7. Missing input: missing feeder, supply, or demand returns the matching reason without a state change, verifies **AC-7**.
8. Persistence: the trusted function pins selected IDs and aggregate values, and a direct authenticated call is denied, verifies **AC-8** and **AC-9**.
9. Preview: the buyer estimate uses the market price when it is below the buyer maximum and the maximum when it binds, verifies **AC-10**.
10. Parity: shared vectors produce equal TypeScript and PostgreSQL outcomes at six decimals, verifies **AC-11**.

## Build plan

The Skateboard approach first delivers one complete priced outcome for the seeded interval, then fills the failure and explanation boundaries around the same path.

1. [ ] Add exact signed rational division, half up rounding, the pure pricing domain model, the explanation schema, and the balanced seeded vector, satisfies **AC-1**, **AC-2**, and **AC-11**.
2. [ ] Add a forward migration with the pure database calculator, the locked trusted snapshot writer, explicit grants, invalid tariff pause, and structured outcomes, satisfies **AC-1** through **AC-9** and **AC-11**.
3. [ ] Add validated pricing domain records, Zod schemas, the trusted repository method, and server pricing use case, satisfies **AC-1**, **AC-8**, **AC-9**, and **AC-11**.
4. [ ] Replace the reservation placeholder estimate with the calculated price while preserving the existing buyer screen structure, satisfies **AC-10**.
5. [ ] Add focused domain and repository tests for seed consistency, pressure movement, every clamp, invalid tariffs, missing inputs, common limit conflict, explanation wording, and database privilege boundaries, satisfies **AC-1** through **AC-11**.

## Consequences

**Positive**:

1. Feature 9 can invoke the same trusted calculator while its order locks and allocation writes are in one transaction.
2. The seed midpoint becomes an executable regression contract rather than an unexplained fixture value.
3. Households receive a concise reason for price movement and for any binding limit.

**Negative and tradeoffs**:

1. The exact formula exists in PostgreSQL and TypeScript. Shared versioned vectors are required to detect drift.
2. A single low buyer maximum or high seller minimum can collapse the common band even when most orders could trade. This is accepted for the seeded demo because excluding or reweighting orders belongs to matching in feature 9.
3. The community advisory lock serializes pricing with other trusted market work. This favors simple correctness over throughput at prototype scale.

**Neutral**:

1. Repeated calls may append distinct snapshots with the same deterministic content. Append only provenance is preserved, while matching chooses the snapshot it pins.
2. No existing table or applied migration changes.
3. A user limit conflict remains recoverable through ordinary order edits and does not pause the market.

## Follow-up

1. [ ] Feature 9 should call the private calculator or trusted writer inside its matching transaction and define which newly created snapshot an allocation pins.
2. [ ] `supabase-postgres-best-practices`, `supabase-server`, and `vitest` conventions are not yet named in root `AGENTS.md`. They apply across the database and TypeScript code and belong in the root context.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
