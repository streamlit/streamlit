# ESLint and TypeScript Rules With High ROI for Streamlit Frontend

## Scope

This note is based on the current frontend setup in:

- `frontend/eslint.config.mjs`
- `frontend/app/eslint.config.mjs`
- `frontend/typescript-config/base.tsconfig.json`
- `frontend/{app,lib,connection,utils}/tsconfig.json`

I also ran targeted probes on the frontend TypeScript sources:

- ~843 `*.ts` / `*.tsx` files under `frontend/{app,lib,connection,utils}/src`, including tests
- ~552 non-test source files for suppression/debt counts

For ESLint rules, I overlaid candidate rules on top of the existing flat config and counted violations.
For TypeScript compiler flags, I ran `tsc -p` per workspace entrypoint and summed the diagnostics, so those counts are directional rather than perfectly exact.

## Current Baseline

The repo is already stricter than many TypeScript codebases:

- `strict: true` is already enabled.
- `useUnknownInCatchVariables`, `noImplicitOverride`, and `noFallthroughCasesInSwitch` are already enabled.
- ESLint already uses `typescript-eslint`'s type-checked recommended config.
- React hooks, `@eslint-react`, a11y, import ordering, and several Streamlit-specific custom rules are already active.
- `@typescript-eslint/no-non-null-assertion`, `switch-exhaustiveness-check`, `return-await`, and several platform-specific restrictions are already enforced.
- `@typescript-eslint/no-floating-promises`, `@typescript-eslint/await-thenable`, `@typescript-eslint/no-misused-promises`, and `@typescript-eslint/no-explicit-any` are already enabled through the inherited type-checked config.
- The React-specific "nested component" problem is also already covered via `@eslint-react/no-nested-component-definitions`.

That matters because the next wins are not "turn on basic strictness." The highest ROI now comes from:

1. tightening precision around defaults, optionals, and dead conditionals
2. improving import hygiene so the TS config can get stricter later
3. avoiding rules that would mostly create suppression churn

There is also visible lint debt already in the tree:

- ~400 `eslint-disable-next-line` comments in non-test source
- ~165 `@typescript-eslint/no-explicit-any` suppressions/usages
- ~39 `streamlit-custom/no-force-reflow-access` suppressions
- ~29 `react-hooks/exhaustive-deps` suppressions
- ~23 `@ts-expect-error` comments

That argues for rules that either:

- catch real bugs with limited fallout, or
- are nearly mechanical to fix

## Best Candidates

### ESLint

| Rule | Approximate impact | Recommendation | Why it is high ROI |
| --- | ---: | --- | --- |
| `@typescript-eslint/consistent-type-exports` | 1 error in 1 file | Activate now | Near-zero churn. Cleans up public type surfaces and aligns with future module strictness. |
| `@typescript-eslint/consistent-type-imports` | 989 errors in 523 files | Activate with autofix | Big diff, but mostly mechanical. Reduces runtime import ambiguity, improves readability, and unlocks `verbatimModuleSyntax`. |
| `@typescript-eslint/no-import-type-side-effects` | 6 errors in 6 files | Activate with or after `consistent-type-imports` | Small, precise cleanup. Prevents inline type specifiers from leaving behind runtime side-effect imports. |
| `@typescript-eslint/prefer-nullish-coalescing` | 224 errors in 110 files | Activate next | Good fit for this codebase's config/default-heavy UI code. Prevents `0`, `""`, and `false` from being treated as missing. |
| `@typescript-eslint/no-unnecessary-condition` | 404 errors in 120 files | Activate next, likely as `warn` first | Catches stale optional chaining, always-truthy checks, and conditionals that stopped making sense after type refactors. |

### TypeScript Compiler Flags

| Flag | Approximate impact | Recommendation | Why it is high ROI |
| --- | ---: | --- | --- |
| `noImplicitReturns` | ~22 diagnostics | Activate now | Very small cleanup for a real correctness gain. Missing return paths are usually bugs, especially in render helpers and callbacks. |
| `exactOptionalPropertyTypes` | ~613 diagnostics | Stage after quick wins | High value for config objects, message payloads, and prop types. Forces a useful distinction between "key omitted" and "key present with `undefined`". |
| `noUncheckedIndexedAccess` | ~998 diagnostics | Pilot in targeted areas first | Strong bug-finder for array access, map lookup, schema-driven data, and protobuf/JSON-style structures. Likely worth it, but too much churn to flip globally first. |

## Oxlint-Specific Recommendations

This branch already runs `oxlint@1.53.0`, but the current command is intentionally minimal:

