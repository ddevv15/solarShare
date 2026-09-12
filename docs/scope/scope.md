# Scope: SolarShare

SolarShare is a local solar credit marketplace for a seeded community. This pass gives judges one reliable seller to buyer to settlement experience, with minimal interface work and real market logic.

The detailed product and system baseline remains in `SolarShare_Development_Blueprint.md`. The first scaffold includes every environment variable, provider adapter boundary, secret boundary, and fallback contract needed to add API keys without restructuring the app.

**Build approach:** Skateboard (ship the smallest complete trading demo first, then grow the same usable product).
**Workflow:** Alpha (`/check verify` after `/develop`). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but you may skip it when the blueprint already gives you enough certainty. Pricing, matching, settlement, the stack, and the data model use Beta because their correctness matters most.

_These are recommendations to keep your build orderly, not requirements. You may skip anything that does not fit. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---|---|---|
| 1 | Stack and architecture | Foundation | done |
| 2 | Coding standards and tooling | Foundation | done |
| 3 | Data and access model | Foundation | done |
| 4 | Minimal UI foundation | Foundation | done |
| 5 | Seeded identity and community | Release 1 | done |
| 6 | Seller forecast and sharing | Release 1 | done |
| 7 | Buyer marketplace and reservation | Release 1 | done |
| 8 | Explainable pricing | Release 1 | done |
| 9 | Matching and allocation | Release 1 | planned |
| 10 | Settlement and credit ledger | Release 1 | planned |
| 11 | Operator demo and clean reset | Release 1 | planned |
| 12 | Realtime invalidation updates | Release 1 | planned |

## Foundations

### 1. Stack and architecture · done · Beta
Capture the blueprint choices in a governing spec, then create the smallest runnable application. Include the complete environment contract now so API keys can be added as soon as the scaffold boots.
**Done when:** the selected stack is recorded, the app runs locally, required and optional environment values are documented, secrets remain server side, missing provider keys fall back safely, and the production build passes.
**Spec:** [0001](../specs/0001-stack-architecture/index.md)
**Code:** `src/app`, `src/lib/config`, `src/core/providers`, and `src/adapters`
- [x] Decide the stack (spec): `/architect stack and architecture`
- [x] Scaffold from the decision: `/develop stack and architecture`
- [x] Verify it: `/check verify stack and architecture` (skipped by engineer after the test suite passed)
- [x] Test it: `/test stack and architecture`

### 2. Coding standards and tooling · done
Record conventions from the real scaffold, then add only the checks that keep a fast build safe and consistent.
**Done when:** root `AGENTS.md` reflects the project, and the chosen type, lint, format, and basic automation checks run cleanly.
**Code:** `package.json`, `eslint.config.mjs`, `.prettierignore`, `AGENTS.md`, and `README.md`
- [x] Capture conventions and tooling choices: `/audit`
- [x] Install the tooling: `/develop tooling`

### 3. Data and access model · done · Beta
Define the minimum records and access boundaries for identities, communities, assets, interval data, offers, reservations, allocations, settlements, and ledger entries.
**Done when:** the schema supports the complete demo without a breaking redesign, decimal energy and credit values are safe, community access is enforced, locations remain approximate, and seed data can be recreated.
**Spec:** [0002](../specs/0002-data-access-model/index.md)
**Code:** `supabase`, `src/repositories`, and generated database types
- [x] Design it (spec): `/architect data and access model`
- [x] Build it: `/develop data and access model`
  - [x] Build the schema, tenant constraints, lifecycle guards, and exact decimal foundation, covers AC-1, AC-2, AC-3, AC-6, and AC-7
  - [x] Build Row Level Security, owner views, redacted functions, operator functions, and trusted operation grants, covers AC-4, AC-5, and AC-8
  - [x] Build deterministic seed, fenced reset, local Auth activation, and fixture assertions, covers AC-9 and AC-10
  - [x] Generate types, build repository ports and adapters, apply the migration, and add live database checks, covers AC-1, AC-2, AC-11, and AC-12
- [x] Verify it: `/check verify data and access model` (verified by hand against the hosted project, not by an automated suite)
- [x] Test it: `/test data and access model`

### 4. Minimal UI foundation · done · Alpha
Set a deliberately plain visual baseline for navigation, forms, tables, status labels, source labels, and feedback states. Visual polish waits until the logic is proven.
**Done when:** the app has a responsive shell, one clear action per screen, keyboard usable controls, visible focus, readable contrast, and reusable states for loading, empty data, failure, and success.
**Spec:** [0003](../specs/0003-minimal-ui-foundation/index.md)
**Code:** `src/app`, `src/components`, `src/lib/utils.ts`, `src/app/globals.css`, and `design.md`
- [x] Design it (spec): `docs/specs/0003-minimal-ui-foundation/index.md`
- [x] Build it: responsive shell, shared primitives, provider source label, and feedback states
- [x] Verify it: `/check verify minimal UI foundation` (rendered markup audited; screenshots not captured)
- [x] Test it: `/test minimal UI foundation`

## Release 1: Complete judge demo

### 5. Seeded identity and community · done
Give judges reliable seller, buyer, and operator entry points without spending the first release on public account management.
**Done when:** each seeded role can sign in, receives the correct community access, reaches its minimal dashboard, and cannot read another household's private records.
**Code:** `src/application/viewer.ts`, `src/app/sign-in`, `src/app/(app)`, and `src/components/app-shell`
- [x] Build it: `/develop seeded identity and community`

