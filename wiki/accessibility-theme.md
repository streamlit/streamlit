# Streamlit WCAG theme & shell chrome inventory

Last updated: 2026-10-05. Re-audit when default theme tokens, focus-ring derivation, or library icon hit targets change.

This page is the **theme & shell chrome** inventory. For per-command `st.*` tables, see the [command inventory](accessibility-wcag.md).

How Streamlit’s **default** light and dark themes — semantic/derived color tokens and the library chrome they paint — enable or block selected **WCAG 2.2 Level AA** criteria. Conformance applies to the **app**, not the library — this page is not a claim that Streamlit itself is conformant.

**Current documented coverage:** default Light and Dark emotion themes (`themeColors.ts`, `getColors.ts`, `getShadows.ts`); muted/secondary text; shipped alert status pairings; control borders; focus rings; library shell icons (contrast + target size). Custom `theme.*` overrides and author chart mark colors are **Author must**.

## What we are scoring

Score the criteria below for **default** light and dark only. Do not score AAA. These tables are not a full shell audit: other A/AA criteria (for example 1.4.4, 1.4.10, 1.4.12, 2.4.1, 2.4.2, full 2.4.7 / 2.4.11 focus *behavior*, 3.1.1, app-shell 4.1.3) were not evaluated here. Command-level gaps stay on the [command inventory](accessibility-wcag.md).

In each criterion table, rows are ordered **Library blocks** first, then **Library meets**, then notes. Light and dark are scored separately when they differ.

| Criterion | Level | Threshold used here |
| --------- | ----- | ------------------- |
| **1.4.3 Contrast (Minimum)** | AA | Normal text ≥ 4.5:1 vs adjacent background |
| **1.4.11 Non-text Contrast** | AA | UI components / graphical objects needed to identify controls ≥ 3:1 |
| **2.5.8 Target Size (Minimum)** | AA | Pointer targets ≥ 24×24 CSS px (or a documented exception) |

| Bucket | Meaning |
| ------ | ------- |
| **Library blocks** | Default Streamlit theme / chrome fails the criterion; the author cannot fix it without forking CSS or a custom theme Streamlit does not guarantee. Candidate for a token/chrome fix or a later product spec. |
| **Author must** | Author-controlled theme config (`theme.primaryColor`, etc.) or author content. Defaults may still be scored separately on this page. |
| **Library meets** | Default light and dark already meet the ratio or size for that row. |
| **Not this surface** | Host chrome (Community Cloud toolbar), OS, or author plot pixels — do not open a Streamlit theme spec. |

### Surfaces scored

| Surface | Scored |
| ------- | ------ |
| Text / surface token pairings (body, muted, link, code, primary-as-text, alert fills) | 1.4.3 |
| Non-text chrome (icon strokes, control borders, focus rings) | 1.4.11 |
| Library shell pointer targets (header, toolbar, heading link, help) | 2.5.8 |

Measurements used opaque composites of transparentized tokens onto the stated background (`color2k` `getContrast`), matching `computeDerivedColors` / `createEmotionColors`. Research workbook (ratios, script): keep locally under `work-tmp/` if regenerating; this wiki page is the durable inventory.

## Known library gaps

