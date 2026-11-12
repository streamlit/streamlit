# Streamlit WCAG theme & shell chrome inventory

Last updated: 2026-11-11. Re-audit when default theme tokens, focus-ring derivation, library icon hit targets, or shared shell chrome behavior changes.

This page is the **theme & shell chrome** inventory. For per-command `st.*` tables, see the [command inventory](accessibility-wcag.md).

This inventory records how Streamlit’s default light and dark themes enable or block selected WCAG 2.2 A/AA criteria for contrast and control size. It also records how library-owned app-shell surfaces (header, sidebar, page navigation, main menu, overlays, toasts, and toolbars) fare on keyboard, focus, name/role, and status-message criteria. *Shell chrome* means library-rendered UI around and inside elements (app header, sidebar toggle, element toolbars, focus rings, help icons), as opposed to content the author supplies. Conformance applies to the **app**, not the library — this page is not a claim that Streamlit itself is conformant.

**How to use this page**

| Section | Use it when you need… |
| ------- | --------------------- |
| [Default theme floors](#default-theme-floors) | Minimum ratios any shipped default palette must meet |
| [Known library gaps](#known-library-gaps) | What fails today and is a candidate fix / raise-default |
| [Current defaults](#current-defaults) | Measured light/dark pass/fail for today’s `develop` theme |
| [Shared shell surfaces](#shared-shell-surfaces) | Per-surface keyboard, focus, name, and status scores for the app frame |
| [Theme config notes](#theme-config-notes) | Non-obvious `theme.*` defaults (dataframe, `showWidgetBorder`) and what this page does **not** score |

Public config keys live in `lib/streamlit/config.py` (`theme`, `theme.light` / `theme.dark`, sidebar sections). Theme floors score **roles** (how color is used), not every key as its own row. Shared shell surfaces score **library-owned frame regions**.

## What we are scoring

Score the criteria below for **default** light and dark only. Do not score AAA.

The theme floors and current-defaults scorecards cover contrast, target size, and shell **2.4.1**. **[Shared shell surfaces](#shared-shell-surfaces)** additionally scores keyboard, focus order/visibility, name/role/value, and app-shell status messages **for those frame regions only**.

This is not a full shell or app audit. Still unscored here: **1.4.4**, **1.4.10**, **1.4.12**, **2.4.2**, **2.4.11 Focus Not Obscured**, and **3.1.1**. Command-level gaps stay on the [command inventory](accessibility-wcag.md). This inventory still does not claim full app conformance.

In theme scorecard tables, rows are ordered **Library blocks** first, then **Library meets**. Light and dark are scored in separate columns when they differ. Shared shell tables list Level A criteria first, then Level AA, each in success-criterion order.

| Criterion | Level | Where scored | Threshold / focus used here |
| --------- | ----- | ------------ | --------------------------- |
| **1.4.3 Contrast (Minimum)** | AA | Theme floors | Normal text ≥ 4.5:1 vs adjacent background |
| **1.4.11 Non-text Contrast** | AA | Theme floors (+ shell notes) | UI components / graphical objects needed to identify controls ≥ 3:1 |
| **2.1.1 Keyboard** | A | Shared shell surfaces | Frame controls operable without a pointer |
| **2.4.1 Bypass Blocks** | A | Current defaults + Shared shell surfaces | Mechanism to skip repeated chrome (landmarks and/or skip link) |
| **2.4.3 Focus Order** | A | Shared shell surfaces | Meaningful sequence; collapsed / overlay focus not stranded |
| **2.4.7 Focus Visible** | AA | Shared shell surfaces | Visible focus indicator when a control has keyboard focus |
| **2.5.8 Target Size (Minimum)** | AA | Theme floors | CSS box ≥ 24×24 CSS px (see [2.5.8](#258-target-size-minimum) for exceptions) |
| **4.1.2 Name, Role, Value** | A | Shared shell surfaces | Accessible name/role/state for frame controls |
| **4.1.3 Status Messages** | AA | Shared shell surfaces | Programmatic status without stealing focus (toast / nudge) |

| Bucket | Meaning |
| ------ | ------- |
| **Library blocks** | The shipped default fails this criterion. Public `theme.*` overrides can change it, but this page still counts a failing default as a library gap: a candidate for a token or chrome fix, or a later product spec. On the [command inventory](accessibility-wcag.md), the same label means no public composition can meet the criterion. |
| **Author must** | The author sets this value (custom `theme.*` overrides, chart mark colors, `theme.baseFontSize`). A failing shipped default stays **Library blocks** until that default changes. On shared shell rows, the author supplies the accessible-name text (`alt` or caption). |
| **Library meets** | Default light and dark already meet the criterion for that row. |
| **Deferred** | In scope for this inventory, but not measured or fully audited yet (no pass/fail claim). |
| **Not this surface** | Host chrome (Community Cloud toolbar), OS, or author plot pixels — do not open a Streamlit theme spec. |

On [Shared shell surfaces](#shared-shell-surfaces), **2.4.7** is **Library meets** when a visible focus indicator is drawn (including soft rings). Soft-ring contrast failures stay under **1.4.11** only — WCAG does not treat a low-contrast ring as a missing 2.4.7 indicator. Mark **2.4.7 Library blocks** when keyboard focus has **no** visible indicator: the focused control is invisible (for example unlocked toolbars at `opacity: 0`), or outline / box-shadow are cleared on focus with no replacement styling (for example some View more/less buttons).

To measure a translucent token, alpha-blend it onto the opaque surface it is drawn on, then compare that opaque result with `color2k`'s `getContrast` (WCAG relative luminance). Do not pass the translucent color to `getContrast` directly. In theme code, `transparentize` only builds faded tokens and `mix` only blends two backgrounds (for example `bgMix`); neither step is the contrast composite. Recompute these ratios from the tokens whenever the palette changes.

## Default theme floors

AA floors for **any** default light/dark palette Streamlit ships. Soft or derived colors (`transparentize`, `fadedText*`, and similar) must meet the floor **after** derivation on the surfaces below.

**2.5.8** is chrome sizing, not a color floor — see [2.5.8](#258-target-size-minimum).

Use `fadedText70` (70% `bodyText`) for secondary or muted **text** and `fadedText60` (60%) for muted **icon** strokes. Names mix public config keys (`textColor`, `primaryColor`) and internal tokens (`bodyText`, `fadedText70`, `fadedText60`) when both refer to the same role. `bgMix` is `mix(backgroundColor, secondaryBackgroundColor, 0.5)` from `computeDerivedColors` — not a public config key.

| Role | Typical tokens / config | Criterion | Floor | Required surfaces |
| ---- | ----------------------- | --------- | ----- | ----------------- |
| Body text | `textColor` / `bodyText` | 1.4.3 | ≥ 4.5:1 | Page, secondary / sidebar |
| Secondary / muted UI text | `fadedText70`, `grayTextColor`, enabled placeholders, counters, hints; default `dataframeHeaderTextColor` | 1.4.3 | ≥ 4.5:1 | Page, secondary / sidebar, dataframe header (stock fill when unset) |
| Link text | `linkColor` / `blueTextColor` | 1.4.3 | ≥ 4.5:1 | Page, secondary / sidebar |
| Code text on code fill | Inline `codeTextColor` on `codeBackgroundColor` | 1.4.3 | ≥ 4.5:1 | Code background |
| Status text on status fill | Shipped `*TextColor` on `*BackgroundColor`; `primary` on `primarybg` | 1.4.3 | ≥ 4.5:1 | Alert / badge / metric fills on **page and default sidebar** (fills are translucent) |
| Label on primary fill | `white` (or equivalent) on `primaryColor` | 1.4.3 | ≥ 4.5:1 | Primary buttons and other primary-filled controls |
| Primary as **text** | `primaryColor` used for copy | 1.4.3 | ≥ 4.5:1 | Page (and any surface where primary is used as text) |
| Primary as **control** | `primaryColor` fill / outline | 1.4.11 | ≥ 3:1 | Page **and** default sidebar (`secondaryBackgroundColor` when sidebar bg is unset) |
| Control border | `borderColor`; checkbox/radio indicator stroke | 1.4.11 | ≥ 3:1 | Defining strokes that use the border token (see [Theme config notes](#theme-config-notes)) |
| Dataframe border | Default `dataframeBorderColor` (stock hex when unset) | 1.4.11 | ≥ 3:1 | Page and stock dataframe-header fill |
| Toggle off track | `fadedText10` via `getToggleTrackColor` | 1.4.11 | ≥ 3:1 | Page and secondary / widget fill |
| Focus indicator | Soft or solid focus ring when it is the sole indicator | 1.4.11 | ≥ 3:1 | Adjacent background |
| Icon stroke (library chrome) | Often muted / derived paint | 1.4.11 | ≥ 3:1 | Header, toolbar, link/help icons |
| Tertiary pressed / open label | `getTertiaryActiveColor` (darken/lighten `primary`) | 1.4.3 | ≥ 4.5:1 | Page (`bgColor`) |

Icon strokes do not use opaque `darkenedBgMix100`. Shell code only mixes it translucently (for example, dataframe hover). The opaque token is about 2.2–2.5:1 on the light page, under the 3:1 icon floor, so leave it out of the icon-stroke pass.

Surfaces for pairings: `backgroundColor` (page), `secondaryBackgroundColor` (secondary / default sidebar / many widgets), and role-specific fills (code, status, and the stock dataframe-header / code backgrounds when those keys are unset).

## Known library gaps

Sorted Level A then Level AA, and by success-criterion number within each level. Each item is a candidate product-spec section or raise-default fix. Prefer raising defaults over new color APIs (recommendation of this inventory, not a closed product decision).

### Level A

- **2.1.1 Sidebar collapse control is hover-revealed.** Above the `sm` breakpoint the collapse control uses `visibility: hidden` until pointer hover (`StyledCollapseSidebarButton` / `showSidebarCollapse`); there is no keyboard shortcut to collapse. Expand from the header remains available when collapsed. See [Sidebar chrome](#sidebar-chrome).
- **2.1.1 Sidebar nav section headers are pointer-only.** `NavSection` renders `StyledSidebarNavSectionHeader` as a `<header onClick={onToggle}>` with no button role, tab stop, or key handler, so keyboard users cannot expand or collapse a section. See [Page navigation](#page-navigation).
- **2.4.3 Collapsed sidebar stays in the tab and assistive-technology order.** Collapsed chrome uses `translateX` off-screen without `inert` / `aria-hidden` on the sidebar section, so Tab and assistive technology can still reach focusable descendants while the sidebar is off-screen. See [Sidebar chrome](#sidebar-chrome).
- **4.1.2 Sidebar nav section toggles lack name/role/state.** The same `NavSection` headers have no button role and no `aria-expanded`; `isExpanded` only drives styling and whether children render. See [Page navigation](#page-navigation).
- **4.1.2 `st.toast` alertdialog has no accessible name.** React Aria `useToast` sets `aria-labelledby` to a title id that `StreamlitToastItem` never mounts; close-button “Close” does not name the toast. See [Toast / skills nudge](#toast--skills-nudge).

### Level AA

- **1.4.3 Status text on translucent status fills fails on the page and/or default sidebar.** Fills are translucent: 10% opacity in light and 20% in dark (`primarybg`: 10% / 30%). See the [1.4.3 scorecard](#143-contrast-minimum) for per-color results. Call sites: markdown badges, metric deltas (`getMetricTextColor` / `getMetricBackgroundColor`), and `AlertContainer`.
- **1.4.3 `primary` as text fails 4.5:1 on the dark page and on dark secondary / default sidebar.** Light primary on the light page and light secondary meets 1.4.3. Includes the file-uploader drag overlay. See the [1.4.3 scorecard](#143-contrast-minimum). Separate from primary-on-`primarybg` status fills.
- **1.4.3 Named markdown text colors can fail 4.5:1 as plain text** (for example `:orange[…]` on the light page / sidebar). Distinct from text-on-status-fill. See the [1.4.3 scorecard](#143-contrast-minimum).
- **1.4.11 Control borders use opaque `borderColor` (light `#DCD8D4`, dark `#4A4742`), about 1.4:1 on the light page and about 2.0:1 on the dark page, below 3:1.** Affects unchecked checkbox/radio indicator strokes, default widget outlines (`showWidgetBorder` on unless set to false), and other chrome that uses `borderColor`. When the author sets `theme.borderColor`, an unset dataframe border follows `borderColorLight` (`transparentize(borderColor, 0.55)`), not the full `borderColor` (see [Theme config notes](#theme-config-notes)).
- **1.4.11 Stock `dataframeBorderColor` (light `#E8E5E2`, dark `#3A3834`) fails 3:1** on the page (~1.25 light / ~1.55 dark) and is weaker still against the stock header fill. Separate from `borderColor`; see the [1.4.11 scorecard](#1411-non-text-contrast).
- **1.4.11 Off `st.toggle` track (`fadedText10`) fails 3:1** (~1.5 light / ~1.8 dark on page and secondary). Independent of `borderColor` (`getToggleTrackColor`); see the [1.4.11 scorecard](#1411-non-text-contrast).
- **1.4.11 Default soft focus rings fail 3:1.** Soft `focusRing` / `focusRingMuted` measure ≈ 1.5–2.2:1. Solid `focusRingOutline` (`primary`) meets 1.4.11 on the page and default sidebar. Soft rings still count as a **2.4.7** indicator when drawn; their contrast failure stays here under **1.4.11**.
- **1.4.11 Enabled close icons that paint `fadedText40` fail 3:1 in light.** Toast and skills-nudge close controls; dark meets. See the [1.4.11 scorecard](#1411-non-text-contrast).
- **2.4.7 Unlocked element / dataframe toolbars stay at `opacity: 0` under keyboard focus of their buttons.** `StyledToolbarWrapper` shows on wrapper `:hover` / `:focus-visible` and parent `:focus-visible`, but not `:focus-within`, so Tab into a toolbar action can leave the control focused and invisible ([#17337](https://github.com/streamlit/streamlit/issues/17337)). See [Element toolbar](#element-toolbar) and [Dataframe toolbar](#dataframe-toolbar).
- **2.4.7 Sidebar and toast View more/less buttons clear focus styling.** `StyledViewButton` sets `outline` / `boxShadow` to `none` on `:focus` with no replacement indicator (`Navigation/styled-components.ts`, `Toast/styled-components.tsx`). Distinct from soft-ring **1.4.11** contrast failures. See [Page navigation](#page-navigation) and [Toast / skills nudge](#toast--skills-nudge).
- **4.1.3 `st.toast` is not announced as a status message.** React Aria’s toast region is a `role="region"` landmark (not live). Announcing `role="alert"` / `aria-atomic` props live on `contentProps` / `ToastContent`, which `StreamlitToastItem` never renders — so not moving focus is not enough for **4.1.3**. The skills nudge does meet (`role="status"` + `aria-live="polite"`). See [Toast / skills nudge](#toast--skills-nudge).
- **2.5.8 Heading link icon and default help tooltip triggers are ~16×16 CSS px** (`iconSizes.base`, no 24px minimum hit box). This inventory scores the CSS box only. Heading link and heading help are 16px targets with an 8px (`spacing.sm`) gap, so the 24px spacing circles are tangent. Main-menu trigger, sidebar expand/collapse, and element toolbar actions ([#17211](https://github.com/streamlit/streamlit/pull/17211)) meet 2.5.8 at the default 16px root.
- **2.5.8 Visible checkbox, radio, and toggle labels, plus collapsed checkbox/toggle tracks, are under 24×24 CSS px.** Label paragraphs inherit `fontSizes.sm` (14px) from `isLabel`; see the [2.5.8 scorecard](#258-target-size-minimum).

## Current defaults

Live scorecard for today’s default light and dark themes. Floors above are the gate; these tables are measured results.

### 1.4.3 Contrast (Minimum)

| Role | Light | Dark | Bucket | Note |
| ---- | ----- | ---- | ------ | ---- |
| Secondary / muted UI text (`fadedText70`, dataframe header) | Pass (~5.24 page / ~5.08 secondary / ~5.05 header) | Pass (~6.6–7.9) | Library meets | Includes default `dataframeHeaderTextColor`. `grayTextColor` is opaque and also passes on stock themes |
| White label on primary fill | Pass (~5.18) | Pass (~4.62) | Library meets | `StyledPrimaryButton` and similar (`#C53948` / `#CF4250`) |
| Tertiary pressed / open label (`getTertiaryActiveColor`) | Pass (~12.1 page) | Pass (~6.6 page) | Library meets | Pressed tertiary buttons and open popover / menu triggers ([#17916](https://github.com/streamlit/streamlit/pull/17916)). Picks `darken(primary, 0.25)` or `lighten(primary, 0.15)` by contrast vs `bgColor`. Distinct from resting primary-as-text |
| `primary` as **text** | Pass page ~5.18; pass secondary ~4.88 | Fail page ~3.92; fail secondary ~3.06 | Library blocks (dark) | File-uploader drag overlay is primary on `secondaryBg`. Not primary-on-`primarybg` |
| Status text on status fill — **page** | Fail (see per-color table) | Fail (see per-color table) | Library blocks | Translucent fills on page bg; badges, metrics, `AlertContainer` |
| Status text on status fill — **default sidebar** | Fail (see per-color table) | Fail (see per-color table) | Library blocks | Same fills composited onto sidebar `secondaryBackgroundColor` |
| Body text on page / secondary | Pass (~12.5 / 11.2) | Pass (~18.1 / 14.2) | Library meets | |
| Link text | Pass (~7.5 page / ~6.7 secondary) | Pass (~6.6 page / ~5.2 secondary) | Library meets | Markdown / in-app links |
| Named markdown text color (`:orange[…]` and similar) | Fail orange ~3.42 page / ~3.05 secondary; yellow/green fail on secondary only (~4.29 / ~4.38) | Pass for orange/yellow/green on page | Library blocks | Unfilled color directives as plain text; not the status-fill table |
| Inline `codeTextColor` on `codeBackgroundColor` | Pass (~12+ on stock fills) | Pass (~12+ on stock fills) | Library meets | Stock code text matches body text on the built-in code fill. Block syntax tokens in `StyledPre` are not scored here |

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

`fadedText40` measures ~2.2:1 (light) and ~3.7:1 (dark). 1.4.3 exempts inactive (disabled) components, so this is not a Library blocks row. It is recorded so enabled UI that reuses `fadedText40` still gets caught. Disabled empty text fields (TextInput, NumberInput, TextArea, ChatInput, Multiselect, Selectbox) also paint placeholders with `fadedText40`; enabled placeholders stay on `fadedText70`.

### 1.4.11 Non-text Contrast

| Role | Light | Dark | Bucket | Note |
| ---- | ----- | ---- | ------ | ---- |
| Control border (`borderColor`) | Fail (~1.4) | Fail (~2.0) | Library blocks | Opaque stock `#DCD8D4` / `#4A4742`. Includes unchecked checkbox/radio strokes and default widget outlines (`showWidgetBorder` on) |
| Dataframe border (`dataframeBorderColor`) | Fail (~1.25 page / ~1.2 header) | Fail (~1.55 page / ~1.2 header) | Library blocks | Stock `#E8E5E2` / `#3A3834`. Separate key from `borderColor`; weaker against the stock header fill than against the page |
| Soft focus ring (`focusRing`) | Fail (~1.9) | Fail (~2.2) | Library blocks | Sole focus indicator on many controls |
| Soft muted focus ring (`focusRingMuted`) | Fail (~1.5) | Fail (~1.8) | Library blocks | Header icon buttons, main menu, sidebar nav, skills nudge. `focusRingSubtle` is defined in `getShadows.ts` and unused (unscored on purpose) |
| Off toggle track (`fadedText10`) | Fail (~1.5) | Fail (~1.8) | Library blocks | `getToggleTrackColor` off rest / disabled. Independent of `borderColor`. Selected track uses `primary` (sidebar / page primary-as-control rows) |
| Primary as control on default sidebar | Pass (~4.88) | Pass (~3.53) | Library meets | Sidebar page background is `#F8F8F7` / `#21201D` (Pass ~4.88 / ~3.53) |
| Input boundary with `showWidgetBorder = false` | Fail (~1.12) | Fail (~1.27) | Library blocks | Opt-out: resting outline is `secondaryBg` on page (`getBorderColor`). Default (flag unset/true) uses `borderColor` (row above) |
| Enabled close icon (`fadedText40`) | Fail (~2.2) | Pass (~3.7) | Library blocks | `StyledCloseButton` (toast) and `StyledSkillsNudgeClose` on toast / nudge card (`bgColor`) |
| Muted icon stroke (`fadedText60`) | Pass (~3.8–3.9) | Pass (~5.3–6.1) | Library meets | Header, toolbar, and link/help icons (page ~3.89, secondary ~3.81). Heading link (`StyledLinkIcon`) stays at `opacity: 0` until hover/focus; the reported ~1.16:1 in [#16149](https://github.com/streamlit/streamlit/issues/16149) matches that hidden state. When shown, the stroke is ~3.9:1 light / ~6.1:1 dark — not a default 1.4.11 fail |
| Primary as control / solid focus outline on page | Pass (~5.18) | Pass (~3.92) | Library meets | Page background only |

### 2.4.1 Bypass Blocks

| Mechanism | Bucket | Note |
| --------- | ------ | ---- |
| Main landmark + skip link + page-nav landmark | Library meets | `<main>` (`stMain`); skip link “Skip to main content” moves focus into main; named page-navigation landmark (`aria-label="App pages"`) when multipage nav is shown ([#17418](https://github.com/streamlit/streamlit/pull/17418)). Does not claim full multipage or host-chrome bypass coverage |

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

## Shared shell surfaces

Library-owned **app frame** regions (not author `st.*` content inside the sidebar or main). Rows that reuse a contrast or hit-target measurement link to it above instead of measuring it again. This section’s non-text table also notes a few shared widget-paint tracks that reuse theme tokens. Host chrome such as the Community Cloud toolbar remains **Not this surface**.

### App header / top nav chrome

Header toolbar, logo slot, and header icon buttons (including **Expand sidebar**). Multipage links that live in the header are under [Page navigation](#page-navigation). Deploy / host actions that are not Streamlit library chrome are **Not this surface**.

| Criterion | Level | Status | Notes |
| --------- | ----- | ------ | ----- |
| 2.1.1 Keyboard | A | Library meets | Header controls are native buttons / links (e.g. `stExpandSidebarButton`). |
| 2.4.1 Bypass Blocks | A | Library meets | Skip link + landmarks scored under [2.4.1](#241-bypass-blocks) ([#17418](https://github.com/streamlit/streamlit/pull/17418)). |
| 2.4.3 Focus Order | A | Library meets | Header sits in document order ahead of main; no known library reorder. |
| 4.1.2 Name, Role, Value | A | Library meets | Icon-only header actions carry accessible names (e.g. “Expand sidebar”, “Main menu”) ([#17170](https://github.com/streamlit/streamlit/pull/17170)). |
| 1.4.11 Icon stroke | AA | Library meets | Muted header icons use `fadedText60` on stock themes — see [1.4.11](#1411-non-text-contrast). |
| 2.4.7 Focus Visible | AA | Library meets | Soft `focusRingMuted` is drawn on header icon buttons; contrast of that ring fails **1.4.11** (~1.5–1.8:1) — see [1.4.11](#1411-non-text-contrast). |
| 2.5.8 Target Size | AA | Library meets | Sidebar expand / main-menu trigger use `headerItemHeight` (28px at 16px root); custom `theme.baseFontSize` that shrinks rem targets is **Author must**. |

### Main menu

Trigger (`stMainMenuButton`) and popover panel (`role="menu"` / `menuitem`).

| Criterion | Level | Status | Notes |
| --------- | ----- | ------ | ----- |
| 2.1.1 Keyboard | A | Library meets | Trigger is a button; panel exposes menu semantics and keyboard activation. |
| 2.4.3 Focus Order | A | Library meets | Opening the menu moves focus into the panel. Escape and pointer dismiss return focus to the trigger. Without a version footer, Tab / Shift+Tab move to the adjacent tab stop. When `streamlitVersion` is present, Tab and Shift+Tab from a menu item both move to the version CopyButton (a two-stop cycle); only forward Tab from that button exits. |
| 4.1.2 Name, Role, Value | A | Library meets | Trigger `aria-label="Main menu"`; panel `role="menu"` with `menuitem` / `menuitemradio` rows (theme group labeled). |
| 2.4.7 Focus Visible | AA | Library meets | Soft muted focus styling is drawn; contrast fails **1.4.11** on stock themes — see [1.4.11](#1411-non-text-contrast). |
| 2.5.8 Target Size | AA | Library meets | Same `headerItemHeight` row as above. |

### Sidebar chrome

Expand/collapse chrome and collapsed-state behavior only. Author widgets rendered **inside** the sidebar stay on the [command inventory](accessibility-wcag.md) (and the future widget pass).

| Criterion | Level | Status | Notes |
| --------- | ----- | ------ | ----- |
| 2.1.1 Keyboard | A | Library blocks | Above the `sm` breakpoint, **Collapse** uses `visibility: hidden` until pointer hover (`StyledCollapseSidebarButton` / `showSidebarCollapse`); there is no keyboard shortcut to collapse. On small viewports the control stays visible. **Expand** remains keyboard-operable from the header when collapsed. |
| 2.4.3 Focus Order | A | Library blocks | Collapsed sidebar uses `transform: translateX(...)` with `min/max-width: 0` but is not marked `inert` / `aria-hidden`, so Tab and assistive technology can still reach focusable descendants while the sidebar is off-screen (`StyledSidebar`). |
| 4.1.2 Name, Role, Value | A | Library meets | Sidebar `aria-label="Sidebar"`; collapse `aria-label="Collapse sidebar"` with `aria-expanded` / `aria-controls`; expand `aria-label="Expand sidebar"`. |
| 2.4.7 Focus Visible | AA | Library meets | When the collapse control is shown, soft muted focus is drawn; contrast fails **1.4.11** — see [1.4.11](#1411-non-text-contrast). Hover-gated reachability is scored under **2.1.1**, not here. |
| 2.5.8 Target Size | AA | Library meets | Collapse / expand share `headerItemHeight` sizing at the default root. |

### Page navigation

Sidebar multipage nav and header **top nav** / overflow menus. Landmark coverage is also under [2.4.1](#241-bypass-blocks).

| Criterion | Level | Status | Notes |
| --------- | ----- | ------ | ----- |
| 2.1.1 Keyboard | A | Library blocks | Sidebar nav **section headers** (`NavSection` / `StyledSidebarNavSectionHeader`) toggle only via `onClick` — no button role, tab stop, or key handler. Page links and top-nav section menus are keyboard-operable ([#17423](https://github.com/streamlit/streamlit/pull/17423)). |
| 2.4.1 Bypass Blocks | A | Library meets | Named `navigation` landmark `aria-label="App pages"` when multipage nav is shown ([#17418](https://github.com/streamlit/streamlit/pull/17418)). |
| 2.4.3 Focus Order | A | Library meets | Top-nav Tab / Shift+Tab dismiss moves to the adjacent tab stop. Collapsed-sidebar tab order is scored under [Sidebar chrome](#sidebar-chrome). |
| 4.1.2 Name, Role, Value | A | Library blocks | Sidebar nav **section toggles** have no button role and no `aria-expanded` (`NavSection`). Page links expose names from page titles; top-nav overflow uses `role="menu"` / `menuitem` where applicable. |
| 2.4.7 Focus Visible | AA | Library blocks | Sidebar **View more/less** (`StyledViewButton`) clears `outline` / `boxShadow` on focus with no replacement indicator. Soft muted rings on other sidebar / top-nav controls are drawn (contrast under **1.4.11**); page links use a background change rather than that ring. |

### Dialogs / popovers / menus

`st.dialog` / app `Modal` (React Aria), `st.popover`, main-menu and top-nav menus. Focus containment differs by overlay; this table scores the shared primitives (`Modal`, popover, menus).

| Criterion | Level | Status | Notes |
| --------- | ----- | ------ | ----- |
| 2.1.1 Keyboard | A | Library meets | Modals dismiss with keyboard when closeable; popover trigger is a button; menu keyboard paths match [Main menu](#main-menu). |
| 2.4.3 Focus Order | A | Library meets | React Aria `ModalOverlay` contains focus while open and restores it on close. `closeable` gates outside-click and Escape dismiss (`isDismissable` / `isKeyboardDismissDisabled`); it does not affect focus containment. `st.popover` returns focus to its trigger on Escape; an outside click closes without moving focus. Full audit of every portaled overlay is not claimed. |
| 4.1.2 Name, Role, Value | A | Library meets | Dialogs expose dialog semantics via the shared Modal; popover trigger is named from the author label (**Author must** for useful label text); menus as under Main menu / Page navigation. |
| 2.4.7 Focus Visible | AA | Library meets | Soft rings are drawn on many triggers / items (contrast under **1.4.11**); solid `focusRingOutline` paths meet contrast when used. |

### Toast / skills nudge

`st.toast` (React Aria `ToastRegion`) and the skills nudge card.

| Criterion | Level | Status | Notes |
| --------- | ----- | ------ | ----- |
| 2.1.1 Keyboard | A | Library meets | Close / nudge actions are keyboard-operable buttons. |
| 4.1.2 Name, Role, Value | A | Library blocks | Close controls expose accessible names (e.g. “Close”). `st.toast` itself uses `role="alertdialog"` with `aria-labelledby` pointing at a title id that `StreamlitToastItem` never mounts, so the toast has no accessible name. Skills nudge content is named in the status region. |
| 1.4.3 Body text | AA | Library meets | Nudge / toast copy uses body or muted text tokens already covered by the **1.4.3** secondary/muted row when those tokens apply. |
| 1.4.11 Close icon | AA | Library blocks (light) | Enabled close paints `fadedText40` (~2.2:1 light / ~3.7:1 dark). |
| 2.4.7 Focus Visible | AA | Library blocks | Toast **view more/less** (`StyledViewButton`) clears outline / border / shadow on focus with no replacement indicator. Soft `focusRing` on the toast card / close control and skills-nudge `focusRingMuted` are drawn (contrast under **1.4.11**) but do not identify the focused view-more action. |
| 4.1.3 Status Messages | AA | Library blocks | Skills nudge meets (`role="status"` + `aria-live="polite"`). `st.toast` does not: the React Aria toast region is a landmark, not a live region, and `StreamlitToastItem` never renders `ToastContent`, so announcing `role="alert"` / `aria-atomic` props never reach the DOM. Not moving focus alone does not satisfy **4.1.3**. |

### Element toolbar

Streamlit element toolbar (Fullscreen, Download, …). Naming detail for commands that use it also lives under [Shared chrome](accessibility-wcag.md#shared-chrome) on the command inventory.

| Criterion | Level | Status | Notes |
| --------- | ----- | ------ | ----- |
| 2.1.1 Keyboard | A | Library meets | Actions are buttons; reachable by Tab when present. |
| 4.1.2 Name, Role, Value | A | Author must | Generic action names always exist; a distinctive name needs non-blank `alt`, or a single image’s rendered caption ([#17211](https://github.com/streamlit/streamlit/pull/17211)). |
| 2.4.7 Focus Visible | AA | Library blocks | Unlocked toolbars default to `opacity: 0` and `StyledToolbarWrapper` does not reveal on `:focus-within`, so keyboard focus on an action can leave it invisible (same root cause as [#17337](https://github.com/streamlit/streamlit/issues/17337)). |
| 2.5.8 Target Size | AA | Library meets | `max(1.5rem, 24px)` ([#17211](https://github.com/streamlit/streamlit/pull/17211)). |

### Dataframe toolbar

Overlay toolbar on `st.dataframe` / `st.data_editor` (Show/hide columns, Download, Search, Fullscreen). Grid keyboard / status gaps stay on the [command inventory](accessibility-wcag.md).

| Criterion | Level | Status | Notes |
| --------- | ----- | ------ | ----- |
| 2.1.1 Keyboard | A | Library meets | Toolbar actions are buttons (column ⋮ menu remains a separate **Library blocks** on the command inventory — [#13332](https://github.com/streamlit/streamlit/issues/13332)). |
| 4.1.2 Name, Role, Value | A | Author must | Generic action names always exist; a distinctive name needs non-blank dataframe `alt`. |
| 2.4.7 Focus Visible | AA | Library blocks | Same unlocked `opacity: 0` without `:focus-within` as element toolbar ([#17337](https://github.com/streamlit/streamlit/issues/17337)). |
| 2.5.8 Target Size | AA | Library meets | Same `max(1.5rem, 24px)` toolbar actions. |

### Shared non-text chrome

This table groups recurring tracks and rules that share the same 1.4.11 non-text-contrast analysis, including a few shared widget-paint tokens. Prefer the measured [1.4.11](#1411-non-text-contrast) table when a token is already scored.

| Surface | Criterion | Status | Notes |
| ------- | --------- | ------ | ----- |
| Inactive tab underline | 1.4.11 | Deferred | Paints `borderColorLight` (weaker than stock `borderColor`). Tabs are also identified by their text, and the selected tab uses a `primary` indicator, so it is unclear whether this base line is required to identify the control. |
| Dividers / separators using border paint | 1.4.11 | Deferred | Decorative separators (for example `st.divider`) are generally exempt from 1.4.11. Keep measured **control border** failures under the [1.4.11](#1411-non-text-contrast) scorecard when the stroke defines a control. |
| Slider unfilled track | 1.4.11 | Deferred | Shared widget paint (not app-frame chrome). Unfilled segment paints `darkenedBgMix25` (`StyledSliderTrackLine`); not separately measured here. Filled segment uses `primary` (see primary-as-control rows). |
| Progress / meter track | 1.4.11 | Deferred | Shared widget paint. The track paints `secondaryBg`; the fill paints `secondary` (`ProgressBar`); not separately measured here. |
| Streamlit-styled scrollbars | 1.4.11 | Deferred | Library paints transparent resting scrollbars and `fadedText40` hover thumbs (`globalStyles.ts` `scrollbar-color` / WebKit thumb styles), including in the sidebar. Not measured here. |
| Unmodified OS / browser scrollbars | 1.4.11 | Not this surface | Native rendering only where Streamlit does not override scrollbar paint. |

## Theme config notes

Core color keys (`primaryColor`, `textColor`, `linkColor`, `borderColor`, status `*Color` / `*TextColor` / `*BackgroundColor`, code colors, backgrounds) map directly to the [floors](#default-theme-floors) and [scorecards](#current-defaults) above. Only the quirks below need extra explanation.

### Dataframe header and border

When unset:

- `dataframeHeaderTextColor` → faded `textColor` (`fadedText70`) — meets **1.4.3** on default light/dark with other secondary/muted UI text
- `dataframeHeaderBackgroundColor` → stock chrome hex (light `#F7F7F6`, dark `#2D2B27`) while surfaces and `primaryColor` stay on the built-in palette. If any of those differ and this key is unset, the header fill is `bgMix`
- `dataframeBorderColor` → stock chrome hex (light `#E8E5E2`, dark `#3A3834`). When the author sets `theme.borderColor` and leaves `dataframeBorderColor` unset, dataframe borders follow `borderColorLight` (`transparentize(borderColor, 0.55)`)
- Off `st.toggle` track uses `fadedText10` via `getToggleTrackColor`, not `borderColor`. A custom `theme.borderColor` does not restyle it. Off-track contrast fails **1.4.11** on stock themes (scorecard row). Selected tracks use `primary` (sidebar / page primary-as-control rows).

### `showWidgetBorder`

Default is **on** (unset or `true` paints `widgetBorderColor` from the resolved `borderColor`). Set `showWidgetBorder = false` to hide input outlines; many inputs then fall back to `secondaryBg` (`getBorderColor`).

Checkbox/radio **indicator** strokes and other chrome that always use `borderColor` still fail **1.4.11** at the stock opaque hex. Authors who raise `borderColor` strengthen both indicators and default widget outlines together.

`showSidebarBorder` defaults **on** and only toggles the sidebar separator; it was not measured as its own row (separator uses border-family paint when shown).

### Author must / out of scope on this page

- **Author must** — custom `theme.*` overrides (including `theme.baseFontSize` that shrinks rem-based header hit targets below 24px); chart mark palettes (`chartCategoricalColors`, `chartSequentialColors`, `chartDivergingColors`); distinctive element-toolbar names via `alt` / caption. Chart encodings are also covered in the [command inventory](accessibility-wcag.md).
- **Not this surface** — host chrome such as the Community Cloud toolbar; unmodified OS / browser scrollbars (Streamlit-styled scrollbar thumbs are **Deferred** under [Shared non-text chrome](#shared-non-text-chrome)).
- **Not scored here** — fonts / `fontFaces` / sizes / weights (later shell pass, e.g. 1.4.4); radii (`baseRadius`, `buttonRadius`); `theme.base` inheritance paths (audit resolved defaults, not every override file); page-level **1.4.4 / 1.4.10 / 1.4.12 / 2.4.2 / 2.4.11 Focus Not Obscured / 3.1.1**.
