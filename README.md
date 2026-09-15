# SolarShare

SolarShare is a local solar credit marketplace for a seeded neighbourhood community. A household with a rooftop array publishes the surplus it is willing to share for a 15 minute interval, neighbours reserve that energy inside a price limit they choose, and every price carries a plain explanation of how it was reached.

The application is one modular Next.js App Router codebase. Supabase PostgreSQL owns relational state, transactions, and access control. Trigger.dev will run durable work through the same application service layer.

The governing decision is in `docs/specs/0001-stack-architecture/index.md`.

## What works today

The seller to buyer path runs end to end against real database logic:

- **Seeded identity and community.** Seller, buyer, and operator accounts sign in, resolve their community membership, and reach their own dashboard. One household cannot read another household's private records.
- **Seller forecast and sharing.** A seller reviews tomorrow's labeled 15 minute estimates for generation, home demand, reserve, and shareable surplus, then publishes an offer with a chosen quantity and minimum price.
- **Buyer marketplace and reservation.** A buyer picks an interval, reviews quantity, estimated cost, and estimated saving against the community tariff, and submits a reservation inside a price limit.
- **Explainable pricing.** Tariffs, local supply, demand, user limits, and a simulated import congestion signal resolve to a bounded deterministic price. Identical inputs return an identical result, and the stored explanation records why. The formula exists twice on purpose, as `linear-pressure-v1` in `src/domain/pricing.ts` and as the trusted PostgreSQL calculator, and the two are checked against each other.

Reservations stay in a pending state until matching lands.

### Still to come

| # | Feature | Status |
|---|---|---|
| 9 | Matching and allocation | in progress |
| 10 | Settlement and credit ledger | planned |
| 11 | Operator demo and clean reset | planned |
| 12 | Realtime invalidation updates | planned |

Live weather and solar providers, CSV import and export, a community map, public onboarding, and the full accessibility and visual pass are deliberately deferred. `docs/scope/scope.md` is the current plan of record.

## Local setup

Use Node.js 24 and pnpm 10.23.0.

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`.

The example environment uses safe local values. Replace the Supabase values after `supabase start` provides the local project URL and publishable key.

### Demo accounts

The seed creates one community, `SolarShare Bengaluru Demo`, and six accounts:

| Email | Role |
|---|---|
| `operator@solarshare.local` | operator |
| `seller@solarshare.local` | seller household |
| `buyer1@solarshare.local` through `buyer4@solarshare.local` | buyer households |

Seeded accounts have no password until one is set. In `.env.local`, set `SOLARSHARE_DEMO_PASSWORD` along with `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, then run:

```bash
pnpm db:activate-demo-users
```

The script refuses to run outside a `local` or `test` `APP_ENV`.

### Database commands

Local database commands require Docker:

```bash
pnpm db:start:local
pnpm db:reset:local
pnpm db:types:local
```

After linking the CLI to the hosted Supabase project, migrations and generated types can target that project:

```bash
pnpm db:push:linked
pnpm db:types:linked
```

The shorter `db:start`, `db:reset`, and `db:types` commands remain aliases for the local variants. Review hosted migrations before running the linked push command.

Schema changes are forward migrations in `supabase/migrations`. The seed in `supabase/seed.sql` is deterministic, so a reset restores the same scenario.

## Configuration behavior

The web server validates its configuration before it becomes ready. Missing core values produce a setup error. Browser code receives only the validated Supabase URL, publishable key, timezone, and currency through the root layout. Server secrets are never exposed through public configuration.

`TASKS_ENABLED` defaults to `false`. When it is false, web dispatch is unavailable and worker tasks must exit before side effects. When it is true, each runtime also requires its own credentials.

Weather, solar, and geocoding adapters are prepared but not enabled. Missing provider configuration keeps the stored sample path active. Provider reads follow the live, cache, then stored sample order defined in `src/core/providers`, and the interface keeps the source label visible.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm check
```

Run the build with the required web environment values. Copying `.env.example` to `.env.local` supplies safe local values.
Run `pnpm format` to update supported source and configuration files with Prettier. Run `pnpm check` for the complete local automation sequence. Its build step loads the safe values in `.env.example` without creating or changing `.env.local`.

Tests are Vitest and sit beside their source as `*.test.ts` or `*.test.tsx`.

## Source boundaries

`src/app` owns routes, rendering, request parsing, and response formatting.

`src/application` owns framework independent use cases and authorization checks.

`src/domain` owns deterministic domain rules, including exact decimal handling and the pricing formula.

`src/repositories` owns persistence contracts and typed PostgreSQL function calls.

`src/core/providers` owns provider contracts and fallback behavior.

`src/adapters` connects Next.js, providers, and later Trigger.dev tasks to the core application.

Imports from `src` use the `@/*` alias. Reads prefer Server Components; Client Components are for browser interaction only.

## Documentation

- `docs/scope/scope.md` tracks features, status, and what comes next.
- `docs/specs/NNNN-title/` holds each decision in `index.md` with supporting reasoning in `rationale.md`.
- `design.md` is the design system; its token values live in `src/app/globals.css`.
- `AGENTS.md` records the stack, commands, and conventions this repository expects.
- `SolarShare_Development_Blueprint.md` is the original product and system baseline.

## License

See `LICENSE`.
