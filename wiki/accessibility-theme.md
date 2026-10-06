# Streamlit WCAG theme & shell chrome inventory

Last updated: 2026-10-05. Re-audit when default theme tokens, focus-ring derivation, or library icon hit targets change.

This page is the **theme & shell chrome** inventory. For per-command `st.*` tables, see the [command inventory](accessibility-wcag.md).

How Streamlit’s **default** light and dark themes enable or block selected **WCAG 2.2 Level AA** criteria for color contrast and control size. Conformance applies to the **app**, not the library — this page is not a claim that Streamlit itself is conformant.

Use this inventory to see whether a default theme **role** (body text, muted text, border, focus ring, and so on) **blocks** a criterion, **meets** it, leaves it to the **author**, or is **not this surface**.

**Current documented coverage:** default light and dark themes; muted/secondary text; shipped alert colors; control borders; focus rings; library shell icons (contrast and target size). Custom `theme.*` overrides and author chart colors are **Author must**.

## What we are scoring

Score the criteria below for **default** light and dark only. Do not score AAA. This is not a full shell audit — for example 1.4.4, 1.4.10, 1.4.12, 2.4.1, 2.4.2, full focus *behavior* (2.4.7 / 2.4.11), 3.1.1, and app-shell 4.1.3 were not evaluated here. Command-level gaps stay on the [command inventory](accessibility-wcag.md).

In each criterion table, rows are ordered **Library blocks** first, then **Library meets**. Light and dark are scored in separate columns when they differ.

| Criterion | Level | Threshold used here |
| --------- | ----- | ------------------- |
| **1.4.3 Contrast (Minimum)** | AA | Normal text ≥ 4.5:1 vs adjacent background |
| **1.4.11 Non-text Contrast** | AA | UI components / graphical objects needed to identify controls ≥ 3:1 |
| **2.5.8 Target Size (Minimum)** | AA | Pointer targets ≥ 24×24 CSS px (or a documented exception) |

| Bucket | Meaning |
| ------ | ------- |
| **Library blocks** | The default theme or library chrome fails the criterion. An author cannot fix it without forking CSS or relying on a custom theme Streamlit does not guarantee. Candidate for a token/chrome fix or a later product spec. |
| **Author must** | The author controls the value (`theme.primaryColor`, chart mark colors, and similar). Defaults are still scored on this page until overridden. |
| **Library meets** | Default light and dark already meet the ratio or size for that row. |
| **Not this surface** | Host chrome (Community Cloud toolbar), OS, or author plot pixels — do not open a Streamlit theme spec. |

### Default theme floors

AA floors for **any** default light/dark palette Streamlit ships (current or next). Score **roles** — how Streamlit uses the color — not every theme config key. The criterion tables later on this page are the live pass/fail scorecard for today’s defaults.