- it uses the default `correctness` category
- it keeps the default built-in plugins (`oxc`, `typescript`, `unicorn`)
- it does **not** currently enable `--import-plugin`, `--react-plugin`, `--promise-plugin`, `--jsx-a11y-plugin`, `--react-perf-plugin`, `--vitest-plugin`, or `--type-aware`

That means the best oxlint additions are the ones that either:

- add fast, high-signal checks without requiring type-aware mode, or
- let the repo shift obvious mechanical lint work into the faster linter

The probe below used the same source paths as the current frontend `oxlint` script (`app/src`, `component-v2-lib/src`, `connection/src`, `eslint-plugin-streamlit-custom/src`, `lib/src`, `utils/src`).

### Best Oxlint Rules To Add

| Rule | How to enable | Approximate impact | Recommendation | Why it is good specifically for oxlint |
| --- | --- | ---: | --- | --- |
| `typescript/consistent-type-imports` | `-D consistent-type-imports` | 993 diagnostics | Best oxlint candidate overall | Large but mechanical cleanup, fixable, and a good fit for oxlint's fast pass. |
| `typescript/no-import-type-side-effects` | `-D no-import-type-side-effects` | 6 diagnostics | Add with `consistent-type-imports` | Very small cleanup with real value. Catches inline type imports that still leave runtime side-effect imports behind. |
| `import/no-cycle` | `--import-plugin -D no-cycle` | 11 diagnostics | High-value plugin addition | Finds real dependency cycles in source areas like dialogs, render tree code, and theme code. |
| `react/button-has-type` | `--react-plugin -D button-has-type` | 2 diagnostics | Cheap low-hanging fruit | Tiny cleanup, but prevents accidental submit behavior and is easy to keep green. |

### Oxlint Rules I Would Not Prioritize Yet

| Rule | Approximate impact | Why I would defer it in oxlint |
| --- | ---: | --- |
| `typescript/ban-ts-comment` | 175 diagnostics with default behavior | Conflicts with the repo's current policy of allowing `@ts-expect-error`. Good rule in principle, but not a drop-in oxlint win here. |
| `import/no-duplicates` | 0 diagnostics | Safe, but there is no immediate payoff in this tree. |
| `react/no-array-index-key` | 0 diagnostics | Same story: fine rule, but nothing to clean up right now. |
| `promise/no-multiple-resolved` | 0 diagnostics | No current signal. Not worth enabling just to mirror ESLint. |

### Oxlint Rollout Order I Would Recommend

1. Add `-D consistent-type-imports`.
2. Add `-D no-import-type-side-effects`.
3. Enable `--import-plugin -D no-cycle`.
4. Enable `--react-plugin -D button-has-type`.

If oxlint later becomes a type-aware pass, then it becomes more attractive to move some of the existing ESLint work there as well, especially:

- `prefer-nullish-coalescing`
- `switch-exhaustiveness-check`
- `no-misused-promises`
- `only-throw-error`

## Why These Rules Fit This Repo

### `noImplicitReturns`

This is the cheapest immediate win.

Representative failures were functions with a missing branch in:

- styled helper callbacks
- hook callbacks
- render/helper utilities

The probe surfaced only ~22 diagnostics, split mostly across `frontend/app` and `frontend/lib`. This is the kind of rule that catches real mistakes without pushing the team into a large migration.

### `consistent-type-imports`

This is the largest mechanical cleanup, but still high ROI.

The repo has many imports where symbols are only used as types, for example:

- `ReactNode`
- props/interfaces
- protobuf interfaces
- theme/config types

This rule produced 989 findings in ESLint and 993 in oxlint, which sounds large, but the important part is that the fixes are mostly structural and automatable. Enabling it would:

- make type-vs-runtime imports obvious
- reduce accidental runtime imports
- prepare the repo for `verbatimModuleSyntax`
- make large import blocks easier to reason about

I would treat this as a codemod-style change, not as hand cleanup.

### `prefer-nullish-coalescing`

This repo has a lot of fallback logic around config, themes, query params, menu items, and rendering options. `||` is often correct there, but it is also a common source of subtle bugs when `false`, `0`, or `""` are legitimate values.

The probe surfaced 224 issues across 110 files. That is large enough to matter, but small enough to clean up intentionally. This looks like a good "real correctness improvement" rule, not just style.

### `no-unnecessary-condition`

This caught:

- unnecessary optional chaining on non-nullish values
- always-truthy conditionals
- dead `??` fallbacks

The probe surfaced 404 findings across 120 files. That is not cheap, but it is still attractive because the rule finds stale logic after types get tightened. It should likely start as `warn` to avoid a huge one-shot cleanup.