### 6. Seller forecast and sharing · done · assumed decision (spec 0004)
Use repeatable simulated intervals to show generation, home demand, reserve, and shareable surplus. Keep provider adapters ready for keys, but do not make the demo depend on an external service.
**Done when:** a seller can review tomorrow's labeled 15 minute estimates, approve or edit a suggested quantity, and publish an offer with a visible minimum price and source explanation.
**Spec:** [0004](../specs/0004-forecast-visibility-rule.md) · assumed, owes ratification
**Code:** `src/application/seller-sharing.ts`, `src/app/(app)/seller`, and `src/components/market`
- [x] Build it: `/develop seller forecast and sharing`

### 7. Buyer marketplace and reservation · done
Show available local solar in a compact market view and let a seeded buyer request energy within a chosen price limit.
**Done when:** a buyer can select an interval, review quantity, estimated cost and saving, submit a reservation, and see a clear pending or allocated state.
**Code:** `src/application/buyer-marketplace.ts`, `src/app/(app)/marketplace`, `src/domain/decimal.ts`, and `src/components/market`
- [x] Build it: `/develop buyer marketplace and reservation`

### 8. Explainable pricing · done · Beta
Turn tariffs, local supply, demand, user limits, and the simulated import congestion signal into a bounded deterministic price with a plain explanation.
**Done when:** identical inputs return the same versioned price, the result stays inside the allowed corridor and user limits, invalid tariff settings pause the interval, and focused tests cover limits and pressure changes.
**Spec:** [0005](../specs/0005-explainable-pricing/index.md)
- [x] Design it (spec): `/architect explainable pricing`
- [x] Build it: `/develop explainable pricing`
  - [ ] Build the exact versioned domain formula and shared pricing vectors, covers AC-1, AC-2, AC-10, and AC-11
  - [ ] Build the trusted database calculator, snapshot writer, validation, locking, and grants in a forward migration, covers AC-1 through AC-9 and AC-11
  - [ ] Build the typed repository and application boundary and replace the buyer estimate without restructuring the screen, covers AC-8 through AC-11
  - [ ] Cover pricing outcomes, explanations, parity, and privilege boundaries, covers AC-1 through AC-11
- [x] Verify it: `/check verify explainable pricing` (both implementations return 6.200000 on the live project)
- [x] Test it: `/test explainable pricing`

### 9. Matching and allocation · planned · needs a decision · Beta
Match eligible offers and reservations per community and interval without allocating the same energy twice.
**Done when:** compatible orders allocate deterministically in one safe transaction, quantities never exceed supply or demand, retries create no duplicates, and focused tests cover competing buyers and price mismatch.
- [ ] Design it (spec): `/architect matching and allocation`

### 10. Settlement and credit ledger · planned · needs a decision · Beta
Close the trade against final simulated readings, reduce delivery when generation falls short, and record balanced prototype credits.
**Done when:** full and partial delivery settle deterministically, buyer debit equals seller credit, ledger records are append only, a repeated job is safe, and the seller and buyer can see the final result.
- [ ] Design it (spec): `/architect settlement and credit ledger`

### 11. Operator demo and clean reset · planned
Provide the smallest control surface needed to demonstrate tariff and feeder changes, inspect the market result, and restore the known scenario.
**Done when:** an operator can select the normal or constrained feeder scenario, change valid tariffs, observe the resulting price state, inspect the completed trade, and reset all seeded demo data.
- [ ] Build it: `/develop operator demo and clean reset`

### 12. Realtime invalidation updates · planned · needs a decision
Refresh offers, reservations, allocations, settlements, and feeder state across open sessions over Supabase Realtime websockets. Application tables stay out of the Realtime publication: the socket carries invalidation signals, not rows, so a subscriber never receives data it could not already read through Row Level Security. Signals ride the existing outbox contract of community UUID, coarse topic, aggregate UUID, and revision, and clients refetch through the protected reads.
**Done when:** an open seller, buyer, or operator session reflects a change made in another session without a manual refresh, a subscriber is authorized against active community membership, no application table is added to the Realtime publication, and a dropped socket recovers without losing a change.
**Spec:** [0004](../specs/0004-realtime-invalidation/index.md)
- [ ] Design it (spec): `/architect realtime invalidation updates`
- [ ] Build it: publisher draining the outbox, private channel authorization, and the client subscriber

## Deferred

These features can grow the same product after Release 1 works. They should not block tomorrow's judge demo.

* **Live weather and solar activation:** connect the prepared provider adapters once keys are available, with cached and sample fallbacks.
* **CSV import and export:** validate, preview, commit, and export interval data and market results.
* **Community map:** show approximate activity without addresses or account identifiers.
* **Public onboarding:** add sign up, profile editing, location selection, join codes, and broader community management.
* **Full operator workspace:** add member management, interval controls, audit history, and data health views.
* **UI polish:** improve visual hierarchy, responsive details, charts, motion, and the full accessibility pass after the logic is stable.
* **Public launch needs:** add landing page refinement, metadata, analytics, localization, privacy copy, and operational safeguards.
* **Production integrations:** add approved device connections, utility systems, and any real financial settlement only after the prototype is validated.

## Legend

**Feature lifecycle:** `planned` becomes `in-progress`, then `done`. `existing` is work that predates this workflow. `dropped` keeps the history of removed scope.

**Needs a decision:** `/architect` is the recommended first step. When the blueprint and an existing spec already settle the decision, you may go straight to `/develop` and record the assumption.

**Workflow:** Alpha runs `/check verify` after `/develop`. Beta runs `/check verify` and `/test`. The Beta tag applies only where it appears.

**Next step:** use the first unticked box. After a spec is captured, `/architect` replaces that single decision box with the build milestones and the required verification boxes.
