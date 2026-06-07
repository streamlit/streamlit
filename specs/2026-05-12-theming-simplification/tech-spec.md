---
author: mbarnes
created: 2026-05-12
---

# Theming simplification post-BaseWeb removal

## Summary

Streamlit's theming model carries substantial complexity that exists solely to support the
BaseWeb (`baseui`) component library: a 259-line token-mapping layer, a parallel theme
structure (`ThemeConfig.basewebTheme` / `.primitives`), and dual React providers
(`BaseProvider` + `BaseUIThemeProvider`) that must be synchronized on every theme change.
This spec defines a phased approach to removing that complexity after the
[BaseWeb → React Aria migration](../.cursor/plans/baseweb_%E2%86%92_react_aria_roadmap_68ccf52c.plan.md)
is complete, and evaluates a longer-term move to CSS Custom Properties as the single
theming mechanism.

## Problem

### Current architecture (as of May 2026)

Streamlit's frontend theming has three parallel layers kept in sync:

**Layer 1 — Emotion design tokens (`EmotionTheme`):**
The Streamlit source of truth. Built from `emotionBaseTheme` / `emotionLightTheme` /
`emotionDarkTheme` which compose primitives (`colors`, `spacing`, `radii`, `typography`,
`shadows`, …). Consumed everywhere via `useEmotionTheme()`.

**Layer 2 — BaseUI theme (`ThemeConfig.basewebTheme`):**
A parallel 200+ property JSON object created by `createBaseUiTheme(emotionTheme)` that
maps Streamlit Emotion tokens to BaseWeb's format (primitives → overrides). Exists solely
to feed BaseWeb components. Never accessed outside of BaseWeb-related code.

**Layer 3 — BaseUI primitives (`ThemeConfig.primitives`):**
`lightThemePrimitives` / `darkThemePrimitives` from the `baseui` package, used as the
starting point when generating Layer 2. Required because `createBaseUiTheme` takes them
as a parameter; meaningless after BaseWeb is gone.

**Provider stack (simplified):**

```
<BaseProvider theme={themeConfig.basewebTheme}>       ← Layer 2, BaseWeb only
  <CacheProvider value={emotionCache}>
    <EmotionThemeProvider theme={themeConfig.emotion}> ← Layer 1, Streamlit theme
      <app />
    </EmotionThemeProvider>
  </CacheProvider>
</BaseProvider>
```

For sidebar theming, `ThemeProvider` adds a *second* pair of providers:

```
<BaseUIThemeProvider theme={baseuiTheme}>   ← BaseWeb sub-theme for sidebar
  <EmotionThemeProvider theme={emotionTheme}>
    {children}
  </EmotionThemeProvider>
</BaseUIThemeProvider>
```

### Specific pain points

| Pain point | Root cause | Bytes / complexity |
|---|---|---|
| `createBaseUiTheme.ts` | Maps ~50 Streamlit tokens → BaseWeb format | 259 lines |
| `baseui.ts` | Creates `baseuiLightTheme` / `baseuiDarkTheme` | 35 lines |
| `ThemeConfig.basewebTheme` | Carries BaseWeb theme in every `ThemeConfig` | Increases struct size |
| `ThemeConfig.primitives` | Carries BaseWeb `lightThemePrimitives` ref | Unnecessary coupling |
| `BaseProvider` in `RootStyleProvider` | BaseWeb root context + z-index injection | Extra React tree node |
| `BaseUIThemeProvider` in `ThemeProvider` | BaseWeb sub-theming for sidebar | Extra React tree node |
| `EmotionTheme.inSidebar` | Color-swap flag used *only* in `createBaseUiThemeOverrides` to fix `menuFill` | Conceptually wrong abstraction |

The `inSidebar` flag is particularly notable: its only consumer is the BaseWeb theme
creator, which must "unswap" `bgColor`/`secondaryBg` because BaseWeb's menu components
read from a fixed color slot (`menuFill`). Post-BaseWeb, React Aria components read
directly from Emotion theme tokens — there is no such fixed color slot to work around.

