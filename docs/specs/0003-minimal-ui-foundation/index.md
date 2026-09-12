# 0003. Establish the SolarShare minimal UI foundation

**Date**: 2026-09-12
**Status**: In Progress

## Summary

SolarShare will use a deliberately plain application shell and a small set of source owned shadcn components. A warm neutral canvas, one solar green accent, clear typography, and compact bordered surfaces will keep attention on trading data. Every feature screen will inherit responsive navigation, semantic page structure, keyboard focus, readable contrast, feedback states, and visible provider provenance.

## Requirements

**User stories**:

1. As a household user, I want each screen to feel familiar on a phone or desktop so that I can act without relearning the interface.
2. As a keyboard or assistive technology user, I want controls, landmarks, status changes, and errors to be clear so that the demo remains operable without a pointer.
3. As a user reading provider data, I want to see where a value came from so that live, cached, and stored sample results are not confused.
4. As a developer, I want one small component foundation so that later features reuse states and controls instead of creating competing patterns.

**Acceptance criteria**:

1. **AC-1**: Application routes can use one responsive shell with a product landmark, primary navigation, one main content landmark, a skip link, a contained content width, and a footer. The shell has no page level horizontal overflow at a 320 pixel viewport.
2. **AC-2**: Shared button, badge, card, alert, empty, skeleton, input, field, and table components use Tailwind 4 semantic tokens and shadcn composition conventions. Inputs and buttons provide at least a 44 pixel target. Tables scroll inside their own region on small screens.
3. **AC-3**: Reusable loading, empty, failure, and success components provide distinct copy and semantics. Loading and success use status announcements, failure uses an alert, and empty content explains what can happen next.
4. **AC-4**: A reusable source label accepts the existing `ProviderSource` values `live`, `cache`, and `sample`, displays the provider supplied `sourceLabel`, and explicitly exposes fallback data when the result is degraded.
5. **AC-5**: Interactive controls are keyboard usable, every focusable control has a visible three pixel focus indicator, normal text meets WCAG AA contrast, and meaning never relies on colour alone. Reduced motion preference is respected.
6. **AC-6**: Pages, layouts, shell, labels, and static states remain Server Components. Only a boundary that requires a browser event, such as retrying a failed route, is a Client Component.
7. **AC-7**: The foundation overview is not a feature dashboard. It documents the shared system with one primary action and contains no mock trading records or unimplemented route links.

## Decision

**Chosen option**: Option 1: Calm utility shell with source owned shadcn primitives

Use a light and professional default with a warm canvas and one deep green accent. Support dark appearance through the operating system preference. Keep the first route as a foundation overview until identity and role dashboards are implemented. Store visual values in `src/app/globals.css`, art direction in `design.md`, and reusable interface code in `src/components`.

The project will own the shadcn component source. It will use Radix Slot only for safe button composition and Lucide for a small consistent icon set. No navigation drawer, theme control, animation library, or image asset is needed for this foundation.

**Implementation skills**: `nextjs-app-router-patterns` (`.agents/skills/nextjs-app-router-patterns/`) · `shadcn` (`.agents/skills/shadcn/`) · `vitest` (`.agents/skills/vitest/`)

## Feature design

### Visual system

1. Light appearance uses warm off white canvas, white surfaces, near black green ink, deep green primary action, and a green tinted neutral ladder. Dark appearance inverts the ladder and uses a lighter green primary action.
2. The primary colour is reserved for the page action, active navigation, focus, and small status cues. Cards use borders and a restrained soft shadow. Decorative gradients and imagery are excluded.
3. The interface uses the system sans stack with a 16 pixel body size, three practical weights, a four pixel base unit, an eight pixel rhythm, and three radius levels.
4. Contrast is verified before implementation. Light ratios are body `9.35:1`, ink `15.50:1`, muted `5.52:1`, text on primary `6.55:1`, and control border `3.56:1`. Dark ratios are body `12.41:1`, ink `16.79:1`, muted `8.53:1`, text on primary `8.35:1`, and control border `3.23:1`.

### Shell structure

1. The root layout owns global metadata, configuration injection, and global CSS. An application route group owns the app shell so a later public or identity route can choose a different layout without changing the root.
2. At large widths the shell uses a 17 rem side rail and flexible content region. Below that width it uses a top brand region with horizontal navigation.
3. The shell supplies the only `main` landmark, skip link target, content width, and product footer. Pages supply one `h1` through `PageHeader` and do not nest another `main`.
4. Navigation contains only implemented destinations. The foundation starts with Overview. Later features add their links when their routes exist.

### Component contract