### `exactOptionalPropertyTypes`

This is the most interesting TS flag from a correctness perspective.

Representative failures were exactly the kinds of bugs it is meant to catch:

- building objects with `foo: maybeUndefined` and passing them to types where `foo?` really means "omit the key"
- React state updates that accidentally assign `undefined` to fields that are nullable but not undefined-able
- config payloads and message shapes where absence and `undefined` currently get conflated

This matters in Streamlit because the frontend has many config/message objects crossing package boundaries. Tightening this would improve API contracts, but it should be staged because the current cleanup surface is substantial.

### `noUncheckedIndexedAccess`

This would be valuable in a codebase with:

- dataframe/grid logic
- schema-driven rendering
- array-heavy UI code
- dynamic protobuf/JSON payload handling

The probe surfaced ~998 diagnostics. That is too much for an immediate global flip, but the bug-finding value is real. This is a good candidate for a phased rollout in the most failure-prone areas first, especially `DataFrame`, charting, and connection/message parsing code.

## Activation Order I Would Recommend

1. Enable `noImplicitReturns`.
2. Enable `@typescript-eslint/consistent-type-exports`.
3. Run autofix and enable `@typescript-eslint/consistent-type-imports`.
4. Enable `@typescript-eslint/no-import-type-side-effects`.
5. Enable `@typescript-eslint/prefer-nullish-coalescing`.
6. Enable `@typescript-eslint/no-unnecessary-condition` as `warn`, then raise to `error` after cleanup.
7. Pilot `exactOptionalPropertyTypes` in a narrower scope, then expand.
8. Pilot `noUncheckedIndexedAccess` in high-risk subsystems instead of flipping it globally first.

## Rules I Would Not Prioritize Yet

| Rule / Flag | Probe result | Why I would defer it |
| --- | ---: | --- |
| `@typescript-eslint/strict-boolean-expressions` | 842 errors in 233 files, even with relaxed options | Too much style churn relative to immediate payoff. It will fight existing nullable-string and nullable-boolean patterns everywhere. |
| `react/jsx-no-leaked-render` | 115 errors in 62 files | Reasonable React-specific rule, but noisier than the top-tier candidates and overlapping with broader boolean/nullish cleanup. I would revisit it after `prefer-nullish-coalescing` and `no-unnecessary-condition`. |
| `verbatimModuleSyntax` | ~1662 diagnostics | Good end state, but most of the work is a follow-on from `consistent-type-imports`. Turn that on first. |
| `noPropertyAccessFromIndexSignature` | ~256 diagnostics | Some value, but many failures are on intentionally dynamic objects such as theme tokens, chart specs, `process.env`, and schema-ish payloads. |
| `@typescript-eslint/require-array-sort-compare` | 2 errors, both in tests | Valid rule, but too small a win to rank highly for this codebase right now. |
| `@typescript-eslint/no-unsafe-*` family | Not measured here, but already explicitly disabled in config | The repo still has significant `any` debt. Turning these on now would create a large suppression campaign rather than focused bug fixing. |
| `noUnusedLocals` / `noUnusedParameters` | Not measured | Low incremental value because ESLint already handles unused variables with more control and better ergonomics. |

## Practical Rollout Notes

- `consistent-type-imports` should be done as a dedicated mechanical PR.
- `no-import-type-side-effects` fits naturally in the same PR or immediately after it.
- `noImplicitReturns` is small enough to bundle with another frontend-maintenance PR.
- `prefer-nullish-coalescing` and `no-unnecessary-condition` are good follow-up cleanup PRs because they require human judgment in places.
- `exactOptionalPropertyTypes` is probably best introduced bottom-up:
  - first for shared/public types or the smallest package
  - then for config/message layers
  - then for the broader UI tree
- `noUncheckedIndexedAccess` should probably start in packages where undefined lookups are most expensive:
  - dataframe/grid code
  - connection/message parsing
  - theme/config lookup helpers

## Bottom Line

If the goal is maximum benefit for reasonable migration cost, I would do this:

- immediate: `noImplicitReturns`, `consistent-type-exports`
- mechanical next: `consistent-type-imports`, `no-import-type-side-effects`
- correctness next: `prefer-nullish-coalescing`, `no-unnecessary-condition`
- staged TS tightening: `exactOptionalPropertyTypes`, then `noUncheckedIndexedAccess`
- oxlint-specific next wins: `consistent-type-imports`, `no-import-type-side-effects`, `import/no-cycle`

If the goal is a single strongest "bang for buck" compiler flag, it is `noImplicitReturns`.
If the goal is the single best lint cleanup that unlocks future strictness, it is `consistent-type-imports`.
