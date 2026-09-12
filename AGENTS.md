# SolarShare

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Stack

* Language and runtime: TypeScript in strict mode on Node.js 24.
* Framework: Next.js 16.3.5 App Router with React 19.2.8.
* Interface and validation: Tailwind CSS 4, shadcn/ui, and Zod 4.
* Managed services: Supabase PostgreSQL, Vercel, and Trigger.dev.
* Package manager: pnpm 10.23.0.

## Build approach

**Skateboard:** Ship the smallest complete trading demo first, then grow the same usable product.

## Commands

```bash
pnpm install
cp .env.example .env.local
pnpm dev
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm check
```

## Specs

Numbered specs live in `docs/specs/NNNN-title/`, with the decision in `index.md` and supporting reasoning in `rationale.md`.

## Rules

* Use the `@/*` alias for imports from `src`.
* Prefer Server Components for reads. Use Client Components only for browser interaction.
* Keep routes, request parsing, rendering, and response formatting in `src/app`.
* Keep framework independent use cases and authorization checks in `src/application`.
* Keep deterministic calculations and state rules in `src/domain`.
* Keep persistence behind repositories and typed PostgreSQL functions.
* Validate environment values and other untrusted inputs with Zod.
* Read environment values through `src/lib/config`. Never expose server secrets through public configuration.
* Provider reads follow the live, cache, then stored sample fallback order and retain visible source labels.
* Place Vitest tests beside their source using `*.test.ts` or `*.test.tsx`.
