# Rationale for 0005. Define explainable market pricing

## Context

SolarShare needs one uniform price per community interval before matching can allocate energy. The price must use exact decimals, remain inside existing database constraints, respect user limits, and explain itself in ordinary household language. The seeded scenario already establishes `5.750000` as the normal balanced price between a `3.500000` feed in rate and an `8.000000` retail rate.

The current buyer estimate deliberately treats the buyer maximum as the expected unit price. That was a safe placeholder for feature 7, but it overstates expected cost whenever the calculated market price is lower. The replacement must preserve the current buyer screen and decimal string boundary.

The main architectural tension is transaction ownership. The project convention places deterministic calculations in `src/domain`, while future matching must lock orders, create or select a pricing snapshot, and write allocations atomically in PostgreSQL. Choosing only one runtime would either weaken that transaction boundary or remove the exact browser preview path.

## Options considered

### Option 1: PostgreSQL transaction calculation with an exact TypeScript mirror

Put the durable calculator and snapshot insert in PostgreSQL. Implement the same pure formula with existing `BigInt` decimal helpers for previews and focused tests.

**Pros**:

1. Future matching can calculate, pin, and allocate against locked inputs in one transaction.
2. The buyer preview stays fast and exact without restructuring the screen.
3. Shared vectors can prove parity at formula boundaries.

**Cons**:

1. Two implementations can drift unless versioned contract tests remain mandatory.
2. SQL explanation construction is more verbose than TypeScript object construction.

### Option 2: TypeScript calculation with a trusted insert function

Calculate once in the application, then send the result and pinned inputs to a narrow PostgreSQL insert function.

**Pros**:

1. The formula has one implementation in the domain layer.
2. TypeScript tests and explanation construction are straightforward.

**Cons**:

1. Pricing reads and matching writes cannot share one database transaction.
2. Orders or feeder state can change between application calculation and allocation.
3. The database function would need to repeat substantial validation or trust caller supplied aggregates.

### Option 3: PostgreSQL calculation only

Calculate every durable and preview price through PostgreSQL.

**Pros**:

1. The formula has one executable implementation.
2. All reads and writes can use database transaction semantics.

**Cons**:

1. Interactive estimates would need repeated server calls or a changed buyer experience.
2. It conflicts with the project convention for deterministic domain calculations.
3. The buyer estimate becomes unavailable when the database cannot be reached.

## Rationale

Option 1 protects the future atomic matching boundary without breaking the current application boundary. The database implementation is authoritative for stored snapshots. The TypeScript implementation is authoritative only for preview behavior, and the shared algorithm version plus vectors make equality explicit.

The confirmed linear curve is intentionally simple. It gives local supply and demand most of the movement, adds a smaller import congestion signal only above `0.500000`, and clamps the result through tariff protections and the common user limit band. Equal seeded tariff protections keep the protected midpoint at `5.750000`, so balanced normal conditions reproduce the historical fixture exactly.

The common limit band keeps pricing separate from matching. It also creates a known demo limitation: one restrictive order can collapse the band for everyone. That tradeoff is visible in the explanation and remains a deliberate feature 9 decision rather than being hidden inside pricing.

## Decision record

The repository owner confirmed the linear pressure curve, common user limit band, and open interval recovery for conflicting limits on 2026-09-12.