### Relationship to the BaseWeb → React Aria roadmap

The BaseWeb migration plan ends at **Phase 4.7** (remove BaseWeb theme infrastructure
and the `baseui` package). This spec covers *what* that phase should do and *what comes
after it*:

- **Phase 4.7 (immediate scope):** Surgical deletion of all BaseWeb-specific theming code.
  Component styling already uses Emotion exclusively; this is cleanup only.
- **Post-4.7 simplification:** Clean up `EmotionTheme` of BaseWeb-era artefacts (`inSidebar`,
  now-unnecessary derived colors, over-specified color naming).
- **CSS Custom Properties (longer-term):** Replace Emotion runtime token injection with
  CSS variables at the `:root`, enabling instant theme switching, better SSR, and
  a cleaner path for user-defined theming.

## Proposal

### Phase A — Phase 4.7: Delete BaseWeb theme infrastructure

*Prerequisite: all Phase 1–4.6 PRs are merged.*

**Files to delete:**
- `frontend/lib/src/theme/createBaseUiTheme.ts`
- `frontend/lib/src/theme/baseui.ts`

**Files to simplify:**

`frontend/lib/src/theme/types.ts` — remove BaseWeb fields from `ThemeConfig`:

```typescript
// Before
export type ThemeConfig = {
  name: string
  displayName?: string
  emotion: EmotionTheme
  basewebTheme: typeof baseuiLightTheme   // ← DELETE
  primitives: typeof lightThemePrimitives  // ← DELETE
  themeInput?: Partial<CustomThemeConfig>
}

// After
export type ThemeConfig = {
  name: string
  displayName?: string
  emotion: EmotionTheme
  themeInput?: Partial<CustomThemeConfig>
}
```

`frontend/lib/src/theme/themeConfigs.ts` — remove `basewebTheme` and `primitives` from
all four theme config objects (`baseTheme`, `lightTheme`, `darkTheme`, `customTheme`).

`frontend/lib/src/RootStyleProvider.tsx` — replace `BaseProvider` with React Aria
`I18nProvider` (locale only; needed for React Aria date/number fields):

```typescript
// Before
import { BaseProvider } from "baseui"

<BaseProvider theme={theme.basewebTheme} zIndex={theme.emotion.zIndices.popup}>
  <CacheProvider value={cache}>
    <EmotionThemeProvider theme={theme.emotion}>
      <Global styles={globalStyles} />
      {children}
    </EmotionThemeProvider>
  </CacheProvider>
</BaseProvider>

// After
import { I18nProvider } from "react-aria-components"

<I18nProvider locale={navigator.language}>
  <CacheProvider value={cache}>
    <EmotionThemeProvider theme={theme.emotion}>
      <Global styles={globalStyles} />
      {children}
    </EmotionThemeProvider>
  </CacheProvider>
</I18nProvider>
```

`frontend/lib/src/components/core/ThemeProvider.tsx` — remove `BaseUIThemeProvider`:

```typescript
// Before
import { ThemeProvider as BaseUIThemeProvider } from "baseui"

<BaseUIThemeProvider theme={baseuiTheme || baseuiLightTheme}>
  <EmotionThemeProvider theme={theme}>{children}</EmotionThemeProvider>
</BaseUIThemeProvider>

// After
function ThemeProvider({ theme, children }: ThemeProviderProps): ReactElement {
  return (
    <EmotionThemeProvider theme={theme}>{children}</EmotionThemeProvider>
  )
}
```

**Impact:** `baseui` can be removed from `package.json`. All `from "baseui"` imports
disappear. `ThemeConfig` is a simpler, purer type.

### Phase B — Post-4.7: Clean up `EmotionTheme`

*Can be done in parallel with or immediately after Phase A.*

**Remove `inSidebar` from `EmotionTheme`:**

The flag is currently set via `getSidebarTheme()` / `getEmbeddedTheme()` and consumed
only by `createBaseUiThemeOverrides` (now deleted). Post-Phase A, the flag exists but is
never read. Components that need to know they are in the sidebar (e.g. to pick the correct
background color for a floating menu) should read `theme.colors.bgColor` directly — the
sidebar's Emotion theme already has `bgColor`/`secondaryBg` swapped correctly.