| Component | Contract |
|---|---|
| `AppShell` | Accepts route content, current path, and typed navigation items. Renders responsive brand, primary navigation, main landmark, and footer. |
| `PageHeader` | Accepts eyebrow, title, description, and optional primary action. Keeps page hierarchy and action placement consistent. |
| `Button` | Supports default, destructive, outline, secondary, ghost, and link variants plus three target sizes and icon composition. |
| `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `Input` | Provide persistent labels, help and error association points, invalid state styling, and 44 pixel controls. |
| `Table` and parts | Use native table semantics and a local horizontal scroll container. Headers require an explicit scope where used. |
| `StatusLabel` | Accepts neutral, success, warning, or failure tone and always renders visible text. |
| `LoadingState` | Accepts an accessible label, exposes busy status, and renders shadcn skeletons inside a card. |
| `FeedbackState` | Accepts empty, failure, or success, plus title, description, and optional action. Empty uses the shadcn empty composition. |
| `SourceLabel` | Accepts `ProviderSource`, provider label, and optional degraded flag. It renders the provider label, source kind metadata, and fallback state. |

### State behavior

| State | Semantics | Content rule |
|---|---|---|
| Loading | `role="status"`, `aria-busy="true"`, visible skeletons, and a visually hidden label | Preserve the approximate shape of the region being loaded. |
| Empty | Named empty region with icon, title, and explanation | Explain why no data appears and add one useful action only when a real feature can perform it. |
| Failure | `role="alert"` with destructive tone | State what failed in user terms and offer a retry or recovery action where one exists. |
| Success | `role="status"` with success tone | Confirm the completed action near the region that changed. |

### Source label behavior

| Provider source | Default description | Default degraded state |
|---|---|---|
| `live` | Live source | false |
| `cache` | Cached source | true |
| `sample` | Stored sample source | true |

The visible label always comes from `ProviderResult.sourceLabel`. The source kind chooses the icon and accessible description. `ProviderResult.degraded` may override the default when a caller has more specific knowledge. Source labels remain next to the data or section they describe.

### Rendering boundaries

1. The foundation page and layout are Server Components and contain no browser hooks.
2. Shared presentational components remain Server Component compatible.
3. `error.tsx` is a Client Component because Next.js provides a browser retry callback. It composes the shared failure state and button rather than duplicating them.
4. `loading.tsx` composes the shared loading state so later dynamic routes can stream without a blank content region.

### Value sourcing

| Value produced or displayed | Source |
|---|---|
| Product name and purpose | Root project description and accepted stack spec. |
| Current navigation state | Route layout supplied current path compared with each navigation item href. |
| Page title, description, and primary action | The feature screen that composes `PageHeader`. |
| Feedback title, description, and recovery action | The read or mutation result owned by the feature screen. |
| Provider label and degradation | `ProviderResult.sourceLabel`, `ProviderResult.source`, and `ProviderResult.degraded`. |
| Visual colours, spacing, radius, shadow, and focus | Semantic tokens in `src/app/globals.css`. |
| Dark appearance | The browser `prefers-color-scheme` media query. |

### Critical test scenarios

1. Render the shell and confirm the skip link, named navigation, current page state, one main target, and page content, verifies **AC-1** and **AC-6**.
2. Render each provider source and confirm its supplied label, source metadata, and degraded description, verifies **AC-4**.
3. Render every feedback state and confirm state marker, alert or status role, busy state, and accessible loading label, verifies **AC-3**.
4. Inspect the overview at phone and desktop widths in light and dark appearance. Confirm no page overflow, correct navigation layout, readable table strategy, visible focus, and one primary action, verifies **AC-1**, **AC-2**, **AC-5**, and **AC-7**.
5. Run formatting, strict types, lint with no warnings, Vitest, and the production build, verifies the component and rendering contracts compile together.

## Build plan

1. [x] Add the semantic light and dark Tailwind 4 tokens, global focus treatment, reduced motion handling, shadcn configuration, and art direction record, satisfies **AC-2** and **AC-5**.
2. [x] Add shared shadcn button, badge, card, alert, empty, skeleton, input, field, and table source components, satisfies **AC-2**.
3. [x] Add the responsive server rendered app shell, page header, status label, source label, and feedback states, satisfies **AC-1**, **AC-3**, **AC-4**, and **AC-6**.
4. [x] Replace the scaffold page with a foundation overview plus route loading and error surfaces, satisfies **AC-3**, **AC-6**, and **AC-7**.
5. [x] Add nearby Vitest rendering tests and complete phone, desktop, light, dark, keyboard, contrast, format, type, lint, test, and build checks, satisfies **AC-1** through **AC-7**.

## Consequences

**Positive**:

1. Later feature screens begin with tested structure and state patterns instead of a blank route.
2. Source provenance stays visible from the first provider backed screen.
3. Most interface code remains server rendered and sends no feature JavaScript to the browser.
4. Semantic tokens make light and dark appearance consistent without colour overrides in components.

**Negative and tradeoffs**:

1. The plain system is intentionally restrained and may need more product character after the trading flow is proven.
2. The shell receives its current path rather than adding a client navigation hook. A later nested route structure must pass that value or split layouts by route group.
3. System fonts avoid a network and build dependency but provide less distinct typography than a bundled product font.

**Neutral**:

1. The overview presents the foundation only. Identity, seller, buyer, pricing, settlement, and operator screens remain outside this feature.
2. Dark appearance follows the operating system. A manual theme preference can be added only when a later feature needs it.
3. No image asset, mobile drawer, toast system, dialog, or data chart is part of this foundation.
