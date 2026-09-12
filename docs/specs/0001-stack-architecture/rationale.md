# Rationale for 0001. Adopt the SolarShare application foundation

## Context

SolarShare is a greenfield prototype for a seeded community. It must demonstrate one reliable path from seller forecast through buyer reservation to matching and settlement. The system records energy credits rather than moving electricity or real money.

The domain has strong relational structure, private household data, community boundaries, decimal energy and credit values, and several operations that must commit atomically. Forecast and mapping providers may be unavailable, but the judged flow must remain repeatable with labelled sample and simulated data.

The first release favors speed and low operational burden. The scope uses a Skateboard approach, which means the smallest complete product should run before optional integrations and interface polish grow. There is no source code, Git repository, or project context file yet, so this decision must give the first scaffold a stable foundation without designing speculative scale.

This spec governs the application foundation only. The detailed data and access model, interface foundation, pricing, matching, and settlement remain separate decisions linked from `docs/scope/scope.md`.

## Options considered

### Option 1: Managed modular monolith

One modular Next.js codebase provides a Vercel web deployment and a Trigger.dev task deployment. Supabase provides PostgreSQL, Auth, Row Level Security, Storage, and Realtime. Framework independent domain modules serve both adapters. (basis: `SolarShare_Development_Blueprint.md`, modular monolith practice, [Next.js deployment requirements](https://nextjs.org/docs/app/guides/deploying-to-platforms))

**Pros**:

1. It gives the shortest path to the complete demo.

2. Managed infrastructure reduces operations while database transactions preserve correctness.

3. Clear internal seams allow later extraction when a measured need appears.

**Cons**:

1. It depends on three managed platforms.

2. Trigger.dev setup is additional work before scheduled workflows run.

### Option 2: Next.js with all compute inside Supabase

Next.js remains the web application while Supabase Edge Functions and database schedules run providers and market jobs. This reduces the vendor count but introduces a Deno function runtime beside Node.js. (basis: managed backend consolidation practice, `supabase-server`)

**Pros**:

1. Auth, data, functions, storage, and scheduling share one platform.

2. Database adjacent functions can reduce latency for some operations.

**Cons**:

1. The team must maintain Node.js and Deno execution paths.

2. Durable workflow visibility and retry control are less cohesive than a task platform.

### Option 3: Separate React application and Node.js API

A browser application and a dedicated API deploy separately, with PostgreSQL behind the API. This creates a strong network boundary from the start. (basis: service boundary practice)

**Pros**:

1. Frontend and backend releases can scale and deploy independently.

2. A dedicated API can serve future clients without restructuring routes.

**Cons**:

1. It duplicates deployment, auth integration, type sharing, and local development work.

2. The current scope has no second client or team ownership boundary that needs this split.

### Option 4: Self hosted container stack

The application and data services run in containers on infrastructure controlled by the team. This gives the most control over placement and runtime behavior. (basis: container operations practice)

**Pros**:

1. It reduces dependence on managed platform behavior.

2. It supports custom networking and deployment policy.

**Cons**:

1. Backups, upgrades, monitoring, security patches, and availability become project work.

2. The operational cost is disproportionate for a seeded prototype.

## Rationale

Option 1 fits the actual product stage. The team needs a complete, reliable demonstration more than independent service scaling. One modular deployable keeps feedback fast, while PostgreSQL transactions and Row Level Security address the correctness and privacy risks that matter now. (basis: `docs/scope/scope.md`, modular monolith practice, defense in depth practice)

Trigger.dev is the one deliberate addition beyond the blueprint. Forecast refresh, matching retries, and settlement are durable workflows rather than ordinary web requests. A task platform provides schedules, retries, deduplication, and visible runs, while a PostgreSQL transactional outbox prevents committed work from being lost before dispatch. Vercel Cron was the runner up because it has less setup, but it supplies a trigger rather than a durable workflow model. (basis: [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs), [Trigger.dev scheduled tasks](https://trigger.dev/docs/tasks/scheduled), idempotent job practice)

The foundation does not add an ORM, Redis, GraphQL, a search service, multiple regions, or microservices. None solves a measured first release problem, and each would create another source of failure. Supabase generated types cover ordinary access, while SQL functions are the right fit for concurrent matching and balanced settlement writes. (basis: `SolarShare_Development_Blueprint.md`, simple technology practice)

The environment contract adopts current Supabase publishable and secret keys rather than the legacy anon and service role names in the blueprint. Browser sessions use `@supabase/ssr`. The installed `supabase-server` guidance remains useful for typed server verification and any later worker or Edge Function, but `@supabase/server` is not required as the browser session owner. (basis: `supabase-server`, [Supabase package selection](https://supabase.com/docs/guides/auth/choosing-a-server-package), [Supabase server rendered auth guidance](https://supabase.com/docs/guides/auth/server-side))

## Landscape evidence

The current official documentation supports Server Components by default, the Node.js runtime for broad compatibility, cookie based Supabase sessions with PKCE, local Supabase development through its CLI, standard Node deployment portability, durable Trigger.dev schedules, and server OpenTelemetry. Browser OpenTelemetry remains experimental, so it is not part of the first release instrumentation. (basis: [Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist), [Supabase local development](https://supabase.com/docs/guides/local-development), [OpenTelemetry JavaScript status](https://opentelemetry.io/docs/languages/js/))

## References

**Project sources**:

1. `SolarShare_Development_Blueprint.md`, the product, domain, system, data, API, provider, security, environment, and test baseline.

2. `docs/scope/scope.md`, the linked foundation feature, Skateboard delivery approach, and Beta rigor.

3. `.agents/skills/nextjs-app-router-patterns/`, rendering and application boundary guidance.

4. `.agents/skills/supabase-postgres-best-practices/`, PostgreSQL schema, transaction, security, and performance guidance.

5. `.agents/skills/supabase-server/`, current Supabase server authentication and key guidance.

6. `.agents/skills/trigger-setup/` and `.agents/skills/trigger-tasks/`, task setup, scheduling, retry, queue, and idempotency guidance.

7. `.agents/skills/opentelemetry/`, vendor neutral telemetry guidance.

**Practices and standards**:

1. Modular monolith for a small team and an early product.

2. Relational transactions for allocations, settlement, and balanced ledger writes.

3. Defense in depth through database policies and server authorization.

4. Idempotent jobs with database constraints as the final duplicate protection.

5. Reproducible builds through a committed lockfile, migrations, generated types, and deterministic seed data.

**Links**:

1. [Next.js production checklist](https://nextjs.org/docs/app/guides/production-checklist)

2. [Next.js deployment requirements](https://nextjs.org/docs/app/guides/deploying-to-platforms)

3. [Supabase package selection](https://supabase.com/docs/guides/auth/choosing-a-server-package)

4. [Supabase server rendered auth guidance](https://supabase.com/docs/guides/auth/server-side)

5. [Supabase local development](https://supabase.com/docs/guides/local-development)

6. [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)

7. [Trigger.dev scheduled tasks](https://trigger.dev/docs/tasks/scheduled)

8. [OpenTelemetry JavaScript status](https://opentelemetry.io/docs/languages/js/)

9. [OpenTelemetry instrumentation](https://opentelemetry.io/docs/languages/js/instrumentation/)
