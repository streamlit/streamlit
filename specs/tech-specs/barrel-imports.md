# Barrel Imports Strategy

## Context

This document captures a practical strategy for reducing barrel-file usage in Streamlit, plus an estimate of migration scope and likely complexity.

Background references:

- https://tkdodo.eu/blog/please-stop-using-barrel-files
- https://dev.to/tassiofront/barrel-files-and-why-you-should-stop-using-them-now-bc4

## Why This Matters

Barrel imports are convenient, but in application code they create recurring issues:

- They hide actual dependency edges and make import graphs harder to reason about.
- They increase risk of accidental circular dependencies.
- They can produce fragile chunk graphs and bundle-order warnings.
- They broaden invalidation scope for rebuilds/HMR/typecheck/tests.

We already saw this directly: `make frontend` emitted Rollup warnings about re-exports through barrel files causing potential circular chunk execution ordering.

## Repo Findings (approximate)

Analysis snapshot (current branch state):

- `404` barrel import sites
- `214` unique importer files
- `95` unique barrel files
- Concentration:
  - `frontend/lib`: `396` import sites across `209` files
  - `frontend/utils`: `7` import sites across `4` files
  - `frontend/app`: `1` import site across `1` file

### Internal component-barrel scope

If we focus on `frontend/lib/src/components/**` barrels (highest-value migration target):

- `286` barrel import sites
- `137` unique importer files
- `82` unique component barrel files

This is the best estimate for "remove most internal app barrels" effort.

### Largest barrel hotspots (by import-site count)

- `frontend/lib/src/theme/index.ts` -> `81`
- `frontend/lib/src/components/widgets/DataFrame/columns/index.ts` -> `32`
- `frontend/lib/src/components/shared/Icon/index.ts` -> `30`
- `frontend/lib/src/components/shared/StreamlitMarkdown/index.ts` -> `22`
- `frontend/lib/src/components/shared/Tooltip/index.ts` -> `19`
- `frontend/lib/src/components/widgets/BaseWidget/index.ts` -> `18`
- `frontend/lib/src/components/shared/BaseButton/index.ts` -> `17`

## Suggested Strategy for Streamlit

### 1) Keep barrels only at true public boundaries

Use barrels for package-level public APIs (library entrypoints), not for internal app wiring.

### 2) Avoid internal runtime barrel imports in app code

For `frontend/lib/src/components/**`, import concrete modules directly:

- Prefer: `~lib/components/shared/Tooltip/Tooltip`
- Avoid: `~lib/components/shared/Tooltip`

### 3) Prefer `import type` for type-only symbols

Even when barrels remain, type-only imports should be explicit to avoid unnecessary runtime edges.

### 4) Add lint guardrails

Add `no-restricted-imports` rules for known internal barrels (at least the high-traffic ones) so new code does not regress.

### 5) Migrate in phases

Start with the barrels that currently cause bundler warnings and highest fan-in, then move to long tail.

## Complexity / Risk Areas

These are the main non-trivial parts when applying this repo-wide:

- **Non-trivial index files**: out of `123` `index.ts(x)` files, `22` contain more than simple re-exports/imports and need manual review.
- **Hot aggregator files**: e.g. `ElementNodeRenderer.tsx` imports many barrel paths; converting this file is high-impact and should be batched carefully.
- **Cycle surfacing**: migrating one side of a barrel can expose previously-hidden cycles elsewhere.
- **Public API expectations**: some barrels are legitimate package surfaces and should remain.
- **Refactor blast radius**: changing import paths in ~140-210 files is mechanically simple but review-heavy.

## Recommended Rollout Plan

### Phase 0 (done on current branch)

- Fix warning-producing barrel imports for `BaseButton`, `Tooltip`, `StreamlitMarkdown`, `Skeleton`.
- Result: Rollup re-export circular warnings dropped to zero in `make frontend`.

### Phase 1 (high-value)

- Migrate top hotspot internal barrels:
  - `shared/Icon`
  - `shared/StreamlitMarkdown`
  - `shared/Tooltip`
  - `widgets/BaseWidget`
  - `widgets/DataFrame/columns`
- Add lint restrictions for these barrel paths.

Expected scope: most of the `137` importer files in components.

### Phase 2 (long tail)

- Continue direct-import migration for remaining internal component barrels.
- Keep package/public entrypoint barrels where they provide external API stability.

## Practical Scope Estimate

Depending on policy strictness:

- **Internal components only (recommended first target)**: ~`137` files
- **Most `frontend/lib` internal barrels**: up to ~`209` files
- **Nearly all current frontend barrel imports**: up to ~`214` files

These are approximate and include both easy mechanical rewrites and a smaller set of manual-review cases.

