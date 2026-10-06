# Streamlit WCAG theme & shell chrome inventory

Last updated: 2026-10-06. Re-audit when default theme tokens, focus-ring derivation, or library icon hit targets change.

This page is the **theme & shell chrome** inventory. For per-command `st.*` tables, see the [command inventory](accessibility-wcag.md).

How Streamlit’s **default** light and dark themes enable or block selected **WCAG 2.2 Level AA** criteria for color contrast and control size. Conformance applies to the **app**, not the library — this page is not a claim that Streamlit itself is conformant.

**How to use this page**

| Section | Use it when you need… |
| ------- | --------------------- |
| [Default theme floors](#default-theme-floors) | AA gates for any default palette Streamlit ships (current or next) |
| [Known library gaps](#known-library-gaps) | What fails today and is a candidate fix / raise-default |
| [Current defaults](#current-defaults) | Measured light/dark pass/fail for today’s `develop` theme |
| [Theme config notes](#theme-config-notes) | Non-obvious `theme.*` defaults (dataframe, `showWidgetBorder`) and what this page does **not** score |

Public config keys live in `lib/streamlit/config.py` (`theme`, `theme.light` / `theme.dark`, sidebar sections). This inventory scores **roles** (how color is used), not every key as its own row.

## What we are scoring

Score the criteria below for **default** light and dark only. Do not score AAA. This is not a full shell audit — for example 1.4.4, 1.4.10, 1.4.12, 2.4.1, 2.4.2, full focus *behavior* (2.4.7 / 2.4.11), 3.1.1, and app-shell 4.1.3 were not evaluated here. Command-level gaps stay on the [command inventory](accessibility-wcag.md).

In each scorecard table, rows are ordered **Library blocks** first, then **Library meets**. Light and dark are scored in separate columns when they differ.

| Criterion | Level | Threshold used here |
| --------- | ----- | ------------------- |
| **1.4.3 Contrast (Minimum)** | AA | Normal text ≥ 4.5:1 vs adjacent background |
| **1.4.11 Non-text Contrast** | AA | UI components / graphical objects needed to identify controls ≥ 3:1 |
| **2.5.8 Target Size (Minimum)** | AA | Pointer targets ≥ 24×24 CSS px (or a documented exception) |

| Bucket | Meaning |
| ------ | ------- |
| **Library blocks** | The shipped default fails this criterion. Public `theme.*` overrides can change it, but this page still counts a failing default as a library gap: a candidate for a token or chrome fix, or a later product spec. |
| **Author must** | The author controls the value (`theme.primaryColor`, chart mark colors, and similar). Defaults are still scored on this page until overridden. |
| **Library meets** | Default light and dark already meet the ratio or size for that row. |
| **Not this surface** | Host chrome (Community Cloud toolbar), OS, or author plot pixels — do not open a Streamlit theme spec. |

Composite each transparent token onto the background it is drawn on, then measure that opaque pair with `color2k`'s `getContrast` (same derivation as `getColors.ts`). Recompute these ratios from the tokens whenever the palette changes.

## Default theme floors

AA floors for **any** default light/dark palette Streamlit ships. Soft or derived colors (`transparentize`, `fadedText*`, and similar) must meet the floor **after** derivation on the surfaces below.

**2.5.8** is chrome sizing, not a color floor — see [2.5.8](#258-target-size-minimum).

Names mix public config keys (`textColor`, `primaryColor`) and internal tokens (`bodyText`, `fadedText60`) when both refer to the same role. `bgMix` is `mix(backgroundColor, secondaryBackgroundColor, 0.5)` from `computeDerivedColors` — not a public config key.

| Role | Typical tokens / config | Criterion | Floor | Required surfaces |
| ---- | ----------------------- | --------- | ----- | ----------------- |
| Body text | `textColor` / `bodyText` | 1.4.3 | ≥ 4.5:1 | Page, secondary / sidebar |
| Secondary / muted UI text | `fadedText60`, `grayTextColor`, placeholders, counters, hints; default `dataframeHeaderTextColor` | 1.4.3 | ≥ 4.5:1 | Page, secondary / sidebar, `bgMix`, dataframe header |
| Link text | `linkColor` / `blueTextColor` | 1.4.3 | ≥ 4.5:1 | Page, secondary / sidebar |
| Code text on code fill | `codeTextColor` on `codeBackgroundColor` | 1.4.3 | ≥ 4.5:1 | Code background |
| Status text on status fill | Shipped `*TextColor` on `*BackgroundColor`; `primary` on `primarybg` | 1.4.3 | ≥ 4.5:1 | Alert fills, markdown badges, metric deltas |
| Label on primary fill | `white` (or equivalent) on `primaryColor` | 1.4.3 | ≥ 4.5:1 | Primary buttons and other primary-filled controls |
| Primary as **text** | `primaryColor` used for copy | 1.4.3 | ≥ 4.5:1 | Page (and any surface where primary is used as text) |
| Primary as **control** | `primaryColor` fill / outline | 1.4.11 | ≥ 3:1 | Page **and** default sidebar (`secondaryBackgroundColor` when sidebar bg is unset) |
| Control border | `borderColor`; checkbox/radio indicator stroke | 1.4.11 | ≥ 3:1 | Defining strokes that use the border token (see [Theme config notes](#theme-config-notes)) |
| Focus indicator | Soft or solid focus ring when it is the sole indicator | 1.4.11 | ≥ 3:1 | Adjacent background |
| Icon stroke (library chrome) | Often muted / derived paint | 1.4.11 | ≥ 3:1 | Header, toolbar, link/help icons |

Opaque `darkenedBgMix100` measures ≈ 2.2–2.5:1 on the light page, which is below the 3:1 icon floor. Shell code currently uses it only in translucent mixes (for example, dataframe hover), never as an icon stroke.

Surfaces for pairings: `backgroundColor` (page), `secondaryBackgroundColor` (secondary / default sidebar / many widgets), and role-specific fills (code, status, dataframe header `bgMix` when unset).

## Known library gaps

Sorted by criterion number. Each item is a candidate product-spec section or raise-default fix. Prefer raising defaults over new color APIs (recommendation of this inventory, not a closed product decision).

### Level AA

- **1.4.3 Light-theme secondary text is below 4.5:1.** `fadedText60` / `grayTextColor` / default dataframe header text measure ≈ 3.5–3.7:1 on default light page, secondary, and mixed backgrounds. Shared by placeholders, file-uploader hints, character counts, tabs, and similar (seeds [#8249](https://github.com/streamlit/streamlit/issues/8249), [#8276](https://github.com/streamlit/streamlit/issues/8276), [#8288](https://github.com/streamlit/streamlit/issues/8288), [#8289](https://github.com/streamlit/streamlit/issues/8289)). Dark-theme muted text **meets** 1.4.3.
- **1.4.3 Orange, gray, green, and primary status text fail on status fill.** Orange ≈ 3.19:1 (light); gray text on its own fill ≈ 3.3–3.5:1 (light); green ≈ 4.496:1 (just under 4.5:1, light); primary on `primarybg` ≈ 2.92:1 (light) and ≈ 3.05–3.85:1 (dark page/sidebar) — fails **1.4.3** in both themes. Call sites: markdown badges (`:orange-badge` / `:gray-badge` / `:green-badge` / `:primary-badge` and siblings), metric deltas (`getMetricTextColor` / `getMetricBackgroundColor`, including gray for empty / `delta_color="off"` and `color="primary"`), and `AlertContainer` success (`st.success` → green). `AlertContainer` itself maps only error/warning/info/success → red/yellow/blue/green — not orange/gray/primary. Red / yellow / blue / violet light pairings meet 4.5:1; other measured dark non-primary status pairings meet 4.5:1.
- **1.4.3 White label on primary fill fails in both themes** (`StyledPrimaryButton`: white on `#ff4b4b` ≈ 3.30:1 at normal text size).
- **1.4.3 Light `primary` is below 4.5:1 when used as text** on the page background (≈ 3.30:1). Separate from primary-on-`primarybg` status fills above (dark page text still passes ≈ 5.7:1).
- **1.4.11 Light primary chrome on the default sidebar fails 3:1.** Sidebar background defaults to `secondaryBackgroundColor` (`#f0f2f6`); `#ff4b4b` on that surface ≈ 2.95:1. Primary on the main page background still meets 1.4.11 (≈ 3.30:1). Dark sidebar passes (≈ 4.49:1).
- **1.4.11 Control borders use `borderColor` (≈ `fadedText10`) below 3:1** on light and dark (≈ 1.4–1.9:1). Affects unchecked checkbox/radio indicator strokes and other chrome that always uses `borderColor`. With default `showWidgetBorder` off, many input outlines do not use that token (see [Theme config notes](#theme-config-notes)). Unset `dataframeBorderColor` is a separate, even fainter token (`fadedText05`) — raising `borderColor` alone does not clear default dataframe gridlines.
- **1.4.11 Default soft focus rings fail 3:1.** Soft `focusRing` / `focusRingMuted` measure ≈ 1.5–2.2:1. Solid `focusRingOutline` (`primary`) meets 1.4.11 on the page (sidebar primary chrome is the 1.4.11 gap above). Full focus *behavior* (2.4.7 / 2.4.11) is not scored here.
- **2.5.8 Heading link icon and default help tooltip triggers are ~16×16 CSS px** (`iconSizes.base`, no 24px minimum hit box). Scored by CSS box size; the 2.5.8 spacing and inline exceptions are **not** applied here (heading link + help sit `spacing.sm` / 8px apart, so 24px circles centered on each box meet). Main-menu trigger and sidebar expand/collapse meet at the default 16px root; element toolbar actions (`max(1.5rem, 24px)`, [#17211](https://github.com/streamlit/streamlit/pull/17211)) meet 2.5.8.
- **2.5.8 Collapsed checkbox label leaves a 16×16 indicator** (`sizes.checkbox` = 1rem). Default visible checkbox/radio labels meet the 24px floor (see scorecard).

## Current defaults

Live scorecard for today’s default light and dark themes. Floors above are the gate; these tables are measured results.

### 1.4.3 Contrast (Minimum)

| Role | Light | Dark | Bucket | Note |
| ---- | ----- | ---- | ------ | ---- |
| Secondary / muted UI text (`fadedText60`, `grayTextColor`, dataframe header) | Fail (~3.5–3.7) | Pass (~6.1–7.0) | Library blocks | Light only; includes default `dataframeHeaderTextColor` |
| White label on primary fill | Fail (~3.30) | Fail (~3.30) | Library blocks | `StyledPrimaryButton` and similar |
| `primary` as **text** on page | Fail (~3.30) | Pass (~5.7) | Library blocks | Light only; not the same as primary-on-`primarybg` |
| Status text on status fill (badges, metrics, alerts) | Orange/gray/green/primary fail; red/yellow/blue/violet pass | Primary fail (~3.05–3.85); others measured pass | Library blocks | `:primary-badge` / metric `color="primary"` → `primary` on `primarybg`; orange/gray → badges & metrics; green → `st.success` + positive metric (~4.496:1) |
| Body text on page / secondary | Pass (~12.5 / 11.2) | Pass (~18.1 / 14.2) | Library meets | |
| Link text | Pass (~6.7–7.5) | Pass (~5.2–6.6) | Library meets | Markdown / in-app links |
| Code text on code fill | Pass (~4.7) | Pass (~10.5) | Library meets | |

#### Disabled styling

`fadedText40` measures ~2.2:1 (light) and ~3.7:1 (dark). 1.4.3 exempts inactive (disabled) components, so this is not a Library blocks row. It is recorded so enabled UI that reuses `fadedText40` still gets caught.

### 1.4.11 Non-text Contrast

| Role | Light | Dark | Bucket | Note |
| ---- | ----- | ---- | ------ | ---- |
| Control border (`borderColor`) | Fail (~1.45) | Fail (~1.8) | Library blocks | Includes unchecked checkbox/radio indicator strokes; many inputs only when `showWidgetBorder` is on |
| Soft focus ring (`focusRing`) | Fail (~1.9) | Fail (~2.2) | Library blocks | Sole focus indicator on many controls |
| Soft muted focus ring (`focusRingMuted`) | Fail (~1.5) | Fail (~1.8) | Library blocks | Header icon buttons |
| Primary as control on default sidebar | Fail (~2.95) | Pass (~4.49) | Library blocks | Sidebar bg defaults to `secondaryBackgroundColor` |
| Muted icon stroke (`fadedText60`) | Pass (~3.6–3.7) | Pass (~6.1–7.0) | Library meets | [#16149](https://github.com/streamlit/streamlit/issues/16149) is **not** a default 1.4.11 fail for this token |
| Primary as control / solid focus outline on page | Pass (~3.30) | Pass (~5.7) | Library meets | Page background only |

### 2.5.8 Target Size (Minimum)

Accessible names for icon-only controls were largely addressed in [#17170](https://github.com/streamlit/streamlit/pull/17170). This section is **hit target size** only (glyph contrast is under 1.4.11). Unless noted, sizes assume the default 16px root (`theme.baseFontSize` unset).

Rows score the **CSS box** of the interactive control. This inventory does **not** apply the 2.5.8 spacing or inline exceptions (an undersized target can still pass those exceptions in WCAG; heading link + help are adjacent at 8px gap, so they would not clear the spacing exception anyway).

Label sizing note: `StreamlitMarkdown` `isLabel` sets the container to `fontSizes.sm` (14px), but `globalStyles` keeps `p { font-size: 1rem }`, so a default visible label paragraph stays 16px. Checkbox `StyledContent` uses line-height 1.5 → 24px line box; radio inherits body line-height 1.6 → ~25.6px.

| Control | Hit target | Bucket | Note |
| ------- | ---------- | ------ | ---- |
| Heading link icon | ~16×16 (`iconSizes.base`), no min box | Library blocks | Adjacent to heading help at `spacing.sm` |
| Default help / tooltip trigger | ~16×16, no padding | Library blocks | Heading help and typical widget help |
| Checkbox with collapsed label | 16×16 indicator (`sizes.checkbox`) | Library blocks | `LabelVisibility.Collapsed` hides the label; only the indicator remains |
| Checkbox with visible label | Line box 24px (`1rem` × line-height 1.5) | Library meets | Field `minHeight` is `smallElementHeight` (1.5rem); indicator border contrast is 1.4.11 |
| Radio option with visible label | Line box ~25.6px (`1rem` × line-height 1.6) | Library meets | Group `minElementHeight` (~40px) is not the per-option target; indicator border contrast is 1.4.11 |
| Main menu trigger | `headerItemHeight` 1.75rem (= 28px at 16px root) | Library meets | No `24px` CSS floor; smaller custom `theme.baseFontSize` (below 14) makes this Author must |
| Sidebar expand / collapse | Same `headerItemHeight` sizing | Library meets | Same root-font caveat; not every app-header control |
| Element toolbar actions | `max(1.5rem, 24px)` | Library meets | [#17211](https://github.com/streamlit/streamlit/pull/17211) |

## Theme config notes

Core color keys (`primaryColor`, `textColor`, `linkColor`, `borderColor`, status `*Color` / `*TextColor` / `*BackgroundColor`, code colors, backgrounds) map directly to the [floors](#default-theme-floors) and [scorecards](#current-defaults) above. Only the quirks below need extra explanation.

### Dataframe header and border

When unset:

- `dataframeHeaderTextColor` → faded `textColor` (`fadedText60`) — same light **1.4.3** muted-text Library blocks gap
- `dataframeHeaderBackgroundColor` → `bgMix` (`mix(backgroundColor, secondaryBackgroundColor, 0.5)`)
- `dataframeBorderColor` → `fadedText05` (body text at 10% opacity, ≈ 1.20:1 on the page) — **not** `borderColor` (`fadedText10`, ≈ 1.45:1). Dataframe/table borders use that fainter token by default. They switch to `transparentize(borderColor, 0.55)` only when the author sets `theme.borderColor` (`createEmotionTheme`). Raising the default `borderColor` alone does **not** clear default dataframe gridlines.

Raising muted text (or shipping a stronger default header text color) clears the header text gap together with placeholders and related chrome.

### `showWidgetBorder`

Default is **off** (`widgetBorderColor` unset). Many inputs then outline with `secondaryBackgroundColor` or transparent instead of `borderColor`, so the weak default border is **not** the defining edge for those widgets.

Checkbox/radio **indicator** strokes and other chrome that always use `borderColor` still fail **1.4.11**. Turning `showWidgetBorder` on paints those inputs with `borderColor` — authors who enable it inherit the same sub-3:1 border unless they also raise `borderColor`.

`showSidebarBorder` only toggles the sidebar separator; it was not measured as its own row (separator uses border-family paint when shown).

### Author must / out of scope on this page

- **Author must** — custom `theme.*` overrides (including `theme.baseFontSize` that shrinks rem-based header hit targets below 24px); chart mark palettes (`chartCategoricalColors`, `chartSequentialColors`, `chartDivergingColors`). Chart encodings are also covered in the [command inventory](accessibility-wcag.md).
- **Not this surface** — host chrome such as the Community Cloud toolbar.
- **Not scored here** — fonts / `fontFaces` / sizes / weights (later shell pass, e.g. 1.4.4); radii (`baseRadius`, `buttonRadius`); `theme.base` inheritance paths (audit resolved defaults, not every override file).