**2.5.8** (target size) is chrome sizing, not a color floor — see [2.5.8 Target Size](#258-target-size-minimum).

Names in the “Typical tokens” column mix public config keys (`textColor`, `primaryColor`) and internal theme tokens (`bodyText`, `fadedText60`) when both refer to the same role.

| Role | Typical tokens / config | Criterion | Floor | Required surfaces |
| ---- | ----------------------- | --------- | ----- | ----------------- |
| Body text | `textColor` / `bodyText` | 1.4.3 | ≥ 4.5:1 | Page background, secondary / sidebar background |
| Secondary / muted UI text | `fadedText60`, `grayTextColor`, placeholders, counters, hints | 1.4.3 | ≥ 4.5:1 | Page, secondary / sidebar, and mixed surfaces where muted text appears |
| Link text | `linkColor` / `blueTextColor` | 1.4.3 | ≥ 4.5:1 | Page, secondary / sidebar |
| Code text on code fill | `codeTextColor` on `codeBackgroundColor` | 1.4.3 | ≥ 4.5:1 | Code background |
| Status text on status fill | Shipped `*TextColor` on `*BackgroundColor` | 1.4.3 | ≥ 4.5:1 | Alert / toast fills |
| Primary as **text** | `primaryColor` used for copy | 1.4.3 | ≥ 4.5:1 | Page (and any surface where primary is used as text) |
| Primary as **control** | `primaryColor` fill / outline | 1.4.11 | ≥ 3:1 | Page (and secondary where primary chrome appears) |
| Control border | `borderColor` / defining input stroke | 1.4.11 | ≥ 3:1 | Unchecked checkbox/radio and inputs that need the stroke to be visible |
| Focus indicator | Soft or solid focus ring when it is the sole indicator | 1.4.11 | ≥ 3:1 | Adjacent background |
| Icon stroke (library chrome) | Often muted / derived paint | 1.4.11 | ≥ 3:1 | Header, toolbar, link/help icons |

Author customizations and non-Streamlit chrome are **not** scored as default-theme Library blocks:

- **Author must** — custom `theme.*` colors and chart mark palettes (categorical / sequential / diverging). The author chose them; default floors above still apply until overridden. Chart encodings are also covered in the [command inventory](accessibility-wcag.md).
- **Not this surface** — host chrome such as the Community Cloud toolbar (protocol / host owned).

Soft or derived colors (for example `transparentize` and `fadedText*`) must still meet the floor **after** derivation on the surfaces above.

Ratios on this page use opaque composites of transparent tokens onto the stated background (`color2k` `getContrast`), matching theme derivation in code. Keep raw measurement scripts locally under `work-tmp/` if regenerating; this wiki page is the durable inventory.

## Known library gaps

Sorted by criterion number. Each item is a candidate product-spec section or raise-default fix. Prefer raising defaults over new color APIs ([#14712](https://github.com/streamlit/streamlit/pull/14712) closed).

### Level AA

- **1.4.3 Light-theme secondary text is below 4.5:1.** `fadedText60` / `grayTextColor` / dataframe header text measure ≈ 3.5–3.7:1 on default light page, secondary, and mixed backgrounds. Shared by placeholders, file-uploader hints, character counts, tabs, and similar (seeds [#8249](https://github.com/streamlit/streamlit/issues/8249), [#8276](https://github.com/streamlit/streamlit/issues/8276), [#8288](https://github.com/streamlit/streamlit/issues/8288), [#8289](https://github.com/streamlit/streamlit/issues/8289)). Dark-theme muted text **meets** 1.4.3.
- **1.4.3 Light alert orange (and gray) status text fails on status fill.** Orange text-on-fill ≈ 3.19:1; gray status ≈ 3.44:1. Green is borderline (~4.50:1). Red / yellow / blue / violet light alerts and all measured dark alert pairings meet 4.5:1.
- **1.4.3 Light `primary` is below 4.5:1 when used as text** on the page background (≈ 3.30:1). As a **control** fill/outline it still meets **1.4.11** (same ratio ≥ 3:1).
- **1.4.11 Control borders use `borderColor` (≈ `fadedText10`) below 3:1** on light and dark (≈ 1.4–1.9:1). Affects unchecked checkbox/radio strokes and other defining input borders.
- **1.4.11 Default soft focus rings fail 3:1.** Soft `focusRing` / `focusRingMuted` measure ≈ 1.5–2.2:1. Solid `focusRingOutline` (`primary`) meets 1.4.11. Full focus *behavior* (2.4.7 / 2.4.11) is not scored here.
- **2.5.8 Heading link icon and default help tooltip triggers are ~16×16 CSS px** (`iconSizes.base`, no 24px minimum hit box). Main menu / header items and element toolbar actions (`max(1.5rem, 24px)`, [#17211](https://github.com/streamlit/streamlit/pull/17211)) meet 2.5.8.

## 1.4.3 Contrast (Minimum)

| Role | Light | Dark | Bucket | Note |
| ---- | ----- | ---- | ------ | ---- |
| Secondary / muted UI text (`fadedText60`, `grayTextColor`, dataframe header) | Fail (~3.5–3.7) | Pass (~6.1–7.0) | Library blocks | Light only; one raise-default fixes many call sites |
| `primary` as **text** | Fail (~3.3) | Pass (~5.7) | Library blocks | Light only; prefer not using primary for small body text until raised |
| Shipped alert text on alert fill | Orange/gray fail; green borderline; others pass | All measured pass | Library blocks | Light orange/gray; see `AlertContainer` status mappings |
| Body text on page / secondary | Pass (~12.5 / 11.2) | Pass (~18.1 / 14.2) | Library meets | |
| Link text | Pass (~6.7–7.5) | Pass (~5.2–6.6) | Library meets | Markdown / in-app links |
| Code text on code fill | Pass (~4.7) | Pass (~10.5) | Library meets | |

### Disabled styling

`fadedText40` fails 1.4.3 on light (~2.2:1) and dark (~3.7:1). WCAG’s expectations for inactive controls are limited — do **not** treat this as a must-fix Library blocks row without a product decision. Measured so enabled-looking muted UI is not invisible to the inventory.

## 1.4.11 Non-text Contrast

| Role | Light | Dark | Bucket | Note |
| ---- | ----- | ---- | ------ | ---- |
| Control border (`borderColor`) | Fail (~1.4) | Fail (~1.8) | Library blocks | Unchecked radio/checkbox, input borders |
| Soft focus ring (`focusRing`) | Fail (~1.9) | Fail (~2.2) | Library blocks | Sole focus indicator on many controls |
| Soft muted focus ring (`focusRingMuted`) | Fail (~1.5) | Fail (~1.8) | Library blocks | Header icon buttons |
| `darkenedBgMix100` as icon paint | Fail (~2.2–2.5) | Pass | Library blocks | Only if used as icon paint; little shell use today |
| Muted icon stroke (`fadedText60`) | Pass (~3.6–3.7) | Pass (~6.1–7.0) | Library meets | [#16149](https://github.com/streamlit/streamlit/issues/16149) is **not** a default 1.4.11 fail for this token |
| Primary as control / solid focus outline | Pass (~3.3) | Pass (~5.7) | Library meets | |
| Checkbox / radio indicator disk | Fail (see border) | Fail | Library blocks | Border contrast; labeled-row hit target is under 2.5.8 |

## 2.5.8 Target Size (Minimum)

Accessible names for icon-only controls were largely addressed in [#17170](https://github.com/streamlit/streamlit/pull/17170). This section is **hit target size** only (glyph contrast is under 1.4.11).

| Control | Hit target | Bucket | Note |
| ------- | ---------- | ------ | ---- |
| Heading link icon | ~16×16 (`iconSizes.base`), no min box | Library blocks | |
| Default help / tooltip trigger | ~16×16, no padding | Library blocks | |
| Main menu | Header item height 1.75rem | Library meets | ≥24px at supported root font sizes |
| Sidebar expand / collapse | Header-button sizing | Library meets | |
| Element toolbar actions | `max(1.5rem, 24px)` | Library meets | [#17211](https://github.com/streamlit/streamlit/pull/17211) |
| Checkbox / radio labeled row | ~40px min height | Library meets | Indicator *border* contrast is 1.4.11 |
