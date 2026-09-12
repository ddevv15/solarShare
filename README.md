# SolarShare

SolarShare is a local solar credit marketplace. This repository starts as one modular Next.js application. Supabase PostgreSQL will own relational state and transactions. Trigger.dev will run durable work through the same application service layer.

The governing decision is in `docs/specs/0001-stack-architecture/index.md`.

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

## Configuration behavior

The web server validates its configuration before it becomes ready. Missing core values produce a setup error. Browser code receives only the validated Supabase URL, publishable key, timezone, and currency through the root layout.

`TASKS_ENABLED` defaults to `false`. When it is false, web dispatch is unavailable and worker tasks must exit before side effects. When it is true, each runtime also requires its own credentials.

Weather, solar, and geocoding adapters are not enabled by this scaffold. Missing provider configuration keeps the stored sample path active. Later provider work may add live and cached candidates behind the fallback contract in `src/core/providers`.

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

## Source boundaries

`src/app` owns routes, rendering, request parsing, and response formatting.

`src/application` owns framework independent use cases and authorization checks.

`src/domain` owns deterministic domain rules.

`src/repositories` owns persistence contracts and implementations.

`src/core/providers` owns provider contracts and fallback behavior.

`src/adapters` connects Next.js, providers, and later Trigger.dev tasks to the core application.
