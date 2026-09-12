# 0001. Adopt the SolarShare application foundation

**Date**: 2026-09-12
**Status**: Accepted

## Summary

SolarShare will begin as one modular application codebase backed by Supabase PostgreSQL. Vercel will run the web application, Trigger.dev will run durable background work from the same service layer, and PostgreSQL will own transaction safety. This keeps the first demo small while preserving clear seams for future providers and services.

## Decision

**Chosen option**: Option 1: Managed modular monolith

Build one modular Next.js codebase with separate application services for identity, forecasting, pricing, matching, settlement, imports, and simulation. Deploy its web adapter to Vercel and its task adapter to Trigger.dev. Keep state in Supabase PostgreSQL, keep market transactions in typed SQL functions, and use a transactional outbox for reliable work handoff. (basis: `SolarShare_Development_Blueprint.md`, the modular monolith practice, [Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist), [Supabase server rendered auth guidance](https://supabase.com/docs/guides/auth/server-side), [Trigger.dev scheduled tasks](https://trigger.dev/docs/tasks/scheduled))

**Implementation skills**: `nextjs-app-router-patterns` (`wshobson/agents`, `.agents/skills/nextjs-app-router-patterns/`) · `shadcn` (`shadcn/ui`, `.agents/skills/shadcn/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `supabase-server` (`supabase/server`, `.agents/skills/supabase-server/`) · `trigger-setup` (`triggerdotdev/skills`, `.agents/skills/trigger-setup/`) · `trigger-tasks` (`triggerdotdev/skills`, `.agents/skills/trigger-tasks/`) · `vitest` (`antfu/skills`, `.agents/skills/vitest/`) · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`) · `opentelemetry` (`grafana/skills`, `.agents/skills/opentelemetry/`)

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Product shape | Responsive web application | One browser product serves seller, buyer, and operator journeys without a second client platform. (basis: `SolarShare_Development_Blueprint.md`) |
| Architecture | Modular monolith | One deployable is fastest to build and operate, while service boundaries keep domain logic separable. (basis: modular monolith practice) |
| Runtime | Node.js 24 LTS | The active long term support line gives full Next.js and library compatibility. Edge runtime use requires a specific measured need. (basis: [Next.js deployment requirements](https://nextjs.org/docs/app/guides/deploying-to-platforms)) |
| Package management | pnpm with a committed lockfile and a pinned `packageManager` value | Scaffolding resolves compatible stable package versions once, then the lockfile and Node runtime pin make every environment repeatable. (basis: reproducible build practice) |
| Language | TypeScript in strict mode | Shared types reduce drift across pages, services, provider adapters, tasks, and generated database types. (basis: `SolarShare_Development_Blueprint.md`) |
| Framework | Current stable Next.js App Router | Server Components are the default for reads, Client Components are reserved for interaction, and the Node runtime supports the full application. (basis: [Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist), `nextjs-app-router-patterns`) |
| Interface styling | Tailwind CSS and shadcn/ui | This matches the blueprint and gives accessible primitives without adopting a large design framework. (basis: `SolarShare_Development_Blueprint.md`, `shadcn`) |
| Validation | Zod schemas at every untrusted boundary | One schema language can validate forms, route payloads, task payloads, provider responses, and environment values. (basis: boundary validation practice) |
| Primary database | Hosted Supabase PostgreSQL | The domain is relational and needs constraints, transactions, decimal arithmetic, and Row Level Security. (basis: `SolarShare_Development_Blueprint.md`, `supabase-postgres-best-practices`) |
| Database access | Generated Supabase types and clients for ordinary access, typed SQL functions for market transactions | This avoids an extra ORM while keeping matching and settlement atomic inside PostgreSQL. (basis: `SolarShare_Development_Blueprint.md`, transaction boundary practice) |
| Schema workflow | Supabase CLI, versioned SQL migrations, generated types, and repeatable seed data | Schema, policies, functions, and demo setup remain reviewable and reproducible. (basis: [Supabase local development](https://supabase.com/docs/guides/local-development)) |
| Authentication | Supabase Auth with email and password, PKCE, seeded accounts, and `@supabase/ssr` cookie sessions | It reuses the database identity and refreshes browser sessions safely through `proxy.ts`. (basis: [Supabase package selection](https://supabase.com/docs/guides/auth/choosing-a-server-package), [Supabase server rendered auth guidance](https://supabase.com/docs/guides/auth/server-side)) |
| Authorization | Row Level Security plus server capability checks | Database policies protect direct access, while server services enforce role, ownership, and community rules. (basis: defense in depth practice, `SolarShare_Development_Blueprint.md`) |
| API shape | Server Components for reads, Server Actions for same application mutations, and JSON Route Handlers for explicit client or integration contracts | Pages can call application services without an internal HTTP loop, while the blueprint routes remain available where a stable JSON boundary is useful. (basis: `nextjs-app-router-patterns`, REST for focused resource APIs) |
| Realtime | Supabase Realtime as an invalidation signal followed by an authorized refetch | Events improve responsiveness without becoming the source of truth for market or ledger state. (basis: `SolarShare_Development_Blueprint.md`) |
| Background work | Trigger.dev schedules and durable tasks with a PostgreSQL transactional outbox | Forecast refresh, matching retries, and settlement need reliable submission, retries, idempotency, deduplication, and visible runs. Database functions still own atomic writes. (basis: [Trigger.dev scheduled tasks](https://trigger.dev/docs/tasks/scheduled), idempotent job practice, `trigger-tasks`) |
| File storage | Private Supabase Storage buckets | Later CSV imports need object storage with access policies and short retention, not database blobs or a second provider. (basis: `SolarShare_Development_Blueprint.md`, object storage practice) |
| External data | Typed adapters for Open Meteo, PVGIS, geocoding, future devices, and stored sample providers | Domain services do not depend on provider payloads, and every fallback remains visibly labelled. (basis: `SolarShare_Development_Blueprint.md`) |
| Hosting | Vercel for Next.js, hosted Supabase for data services, and Trigger.dev Cloud for tasks | Managed services minimize operations for the first release. Next.js stays on the standard Node runtime so another host remains viable. (basis: [Next.js deployment requirements](https://nextjs.org/docs/app/guides/deploying-to-platforms)) |
| Observability | Structured JSON logs and server OpenTelemetry, with Vercel and Trigger.dev run logs initially | Correlation data exists from the start without binding instrumentation to one backend. Browser OpenTelemetry is deferred because its JavaScript support remains experimental. (basis: [OpenTelemetry JavaScript status](https://opentelemetry.io/docs/languages/js/), [OpenTelemetry instrumentation](https://opentelemetry.io/docs/languages/js/instrumentation/), `opentelemetry`) |
| Testing | Vitest for unit tests, local Supabase for integration and policy tests, Playwright for browser journeys | The stack covers deterministic domain logic, real database security, and the complete judge path. (basis: `SolarShare_Development_Blueprint.md`, `vitest`, `playwright-cli`) |

### Application boundaries

1. Files under `app/` own routing, rendering, request parsing, and response formatting. They do not contain pricing, matching, settlement, or provider rules.

2. Application services own use cases and authorization checks. They receive an explicit execution context containing the actor, correlation identifier, clock, data clients, provider adapters, and logger. They cannot import Next.js cookies, headers, caches, or route helpers.

3. Next.js adapters resolve the current session and create a user scoped execution context. Trigger.dev adapters create a named trusted job context. A user initiated task records the initiating user and community, then resolves current authorization again when it runs rather than carrying a browser token.

4. Domain services own deterministic calculations. Repository modules and typed SQL functions own persistence. Provider adapters translate external payloads into SolarShare types. Page components and domain services never call provider URLs directly.

5. Trigger.dev tasks call the same framework independent application services as request paths. They use schema validated and versioned payloads, stable task identifiers, scoped concurrency, and idempotency keys.

6. Ordinary user requests persist through a client bound to the user session so Row Level Security remains active. A privileged Supabase client may appear only in isolated administrative and worker adapters for explicitly named operations. Browser code receives only the Supabase URL and publishable key.

7. A transaction that requires later work writes an outbox record in the same database commit. Dispatch may happen immediately after commit, but a scheduled reconciler claims pending or stale outbox records, dispatches them with an idempotency key derived from the outbox identifier, and records the result. The later data model spec owns the table fields and indexes.

8. PostgreSQL functions and transactions own matching, allocation, settlement, and balanced ledger writes. A task retry must not create a duplicate allocation or settlement.

9. Supabase Realtime announces that state changed. Clients refetch through an authorized read path before displaying authoritative values.

10. The application uses one deployment region near the hosted database. Multiple regions, Redis, a separate search engine, GraphQL, and microservices remain out of scope until a measured need appears.

11. Database changes use expand and contract compatibility. Add compatible schema first, deploy consumers that understand old and new forms, deploy producers, wait for old web releases and task runs to drain, then remove the old form in a later migration. Breaking task payloads receive a new version and task identifier.

### Environment contract

Environment values are validated by separate web, worker, and public configuration schemas. `.env.example` contains names and safe example values only. Safe public values are serialized from validated server configuration into the root layout as `PublicAppConfig`; application code does not read arbitrary environment values in the browser.

| Value | Exposure | Requirement | Missing value behavior |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Required for authenticated application features | Fail startup with a setup error. Local development uses the URL from Supabase CLI. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Required for authenticated application features | Fail startup with a setup error. Do not introduce the legacy anon key name. |
| `SUPABASE_URL` | Server only | Required when worker execution is enabled | Reject worker startup when absent. It normally matches `NEXT_PUBLIC_SUPABASE_URL` but is configured independently for the worker deployment. |
| `SUPABASE_SECRET_KEY` | Server only | Required for privileged worker and administrative operations | Reject enabled worker startup when absent. The web application may boot, but privileged capabilities remain disabled. Local seed reset uses Supabase CLI rather than this application secret. |
| `APP_ORIGIN` | Server only | Required per environment | Fail startup because auth redirects and absolute links would be unsafe to infer. |
| `APP_ENV` | Server and worker | Required, one of `local`, `test`, `preview`, or `production` | Fail startup when absent or invalid. It selects the matching configuration profile but never selects credentials by itself. |
| `APP_TIMEZONE` | Server and serialized public configuration | Optional, default `Asia/Kolkata` | Use the documented default and include it in `PublicAppConfig`. |
| `APP_CURRENCY` | Server and serialized public configuration | Optional, default `INR` | Use the documented default and include it in `PublicAppConfig`. Market configuration in the database remains authoritative. |
| `DEMO_SEED` | Server only | Optional, default `solarshare-demo-v1` | Use the documented fixed seed so simulations and tests are repeatable. |
| `TRIGGER_PROJECT_REF` | Build configuration and worker | Required when task code is configured | Reject the task build when absent. Keep one value for preview and a different value for production. |
| `TRIGGER_SECRET_KEY` | Server only | Required when web dispatch is enabled | Disable web dispatch and report the missing capability. This value does not control schedules already deployed to Trigger.dev. |
| `TASKS_ENABLED` | Server and worker | Optional boolean, default `false` | The value must match in Vercel and Trigger.dev. When false, web dispatch is unavailable and scheduled tasks exit before side effects. When true, each runtime rejects missing required credentials. |
| `OPEN_METEO_BASE_URL` | Server only | Optional until the weather adapter is enabled | Use the stored sample provider until the adapter spec supplies and validates the endpoint. A failed live request uses the cache, then stored sample data with a fallback label. |
| `OPEN_METEO_API_KEY` | Server only | Optional | Use keyless access only when the adapter confirms it is permitted, otherwise keep the stored sample provider active. |
| `PVGIS_BASE_URL` | Server only | Optional until the solar adapter is enabled | Use the stored sample provider until the adapter spec supplies and validates the endpoint. A failed live request uses the cache, then stored sample data with a fallback label. |
| `PVGIS_API_KEY` | Server only | Optional | Use keyless access only when the adapter confirms it is permitted, otherwise keep the stored sample provider active. |
| `GEOCODING_BASE_URL` | Server only | Optional until map work begins | Disable live search and use seeded approximate locations until the map spec supplies the endpoint. |
| `GEOCODING_API_KEY` | Server only | Optional until the selected geocoder requires it | Disable live search without affecting the seeded demo. |
| `INTERNAL_JOB_SECRET` | Server only | Optional | Required only if a later spec enables internal HTTP job routes. Those routes remain absent by default. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Server only | Optional | Keep structured platform logs without exporting telemetry. |
| `OTEL_EXPORTER_OTLP_HEADERS` | Server only | Optional secret | Export without an authorization header when the configured endpoint accepts it. Never log this value. |
| `OTEL_SERVICE_NAME` | Server only | Optional, default `solarshare-web` | Use the documented service name. Tasks use `solarshare-tasks`. |

### Failure and operating rules

1. A core Supabase configuration error fails clearly. External weather, solar, and geocoding failures degrade to cached or stored sample data and preserve the visible source label.

2. Trigger.dev may retry orchestration. The database outbox prevents committed work from being lost before dispatch, while PostgreSQL uniqueness rules, locks, and idempotency records remain the final protection against duplicate market writes.

3. A Realtime disconnect falls back to ordinary refresh. It never blocks a purchase, matching result, or settlement read.

4. User specific and auth refresh responses must not use shared cache storage. Public content may use explicit Next.js caching.

5. Logs include a request or task correlation identifier, community identifier where allowed, operation name, outcome, duration, and error code. Logs exclude tokens, secrets, exact household coordinates, and raw private readings.

6. Local work uses Supabase CLI and the Trigger.dev development environment. Pull request previews share one controlled preview Supabase project, use one preview Trigger.dev project, and keep `TASKS_ENABLED=false`. Only the designated staging deployment may enable preview tasks. Production uses separate Supabase and Trigger.dev projects. Vercel functions run in the same broad geography as the database to limit latency.

7. Provider calls use explicit timeouts and bounded retries. The application never labels cached, modeled, or simulated data as live measured data.

8. Database unavailability makes authenticated reads and all transactional market writes unavailable. Provider sample fallbacks may preserve forecast demonstrations, but they never manufacture a successful offer, reservation, allocation, settlement, or ledger write.

9. `supabase/migrations/` is the only migration source. A canonical release pipeline owns remote migration application. Preview deployments never apply migrations, and contract migrations wait until old web releases and task runs can no longer use the removed form.

## Consequences

**Positive**:

1. One application and one relational store keep development, debugging, and deployment understandable.

2. Database transactions and Row Level Security protect the market rules at the strongest shared boundary.

3. Provider adapters and durable tasks support real integrations later without changing page or domain contracts.

4. The complete environment contract lets the scaffold boot locally and makes optional capabilities fail visibly and safely.

**Negative and tradeoffs**:

1. The project depends on three managed platforms, Vercel, Supabase, and Trigger.dev.

2. Trigger.dev adds account setup and another deployment even though the first demo has low volume.

3. SQL functions require disciplined migration and integration testing. They cannot be treated like ordinary client queries.

4. Serverless web functions are stateless and unsuitable for long work. Durable work must stay in Trigger.dev and stateful consistency must stay in PostgreSQL.

5. The new Supabase publishable and secret key names differ from the legacy names in the blueprint.

**Neutral**:

1. The detailed data schema, access policies, pricing rules, matching rules, and settlement rules remain owned by their later architecture specs.

2. The current API route inventory in the blueprint remains a product map. Each feature spec may narrow an endpoint or use a Server Action when no external JSON contract is needed.

## Follow-up

1. [ ] `nextjs-app-router-patterns` conventions are not yet in root `AGENTS.md` `## Rules`. They apply across the application and belong at root level.

2. [ ] `shadcn` conventions are not yet in root `AGENTS.md` `## Rules`. They apply across the interface and belong at root level.

3. [ ] `supabase-postgres-best-practices` conventions are not yet in root `AGENTS.md` `## Rules`. They govern the core database and belong at root level.

4. [ ] `supabase-server` conventions are not yet captured. `lib/auth/AGENTS.md` should contain them before server authentication adapters are implemented, and root `AGENTS.md` should point to that file.

5. [ ] `trigger-setup` conventions are not yet captured. `trigger/AGENTS.md` should contain them before task setup begins, and root `AGENTS.md` should point to that file.

6. [ ] `trigger-tasks` conventions are not yet captured. `trigger/AGENTS.md` should contain them before task authoring begins, and root `AGENTS.md` should point to that file.

7. [ ] `vitest` conventions are not yet captured. `tests/AGENTS.md` should contain them before unit and integration test work begins, and root `AGENTS.md` should point to that file.

8. [ ] `playwright-cli` conventions are not yet captured. `tests/e2e/AGENTS.md` should contain them before browser test work begins, and root `AGENTS.md` should point to that file.

9. [ ] `opentelemetry` conventions are not yet captured. `lib/observability/AGENTS.md` should contain them before instrumentation begins, and root `AGENTS.md` should point to that file.

10. [ ] Confirm the Supabase and Trigger.dev project regions during environment creation, then place the Vercel Node functions in the same broad geography.

11. [ ] Review the public terms, attribution, and rate limits for Open Meteo, PVGIS, the selected geocoder, and the selected map tile service before enabling live production traffic.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
