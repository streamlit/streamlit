# Streamlit WCAG theme & shell chrome inventory

Last updated: 2026-10-06. Re-audit when default theme tokens, focus-ring derivation, or library icon hit targets change.

This page is the **theme & shell chrome** inventory. For per-command `st.*` tables, see the [command inventory](accessibility-wcag.md).

This inventory records how Streamlit’s **default** light and dark themes enable or block selected **WCAG 2.2 Level AA** criteria for color contrast and control size. *Shell chrome* means library-rendered UI around and inside elements (app header, sidebar toggle, element toolbars, focus rings, help icons), as opposed to content the author supplies. Conformance applies to the **app**, not the library — this page is not a claim that Streamlit itself is conformant.

**How to use this page**

| Section | Use it when you need… |
| ------- | --------------------- |
| [Default theme floors](#default-theme-floors) | Minimum ratios any shipped default palette must meet |
| [Known library gaps](#known-library-gaps) | What fails today and is a candidate fix / raise-default |
| [Current defaults](#current-defaults) | Measured light/dark pass/fail for today’s `develop` theme |
| [Theme config notes](#theme-config-notes) | Non-obvious `theme.*` defaults (dataframe, `showWidgetBorder`) and what this page does **not** score |

Public config keys live in `lib/streamlit/config.py` (`theme`, `theme.light` / `theme.dark`, sidebar sections). This inventory scores **roles** (how color is used), not every key as its own row.

## What we are scoring

Score the criteria below for **default** light and dark only. Do not score AAA.

This is not a full shell audit. The following criteria were not evaluated: 1.4.4, 1.4.10, 1.4.12, 2.4.1, 2.4.2, full focus behavior (2.4.7 / 2.4.11), 3.1.1, and app-shell 4.1.3. Command-level gaps stay on the [command inventory](accessibility-wcag.md).

In each scorecard table, rows are ordered **Library blocks** first, then **Library meets**. Light and dark are scored in separate columns when they differ.

| Criterion | Level | Threshold used here |
| --------- | ----- | ------------------- |
| **1.4.3 Contrast (Minimum)** | AA | Normal text ≥ 4.5:1 vs adjacent background |
| **1.4.11 Non-text Contrast** | AA | UI components / graphical objects needed to identify controls ≥ 3:1 |
| **2.5.8 Target Size (Minimum)** | AA | CSS box ≥ 24×24 CSS px (see [2.5.8](#258-target-size-minimum) for exceptions) |

| Bucket | Meaning |
| ------ | ------- |
| **Library blocks** | The shipped default fails this criterion. Public `theme.*` overrides can change it, but this page still counts a failing default as a library gap: a candidate for a token or chrome fix, or a later product spec. On the [command inventory](accessibility-wcag.md), the same label means no public composition can meet the criterion. |
| **Author must** | The author sets this value (custom `theme.*` overrides, chart mark colors, `theme.baseFontSize`). A failing shipped default stays **Library blocks** until that default changes. |
| **Library meets** | Default light and dark already meet the ratio or size for that row. |
| **Not this surface** | Host chrome (Community Cloud toolbar), OS, or author plot pixels — do not open a Streamlit theme spec. |

To measure a translucent token, alpha-blend it onto the opaque surface it is drawn on, then compare that opaque result with `color2k`'s `getContrast` (WCAG relative luminance). Do not pass the translucent color to `getContrast` directly. In theme code, `transparentize` only builds faded tokens and `mix` only blends two backgrounds (for example `bgMix`); neither step is the contrast composite. Recompute these ratios from the tokens whenever the palette changes.

## Default theme floors

AA floors for **any** default light/dark palette Streamlit ships. Soft or derived colors (`transparentize`, `fadedText*`, and similar) must meet the floor **after** derivation on the surfaces below.

**2.5.8** is chrome sizing, not a color floor — see [2.5.8](#258-target-size-minimum).

Names mix public config keys (`textColor`, `primaryColor`) and internal tokens (`bodyText`, `fadedText60`) when both refer to the same role. `bgMix` is `mix(backgroundColor, secondaryBackgroundColor, 0.5)` from `computeDerivedColors` — not a public config key.

| Role | Typical tokens / config | Criterion | Floor | Required surfaces |
| ---- | ----------------------- | --------- | ----- | ----------------- |
| Body text | `textColor` / `bodyText` | 1.4.3 | ≥ 4.5:1 | Page, secondary / sidebar |
| Secondary / muted UI text | `fadedText60`, `grayTextColor`, placeholders, counters, hints; default `dataframeHeaderTextColor` | 1.4.3 | ≥ 4.5:1 | Page, secondary / sidebar, `bgMix`, dataframe header |
| Link text | `linkColor` / `blueTextColor` | 1.4.3 | ≥ 4.5:1 | Page, secondary / sidebar |
| Code text on code fill | Inline `codeTextColor` on `codeBackgroundColor` | 1.4.3 | ≥ 4.5:1 | Code background |
| Status text on status fill | Shipped `*TextColor` on `*BackgroundColor`; `primary` on `primarybg` | 1.4.3 | ≥ 4.5:1 | Alert / badge / metric fills on **page and default sidebar** (fills are translucent) |
| Label on primary fill | `white` (or equivalent) on `primaryColor` | 1.4.3 | ≥ 4.5:1 | Primary buttons and other primary-filled controls |
| Primary as **text** | `primaryColor` used for copy | 1.4.3 | ≥ 4.5:1 | Page (and any surface where primary is used as text) |
| Primary as **control** | `primaryColor` fill / outline | 1.4.11 | ≥ 3:1 | Page **and** default sidebar (`secondaryBackgroundColor` when sidebar bg is unset) |
| Control border | `borderColor`; checkbox/radio indicator stroke | 1.4.11 | ≥ 3:1 | Defining strokes that use the border token (see [Theme config notes](#theme-config-notes)) |
| Focus indicator | Soft or solid focus ring when it is the sole indicator | 1.4.11 | ≥ 3:1 | Adjacent background |
| Icon stroke (library chrome) | Often muted / derived paint | 1.4.11 | ≥ 3:1 | Header, toolbar, link/help icons |

Icon strokes do not use opaque `darkenedBgMix100`. Shell code only mixes it translucently (for example, dataframe hover). The opaque token is about 2.2–2.5:1 on the light page, under the 3:1 icon floor, so leave it out of the icon-stroke pass.

Surfaces for pairings: `backgroundColor` (page), `secondaryBackgroundColor` (secondary / default sidebar / many widgets), and role-specific fills (code, status, dataframe header `bgMix` when unset).

## Known library gaps

Sorted by criterion number. Each item is a candidate product-spec section or raise-default fix. Prefer raising defaults over new color APIs (recommendation of this inventory, not a closed product decision).

### Level AA

- **1.4.3 Light-theme secondary text is below 4.5:1.** `fadedText60` / `grayTextColor` / default dataframe header text on default light page, secondary, and mixed backgrounds. Shared by placeholders, file-uploader hints, character counts, tabs, and similar (related issues [#8249](https://github.com/streamlit/streamlit/issues/8249), [#8276](https://github.com/streamlit/streamlit/issues/8276), [#8288](https://github.com/streamlit/streamlit/issues/8288), [#8289](https://github.com/streamlit/streamlit/issues/8289)). Dark-theme muted text **meets** 1.4.3. Ratios: [1.4.3 scorecard](#143-contrast-minimum).
- **1.4.3 Status text on translucent status fills fails on the page and/or default sidebar.** Fills are translucent: 10% opacity in light and 20% in dark (`primarybg`: 10% / 30%). See the [1.4.3 scorecard](#143-contrast-minimum) for per-color results. Call sites: markdown badges, metric deltas (`getMetricTextColor` / `getMetricBackgroundColor`), and `AlertContainer`.
- **1.4.3 White label on primary fill fails in both themes.** See the [1.4.3 scorecard](#143-contrast-minimum) (`StyledPrimaryButton`).
- **1.4.3 `primary` as text fails 4.5:1 on the page (light) and on secondary / default sidebar (both themes).** Includes the file-uploader drag overlay. See the [1.4.3 scorecard](#143-contrast-minimum). Separate from primary-on-`primarybg` status fills.
- **1.4.3 Named markdown text colors can fail 4.5:1 as plain text** (for example `:orange[…]` on the light page / sidebar). Distinct from text-on-status-fill. See the [1.4.3 scorecard](#143-contrast-minimum).
- **1.4.11 Light primary chrome on the default sidebar fails 3:1.** See the [1.4.11 scorecard](#1411-non-text-contrast).
- **1.4.11 Control borders use `borderColor` (default `fadedText10`, body text at 20% opacity) below 3:1** on light and dark. Affects unchecked checkbox/radio indicator strokes and other chrome that always uses `borderColor`. With default `showWidgetBorder` off, many input outlines use `secondaryBg` instead (see [Theme config notes](#theme-config-notes) and the default input-boundary scorecard row). Unset `dataframeBorderColor` is a separate, even fainter token (`fadedText05`) — raising `borderColor` alone does not clear default dataframe gridlines.
- **1.4.11 Default soft focus rings fail 3:1.** Soft `focusRing` / `focusRingMuted` measure ≈ 1.5–2.2:1. Solid `focusRingOutline` (`primary`) meets 1.4.11 on the page (sidebar primary chrome is the 1.4.11 gap above). Full focus *behavior* (2.4.7 / 2.4.11) is not scored here.
- **1.4.11 Enabled close icons that paint `fadedText40` fail 3:1 in light.** Toast and skills-nudge close controls; dark meets. See the [1.4.11 scorecard](#1411-non-text-contrast).
- **2.5.8 Heading link icon and default help tooltip triggers are ~16×16 CSS px** (`iconSizes.base`, no 24px minimum hit box). This inventory scores the CSS box only. Heading link and heading help are 16px targets with an 8px (`spacing.sm`) gap, so the 24px spacing circles are tangent. Main-menu trigger, sidebar expand/collapse, and element toolbar actions ([#17211](https://github.com/streamlit/streamlit/pull/17211)) meet 2.5.8 at the default 16px root.
- **2.5.8 Visible checkbox, radio, and toggle labels, plus collapsed checkbox/toggle tracks, are under 24×24 CSS px.** Label paragraphs inherit `fontSizes.sm` (14px) from `isLabel`; see the [2.5.8 scorecard](#258-target-size-minimum).

## Current defaults

Live scorecard for today’s default light and dark themes. Floors above are the gate; these tables are measured results.

### 1.4.3 Contrast (Minimum)

| Role | Light | Dark | Bucket | Note |
| ---- | ----- | ---- | ------ | ---- |
| Secondary / muted UI text (`fadedText60`, `grayTextColor`, dataframe header) | Fail (~3.5–3.7) | Pass (~6.1–7.0) | Library blocks | Light only; includes default `dataframeHeaderTextColor` |
| White label on primary fill | Fail (~3.30) | Fail (~3.30) | Library blocks | `StyledPrimaryButton` and similar |
| `primary` as **text** | Fail page ~3.30; fail secondary ~2.95 | Pass page ~5.7; fail secondary ~4.49 | Library blocks | File-uploader drag overlay is primary on `secondaryBg`. Not primary-on-`primarybg` |
| Status text on status fill — **page** | Fail (see per-color table) | Fail (see per-color table) | Library blocks | Translucent fills on page bg; badges, metrics, `AlertContainer` |
| Status text on status fill — **default sidebar** | Fail (see per-color table) | Fail (see per-color table) | Library blocks | Same fills composited onto sidebar `secondaryBackgroundColor` |
| Body text on page / secondary | Pass (~12.5 / 11.2) | Pass (~18.1 / 14.2) | Library meets | |
| Link text | Pass (~7.5 page / ~6.7 secondary) | Pass (~6.6 page / ~5.2 secondary) | Library meets | Markdown / in-app links |
| Named markdown text color (`:orange[…]` and similar) | Fail orange ~3.42 page / ~3.05 secondary; yellow/green fail on secondary only (~4.29 / ~4.38) | Pass for orange/yellow/green on page | Library blocks | Unfilled color directives as plain text; not the status-fill table |
| Inline `codeTextColor` on `codeBackgroundColor` (`bgMix`) | Pass (~4.7) | Pass (~10.5) | Library meets | Default inline code paint only. Block syntax tokens in `StyledPre` are not scored here |

Per-color status text on status fill (painted pairs only: markdown badges, metric deltas, `AlertContainer`). Floor is 4.5:1. Light-page green is **4.497:1** (below 4.5:1). Markdown has no `:purple[` / `:purple-background[`; those tokens are rainbow-gradient stops only and are not scored here.

| Color | Light page | Light sidebar | Dark page | Dark sidebar |
| ----- | ---------- | ------------- | --------- | ------------ |
| Red | Pass ~4.58 | Fail ~4.10 | Pass ~5.16 | Fail ~3.96 |
| Orange | Fail ~3.19 | Fail ~2.87 | Pass ~8.24 | Pass ~6.36 |
| Yellow | Pass ~4.74 | Fail ~4.27 | Pass ~10.31 | Pass ~7.85 |
| Blue | Pass ~6.68 | Pass ~6.00 | Pass ~4.90 | Fail ~3.75 |
| Green | Fail ~4.50 | Fail ~4.04 | Pass ~7.91 | Pass ~6.01 |
| Violet | Pass ~7.59 | Pass ~6.80 | Pass ~5.26 | Fail ~4.07 |
| Gray | Fail ~3.44 | Fail ~3.30 | Pass ~6.06 | Pass ~5.04 |
| Primary | Fail ~2.92 | Fail ~2.62 | Fail ~3.85 | Fail ~3.04 |

#### Disabled styling

`fadedText40` measures ~2.2:1 (light) and ~3.7:1 (dark). 1.4.3 exempts inactive (disabled) components, so this is not a Library blocks row. It is recorded so enabled UI that reuses `fadedText40` still gets caught.

### 1.4.11 Non-text Contrast

| Role | Light | Dark | Bucket | Note |
| ---- | ----- | ---- | ------ | ---- |
| Control border (`borderColor`) | Fail (~1.45) | Fail (~1.8) | Library blocks | Includes unchecked checkbox/radio indicator strokes; many inputs only when `showWidgetBorder` is on |
| Soft focus ring (`focusRing`) | Fail (~1.9) | Fail (~2.2) | Library blocks | Sole focus indicator on many controls |
| Soft muted focus ring (`focusRingMuted`) | Fail (~1.5) | Fail (~1.8) | Library blocks | Header icon buttons, main menu, sidebar nav, skills nudge. `focusRingSubtle` is defined in `getShadows.ts` and unused (unscored on purpose) |
| Primary as control on default sidebar | Fail (~2.95) | Pass (~4.49) | Library blocks | Sidebar bg defaults to `secondaryBackgroundColor` |
| Default input boundary (`showWidgetBorder` off) | Fail (~1.12) | Fail (~1.27) | Library blocks | Resting outline is `secondaryBg` on page (`getBorderColor`); fill is the same token. Turning the border on paints `borderColor` (row above) |
| Enabled close icon (`fadedText40`) | Fail (~2.2) | Pass (~3.7) | Library blocks | `StyledCloseButton` (toast) and `StyledSkillsNudgeClose` on toast / nudge card (`bgColor`) |
| Muted icon stroke (`fadedText60`) | Pass (~3.5–3.7) | Pass (~6.1–7.0) | Library meets | Header, toolbar, and link/help icons that use this token only (page ~3.69, secondary ~3.56). [#16149](https://github.com/streamlit/streamlit/issues/16149) is **not** a default 1.4.11 fail for this token |
| Primary as control / solid focus outline on page | Pass (~3.30) | Pass (~5.7) | Library meets | Page background only |

### 2.5.8 Target Size (Minimum)

Accessible names for icon-only controls were largely addressed in [#17170](https://github.com/streamlit/streamlit/pull/17170). This section is **hit target size** only (glyph contrast is under 1.4.11). Unless noted, sizes assume the default 16px root (`theme.baseFontSize` unset).

**2.5.8 rows score the CSS box only** (Library blocks here means the box is under 24×24, not that every WCAG 2.5.8 exception fails). Spacing and inline exceptions are noted when relevant but are not used to flip the bucket.

**Label sizing**

- `StreamlitMarkdown` with `isLabel` sets its container to `fontSizes.sm` (14px). `StyledStreamlitMarkdown` then sets `p, ol, ul, dl, li { font-size: inherit }`, which overrides `globalStyles` `p { font-size: 1rem }`.
- Checkbox and toggle `StyledContent` use line-height 1.5, so a visible default label line box is `1.5 × 0.875rem` = 21px.
- Radio options inherit the body line-height 1.6, so a visible default label line box is `1.6 × 0.875rem` ≈ 22.4px.

| Control | Hit target | Bucket | Note |
| ------- | ---------- | ------ | ---- |
| Heading link icon | ~16×16 (`iconSizes.base`), no min box | Library blocks | CSS-box score; with heading help at `spacing.sm` (8px), 24px spacing circles are tangent |
| Default help / tooltip trigger | ~16×16, no padding | Library blocks | CSS-box score; same spacing note when paired with heading link |
| Checkbox with collapsed label | 16×16 indicator (`sizes.checkbox`) | Library blocks | `LabelVisibility.Collapsed` hides the label; only the indicator remains |
| Checkbox with visible label | Line box 21px (`0.875rem` × line-height 1.5) | Library blocks | `StyledCheckboxButton` is the hit target; field `minHeight` 1.5rem does not stretch the label |
| Toggle with visible label | Same 21px label line box | Library blocks | Same `isLabel` markdown as checkbox |
| Toggle with collapsed label | Track 32×16 (`2 × sizes.checkbox` by `sizes.checkbox`) | Library blocks | Height 16px |
| Radio option with visible label | Line box ≈ 22.4px (`0.875rem` × line-height 1.6) | Library blocks | Vertical groups with no caption use `gap: 0`, so 24px spacing circles overlap |
| Main menu trigger | `headerItemHeight` 1.75rem (= 28px at 16px root) | Library meets | No `24px` CSS floor; below 24px when `theme.baseFontSize` is 13 or smaller (`1.75rem`). That custom root is Author must |
| Sidebar expand / collapse | Same `headerItemHeight` sizing | Library meets | Same root-font caveat; not every app-header control |
| Element toolbar actions | `max(1.5rem, 24px)` | Library meets | [#17211](https://github.com/streamlit/streamlit/pull/17211) |

## Theme config notes

Core color keys (`primaryColor`, `textColor`, `linkColor`, `borderColor`, status `*Color` / `*TextColor` / `*BackgroundColor`, code colors, backgrounds) map directly to the [floors](#default-theme-floors) and [scorecards](#current-defaults) above. Only the quirks below need extra explanation.

### Dataframe header and border

When unset:

- `dataframeHeaderTextColor` → faded `textColor` (`fadedText60`) — same light **1.4.3** muted-text Library blocks gap
- `dataframeHeaderBackgroundColor` → `bgMix` (`mix(backgroundColor, secondaryBackgroundColor, 0.5)`)
- `dataframeBorderColor` → `fadedText05` (body text at 10% opacity, ≈ 1.20:1 on the page) — **not** `borderColor` (`fadedText10`, body text at 20% opacity, ≈ 1.45:1). Dataframe/table borders use that fainter token by default. They switch to `transparentize(borderColor, 0.55)` only when the author sets `theme.borderColor` (`createEmotionTheme`). Raising the default `borderColor` alone does **not** clear default dataframe gridlines.
- Off `st.toggle` track uses `fadedText10` via `getToggleTrackColor`, not `borderColor`. Same default look and 1.4.11 fail as the border token; a custom `theme.borderColor` does not restyle it. Selected tracks use `primary` (sidebar 1.4.11 row).

Raising muted text (or shipping a stronger default header text color) clears the header text gap together with placeholders and related chrome.

### `showWidgetBorder`

Default is **off** (`widgetBorderColor` unset). Many inputs then outline with `secondaryBg` (`getBorderColor`) and fill with the same token, so the weak default `borderColor` is **not** that outline. The resting control edge against the **page** is still a 1.4.11 fail (see the default input-boundary scorecard row).

Checkbox/radio **indicator** strokes and other chrome that always use `borderColor` still fail **1.4.11**. Turning `showWidgetBorder` on paints those inputs with `borderColor` — authors who enable it inherit the same sub-3:1 border unless they also raise `borderColor`.

`showSidebarBorder` only toggles the sidebar separator; it was not measured as its own row (separator uses border-family paint when shown).

### Author must / out of scope on this page

- **Author must** — custom `theme.*` overrides (including `theme.baseFontSize` that shrinks rem-based header hit targets below 24px); chart mark palettes (`chartCategoricalColors`, `chartSequentialColors`, `chartDivergingColors`). Chart encodings are also covered in the [command inventory](accessibility-wcag.md).
- **Not this surface** — host chrome such as the Community Cloud toolbar.
- **Not scored here** — fonts / `fontFaces` / sizes / weights (later shell pass, e.g. 1.4.4); radii (`baseRadius`, `buttonRadius`); `theme.base` inheritance paths (audit resolved defaults, not every override file).