> **Before removal:** confirm by grepping for `inSidebar` in `frontend/` — any consumer
> that isn't `createBaseUiThemeOverrides` needs a migration path first.

**Audit `DerivedColors` and `SpecialEmotionColors`:**

Several properties in these types were created primarily to feed BaseWeb's override
mappings. With direct Emotion consumption:

- `fadedText05` / `fadedText10` / `fadedText20` / `fadedText40` / `fadedText60` — check
  if all five opacity variants are still used by Emotion styled-components, or whether
  some were only ever used in BaseWeb overrides.
- `bgMix` / `darkenedBgMix100` / `darkenedBgMix25` / `darkenedBgMix15` / `lightenedBg05`
  — audit usage; remove any that are only referenced inside the now-deleted BaseWeb files.

**Normalize `EmotionThemeColors` naming:**

Over time the color map has grown inconsistent names (some camelCase descriptive, some
one-to-one with BaseWeb token names like `calendarDayForegroundSelected`). Post-BaseWeb
there is an opportunity to consolidate to a cleaner, semantic token set. This is a
non-breaking internal refactor but should be done in a single PR so diffs are clear.

### Phase C — CSS Custom Properties (strategic, requires alignment)

*Prerequisite: Phase B complete. Requires design + team buy-in before starting.*

#### Motivation

The Emotion runtime approach has three limitations that become more visible as Streamlit
scales:

1. **Theme switching cost:** Changing themes triggers a full React re-render cascade
   because `EmotionThemeProvider` is a context whose value changes. With CSS variables,
   switching themes is a single DOM attribute flip (`data-theme="dark"`), zero re-renders.
2. **Custom theming friction:** Users can currently only theme via `config.toml [theme]`
   (coarse, server-side) or `st.context.theme` (read-only). CSS variables would allow
   users / embedding pages to override tokens with a stylesheet.
3. **SSR / partial hydration:** Emotion requires runtime JS; CSS variables work at
   paint-time without any JS.

#### Proposed architecture

Emit all design tokens as CSS Custom Properties on `:root` (and `[data-theme="dark"]`)
at app startup, controlled by a single hook/provider:

```css
/* :root (light) */
:root {
  --st-color-primary: #ff4b4b;
  --st-color-bg: #ffffff;
  --st-color-secondary-bg: #f0f2f6;
  --st-color-body-text: #31333f;
  --st-spacing-sm: 0.25rem;
  --st-spacing-md: 0.5rem;
  --st-radius-default: 0.5rem;
  /* … */
}

[data-theme="dark"] {
  --st-color-bg: #0e1117;
  --st-color-secondary-bg: #262730;
  --st-color-body-text: #fafafa;
  /* … */
}
```

Streamlit-styled components use `var(--st-color-primary)` instead of
`${theme.colors.primary}`. `useEmotionTheme()` is retained as a TypeScript-typed
convenience accessor that reads from the computed CSS variable values, so existing
component code requires no mass refactor.

#### Migration options

**Option 1: CSS variables as primary, Emotion as read-through accessor** ✅ PREFERRED
- CSS variables are the single source of truth
- `useEmotionTheme()` returns an object backed by `getComputedStyle(document.root)`
  values (lazy, memoized)
- Pros: immediate theme-switch performance, easy custom theming, no breaking change
- Cons: `getComputedStyle` calls add minor complexity; CSS-in-JS styles that compute
  from theme tokens (e.g. `transparentize(theme.colors.primary, 0.5)`) need
  `color-mix()` or JS-side computation at emit time, not at style-apply time

**Option 2: CSS variables emitted alongside Emotion (dual write)**
- Keep Emotion as primary; also emit matching CSS variables for external use
- Pros: zero risk, backwards compatible, unlocks embedding use case
- Cons: two systems to maintain; theme-switch performance not improved