Sorted by success-criterion number. Each item is a candidate product-spec section or raise-default fix. Prefer raising defaults over new color APIs ([#14712](https://github.com/streamlit/streamlit/pull/14712) closed). Cite a GitHub issue only when it is the tracked seed for that gap (same pattern as the command inventory).

### Level AA

- **1.4.3 Light-theme secondary text is below 4.5:1.** `fadedText60` / `grayTextColor` / dataframe header text measure ≈ 3.5–3.7:1 on default light `bgColor`, `secondaryBg`, and `bgMix`. Shared by placeholders, file-uploader hints, character counts, tabs, and similar (seeds [#8249](https://github.com/streamlit/streamlit/issues/8249), [#8276](https://github.com/streamlit/streamlit/issues/8276), [#8288](https://github.com/streamlit/streamlit/issues/8288), [#8289](https://github.com/streamlit/streamlit/issues/8289)). Dark-theme muted text **meets** 1.4.3.
- **1.4.3 Light alert orange (and gray) status text fails on status fill.** Orange text-on-fill ≈ 3.19:1; gray status ≈ 3.44:1. Green is borderline (~4.50:1). Red / yellow / blue / violet light alerts and all measured dark alert pairings meet 4.5:1.
- **1.4.3 Light `primary` is below 4.5:1 when used as text** on `bgColor` (≈ 3.30:1). As a **control** fill/outline it still meets **1.4.11** (same ratio ≥ 3:1).
- **1.4.11 Control borders use `borderColor` (≈ `fadedText10`) below 3:1** on light and dark (≈ 1.4–1.9:1). Affects unchecked checkbox/radio strokes and other defining input borders.
- **1.4.11 Default soft focus rings fail 3:1.** `focusRing` (`transparentize(primary, 0.5)`) and `focusRingMuted` measure ≈ 1.5–2.2:1. Solid `focusRingOutline` (`primary`) meets 1.4.11. Full focus *behavior* (2.4.7 / 2.4.11) is not scored here.
- **2.5.8 Heading link icon and default help tooltip triggers are ~16×16 CSS px** (`iconSizes.base`, no 24px minimum hit box). Main menu / header items (`headerItemHeight` 1.75rem) and element toolbar actions (`max(1.5rem, 24px)`, [#17211](https://github.com/streamlit/streamlit/pull/17211)) meet 2.5.8.

## 1.4.3 Contrast (Minimum)

Score **roles**, not every primitive swatch. Primitives matter only when bound to a semantic or derived token below.

| Token / role | Level | Light | Dark | Bucket | Note |
| ------------ | ----- | ----- | ---- | ------ | ---- |
| `fadedText60` / `grayTextColor` / dataframe header text | AA | Fail (~3.5–3.7) | Pass (~6.1–7.0) | Library blocks (light) | Secondary/muted UI copy; one raise-default fixes many call sites |
| `primary` as **text** | AA | Fail (~3.3) | Pass (~5.7) | Library blocks (light) | Prefer not using primary for small body text until raised |
| Shipped alert `*TextColor` on `*BackgroundColor` | AA | Orange/gray fail; green borderline; others pass | All measured pass | Library blocks (light orange/gray) | `AlertContainer` ERROR/WARNING/INFO/SUCCESS mappings |
| `bodyText` on `bgColor` / `secondaryBg` | AA | Pass (~12.5 / 11.2) | Pass (~18.1 / 14.2) | Library meets | Main canvas and sidebar/secondary pairings |
| `link` (`blueTextColor`) | AA | Pass (~6.7–7.5) | Pass (~5.2–6.6) | Library meets | Markdown / in-app links |
| `codeTextColor` on `codeBackgroundColor` | AA | Pass (~4.7) | Pass (~10.5) | Library meets | |

### Disabled styling

`fadedText40` fails 1.4.3 on light (~2.2:1) and dark (~3.7:1). WCAG’s expectations for inactive controls are limited — do **not** auto-promote to a must-fix Library blocks row without a product read. Measured so “enabled-looking” muted UI is not invisible to the inventory.

## 1.4.11 Non-text Contrast

| Token / role | Level | Light | Dark | Bucket | Note |
| ------------ | ----- | ----- | ---- | ------ | ---- |
| `borderColor` defining control stroke | AA | Fail (~1.4) | Fail (~1.8) | Library blocks | Unchecked radio/checkbox, input borders |
| `focusRing` (50% primary) | AA | Fail (~1.9) | Fail (~2.2) | Library blocks | Sole focus indicator on many controls |
| `focusRingMuted` | AA | Fail (~1.5) | Fail (~1.8) | Library blocks | Header icon buttons |
| `darkenedBgMix100` as glyph | AA | Fail (~2.2–2.5) | Pass | Library blocks if used as icon paint | Little shell use today (mostly dataframe hover math) |
| `fadedText60` as **icon** stroke (link, help, toolbar, sidebar collapse) | AA | Pass (~3.6–3.7) | Pass (~6.1–7.0) | Library meets | [#16149](https://github.com/streamlit/streamlit/issues/16149) is **not** a default 1.4.11 fail for this token |
| `primary` as control / `focusRingOutline` | AA | Pass (~3.3) | Pass (~5.7) | Library meets | |
| Checkbox / radio **indicator** disk (border token) | AA | Fail (see `borderColor`) | Fail | Library blocks | Labeled row hit target is scored under 2.5.8 |

## 2.5.8 Target Size (Minimum)

Icon **accessible names** were largely addressed in [#17170](https://github.com/streamlit/streamlit/pull/17170). This section is hit target size only (glyph contrast is under 1.4.11).

| Control | Level | Hit target | Bucket | Note |
| ------- | ----- | ---------- | ------ | ---- |
| Heading link icon | AA | ~16×16 (`iconSizes.base`), no min box | Library blocks | |
| Default help / tooltip trigger | AA | ~16×16, `padding: 0` | Library blocks | |
| Main menu (`stMainMenuButton`) | AA | `headerItemHeight` 1.75rem | Library meets | ≥24px at supported roots |
| Sidebar expand / collapse | AA | Header-button sizing | Library meets | |
| Element toolbar actions | AA | `max(1.5rem, 24px)` | Library meets | [#17211](https://github.com/streamlit/streamlit/pull/17211) |
| Checkbox / radio labeled row | AA | `minElementHeight` (~40px) | Library meets | Indicator *border* contrast is 1.4.11 |

## Author must / Not this surface

| Topic | Bucket | Note |
| ----- | ------ | ---- |
| Custom `theme.primaryColor`, `backgroundColor`, text colors, etc. | Author must | Author chose the palette; defaults above still apply until overridden |
| `chartCategoricalColors` / sequential / diverging as **plot marks** | Author must | Covered under chart rows in the [command inventory](accessibility-wcag.md) |
| Host / SiS / Community Cloud toolbar icons | Not this surface | Protocol / host chrome |
| New default theme WIP | Appendix only until shipped | Inventory tracks `develop` defaults; optional compare against `work-tmp/new_default_theme/` locally |