**Option 3: Emotion only (status quo post-Phase B)**
- No CSS variables; just keep the cleaned-up Emotion theme
- Pros: no migration risk or complexity
- Cons: misses performance and extensibility gains

**Recommendation:** Decide Option 1 vs 3 based on roadmap priority. Option 2 is a
reasonable intermediate step if Option 1 is deferred.

#### Custom theming API consideration

Currently `CustomThemeConfig` (sent via protobuf) exposes:
`primary_color`, `secondary_background_color`, `background_color`, `text_color`,
`base` (light/dark), `heading_font`, `body_font`, `code_font`, `base_radius`, `button_radius`.

With CSS variables, a future `st.set_theme()` / `[theme]` config expansion becomes
straightforward: send a key-value map from backend → frontend; frontend sets
`document.root.style.setProperty()` for each override. No custom token-generation
logic needed.

## Alternatives considered

### Skip Phase B entirely

Just delete BaseWeb files (Phase A) and leave `EmotionTheme` as-is.

**Rejected:** `inSidebar` becomes dead code that will confuse future contributors.
`DerivedColors` may have unused properties. The naming inconsistency will compound. Phase B
is low-risk and high-value internal hygiene.

### Migrate to CSS variables before completing the BaseWeb migration

Emit CSS variables now and convert component styling in parallel with the BaseWeb migration.

**Rejected:** Too many moving parts at once. The BaseWeb migration already changes every
component's styling surface. Layering a CSS variable migration on top increases merge
conflict risk and test complexity. Phase C should start only after the component library
stabilizes post-Phase A.

### Replace Emotion with Tailwind CSS or vanilla-extract

Eliminates the Emotion runtime entirely.

**Rejected:** Too large a scope for this spec; requires complete re-styling of all
components. Tailwind brings utility-class markup inflation; vanilla-extract requires a
build step that complicates the component-lib package. Emotion `@emotion/styled` is
mature, works well with our TypeScript patterns, and remains the right choice for now.

## Work breakdown

| Phase | Description | Prereq | Estimated size |
|---|---|---|---|
| A | Delete BaseWeb theme files, simplify providers | All Phase 1–4.6 PRs merged | 1 PR, ~1 day |
| B.1 | Remove `inSidebar` from `EmotionTheme` (after confirming no other consumers) | Phase A | 1 PR, ~0.5 day |
| B.2 | Audit and prune `DerivedColors` / `SpecialEmotionColors` unused properties | Phase A | 1 PR, ~1 day |
| B.3 | Normalize `EmotionThemeColors` naming (optional, requires snapshot rebaseline) | Phase B.2 | 1 PR, ~2 days |
| C.1 | Design token audit: define the official CSS variable token set | Phase B | Doc/design, ~1 week |
| C.2 | Emit CSS variables at app root, keep Emotion as read-through | Phase C.1 | 1–2 PRs, ~1 week |
| C.3 | Migrate component `useEmotionTheme()` consumers to CSS variables (optional) | Phase C.2 | N PRs, ongoing |

## Out of scope

- Changes to the `CustomThemeConfig` proto structure or `config.toml [theme]` API (user-facing)
- `st.context.theme` improvements (tracked separately)
- Dark mode improvements or new built-in themes
- Sidebar theming behavior changes (Phase B removes the BaseWeb workaround but does not change how sidebar theming _works_)
- Component-v2 custom theming (tracked separately)

## Checklist

| Item | Status |
|---|---|
| No user-facing API changes in Phase A or B | ✅ internal only |
| Phase A blocks on Phase 4.7 (last baseui PR) | ✅ explicitly sequenced |
| `I18nProvider` locale: `navigator.language` vs app-level locale | TBD — check if React Aria calendar/number formatting needs explicit locale from backend |
| Verify `inSidebar` consumers before deletion | TBD — grep required in Phase B.1 |
| E2E snapshots: rebaseline after Phase A (provider changes may shift border-radius, z-index) | Required |
| Phase C option (1 vs 3) needs team alignment | Requires design/roadmap discussion |
