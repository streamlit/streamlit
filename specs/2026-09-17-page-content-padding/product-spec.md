---
author: mayagbarnes
created: 2026-09-17
---

# Configurable page content padding

## Summary

Provide more app layout flexibility by allowing app authors to reduce (or increase) the
blank spacing around the main content area (and optionally the sidebar) — especially the
large top margin users complain about — through **advanced theming** in
`.streamlit/config.toml`, with optional overrides under `[theme.sidebar]`.

Today a non-embedded app always pads the main block container by **6rem** (or **8rem**
with top nav) on top and **10rem** on the bottom (`1rem` when `st.bottom` is present),
which wastes vertical space on dense dashboards. Authors currently hack this with fragile
CSS. This spec adds first-class theme options instead of the original
`st.set_page_config(margin_*)` proposal.

```toml
[theme]
paddingTop = "1.5rem"
paddingBottom = "2rem"

[theme.sidebar]
paddingTop = "1rem"
paddingBottom = "1rem"
```

This proposal addresses [#6336](https://github.com/streamlit/streamlit/issues/6336), a
Planned issue with 103 👍 reactions.

## Decisions for review

Items 1–5 are the proposed contract. The only unresolved design is
[left/right](#leftright-fast-follow-open).

1. **[API surface](#api-surface)** — prefer advanced theming, not `st.set_page_config`.
2. **[Which properties](#which-properties)** — top + bottom this ship; left/right as a
   named fast follow after the layout pass below.
3. **[Option naming](#option-naming)** — prefer `paddingTop` / `paddingBottom`;
   alternative `appPadding*`; reject `mainPadding*`.
4. **[Sidebar support](#sidebar-support)** — yes, via `[theme.sidebar]`; main padding does
   not leak into the sidebar.
5. **[How values compose](#how-values-compose)** — same rule on main and sidebar: the
   author gap from chrome to content (top) or the aesthetic inset (bottom). Main top still
   clears the real header; sidebar top hits exactly one property; neither bottom reserves
   space for a footer or host overlay.

## Problem

### Motivation / demand

[#6336](https://github.com/streamlit/streamlit/issues/6336) asks to reclaim ~100px+ above
page content so dense apps fit more before scrolling. Long-running, high-vote
layout/styling ask on the **Planned** milestone.

A maintainer proposed a “tight” layout mode
([comment](https://github.com/streamlit/streamlit/issues/6336#issuecomment-1487761420)),
and the issue author agreed that reduced aesthetic margins would solve their problem.
Later commenters still want an official knob because CSS hacks break across releases.

### What authors get today

Hardcoded main block-container padding in `StyledAppViewBlockContainer`:

| Context | Typical `padding-top` | Typical `padding-bottom` |
| ------- | --------------------- | ------------------------ |
| Non-embedded | `6rem` (`8rem` with top nav). Ignores both props below | `10rem` when no `st.bottom`, else `1rem` (`spacing.lg`) |
| Embedded | `6rem` if `showPadding` or `showToolbar`; else `4.5rem` if header or sidebar chrome; else `2.25rem` | `10rem` only if `showPadding` and no `st.bottom`; otherwise `1rem` |

Those columns use the props passed into `StyledAppViewBlockContainer`, not URL option strings.

`showPadding` is `!isEmbed() || isPaddingDisplayed()` (`embed_options=show_padding`). It is
always true outside embeds, so the `10rem` bottom path is the normal-app default. The
styled-component field is named `bottomEmbedPadding`; do not read that name as embed-only.
`showToolbar` is not the URL `show_toolbar` option. It is
`(!isEmbed() || isToolbarDisplayed()) && hasContentToShow`. `hasContentToShow` is false
only when `toolbarMode` is `minimal` and there are no host or app menu/toolbar items, so
an embed can request `show_toolbar` and still take the `4.5rem` / `2.25rem` top path.
`showToolbar` does not affect bottom padding.

Side padding is `theme.spacing.lg` (or `theme.sizes.wideSidePadding` in wide mode on
large screens). Sidebar user content uses `paddingTop: spacing.twoXL` when page nav is
above the user content, otherwise `0`, and `paddingBottom: sizes.sidebarTopSpace`
(`6rem`) — also not configurable. Above that, `StyledSidebarHeaderContainer` still
contributes `headerHeight` plus `spacing.lg` bottom margin. No public theme or
page-config option covers any of this.

### Workarounds today

CSS against private classes (`.block-container`, `.stMainBlockContainer`, emotion hashes):

- Breaks when class names or padding logic change
- Can clip content under the header when top padding is too low
  ([example](https://github.com/streamlit/streamlit/issues/6336#issuecomment-1478146883))
- Ignores embed / top-nav / toolbar branching

Hiding chrome (`client.toolbarMode`, hidden `ui.hideTopBar`) does not reclaim
block-container inset.

### Use cases

1. Dense internal dashboards — vertical stack of tables/filters/charts
2. Kiosk / wallboard / TV layouts — maximize viewport
3. Embedded apps — host height already tight
4. Sidebar-heavy apps — same wasted top space in the sidebar

### Related issues

| Issue | Role |
| ----- | ---- |
| [#6336](https://github.com/streamlit/streamlit/issues/6336) | Primary ask |
| [#5466](https://github.com/streamlit/streamlit/issues/5466) | Layout width / max content width — may pair with left/right fast follow |
| [#14172](https://github.com/streamlit/streamlit/issues/14172) | Runtime theme mutation — out of scope |

## Proposal

### API surface

**Option 1: Advanced theming** ✅ PREFERRED — see Summary TOML.

- Pros: Principle 38; sidebar section; app-wide; no new Python API
- Cons: Not per-page; config.toml discoverability; restart semantics like other theme keys

**Option 2: `st.set_page_config(margin_*)`** (original ask)

```python
st.set_page_config(margin_top=20, margin_bottom=50)
```

- Pros: Discoverable next to `layout`; theoretically per-page
- Cons: Mixes appearance with page identity; awkward with theme sections; pixel ints vs
  rem theme sizing; grows a broad command

**Option 3: Density / layout preset only** (`layout="tight"` or `theme.density = "compact"`)

- Pros: Tiny API; matches “tight layout” framing; hard to misconfigure into clipping
- Cons: No fine control; sidebar still separate

**Recommendation:** Option 1. Option 3 only if review wants a smaller first ship; theming
keys are the durable end state once chrome-composition rules exist.

### Which properties

| Property | This ship? | Rationale |
| -------- | ---------- | --------- |
| Top | ✅ | Core of #6336 |
| Bottom | ✅ | Lets authors change the large aesthetic bottom inset (`10rem` when no `st.bottom`) |
| Left / right | 🔜 fast follow | Needs layout-interaction decisions below |
| Element / widget gap | ❌ out of scope | Gap tokens, not page chrome |

**This ship:** top + bottom. **Fast follow:** `paddingLeft` / `paddingRight` or
`paddingX` (same naming pattern), after the pass below — not indefinite deferral, and not
invented ad hoc in the implementation PR.

#### Left/right fast follow (open)

Today `layout` owns horizontal space:

| Layout | Side padding today |
| ------ | ------------------ |
| `centered` | `spacing.lg` inside fixed `contentMaxWidth` (736px) |
| `wide` | On large viewports, jumps to `wideSidePadding` (5rem) so wide never offers *less* content width than centered |

Before shipping side keys, decide:

1. **Replace which gutters?** (A) base only — wide bump still wins and looks broken;
   (B) all side padding — may break wide≥centered; (C) compose with layout policy
   (`max(author, layoutRequired)` or redesign the media query). **Core call.**
2. **Gutter-only vs [#5466](https://github.com/streamlit/streamlit/issues/5466)** — side
   padding alone only shrinks the gutter inside 736px; pair with max-width if “wider
   column” is the real ask.
3. Prefer symmetric `paddingX` unless there is a concrete asymmetry need.
4. Main `paddingLeft` is gutter *inside* the main column — not sidebar width.
5. **Mins:** do **not** copy header-style overlay clearance sideways (no overlapping
   Streamlit side chrome; don’t bake host mins). **Do** decide whether layout’s
   wide≥centered rule still imposes an effective floor.

### Option naming

Theme keys are usually **unqualified**; the TOML section supplies scope. Prefixes appear
only for variants in the *same* section (`baseRadius` vs `buttonRadius`, etc.).
`mainPadding*` is wrong under `[theme.sidebar]` and has no precedent.

**Option A: `paddingTop` / `paddingBottom`** ✅ PREFERRED

| Config key | Applies to |
| ---------- | ---------- |
| `theme.paddingTop` | Main top content inset |
| `theme.paddingBottom` | Main bottom inset |
| `theme.sidebar.paddingTop` | Gap from sidebar chrome to the first sidebar widget |
| `theme.sidebar.paddingBottom` | Sidebar bottom inset |

- Pros: Matches `backgroundColor` / `borderColor`; natural under `[theme.sidebar]`;
  future `widgetPaddingTop` etc. stay available
- Cons: Bare `padding*` needs clear docs so it isn’t read as “every widget”

**Option B: `appPaddingTop` / `appPaddingBottom`**

- Pros: Signals page-shell, not widgets
- Cons: `app` is vague; `theme.sidebar.appPadding*` still sounds global; `app*` isn’t an
  existing theme prefix pattern

**Rejected:** `mainPadding*`; `marginTop` as the key (implementation is padding);
shorthand `padding = "1rem 2rem"` (harder to partial-override across sections).

**Recommendation:** A, with B if review wants a stronger “not widget padding” signal.

#### Value grammar

Accept non-negative CSS lengths in **`rem` or `px` only** (including canonical zero:
`"0"`, `"0rem"`, `"0px"`). Prefer documenting rem.

Reject negatives (would pull main content under the absolutely positioned header), `%`,
`vh`/`vw`, `calc()`, unitless non-zero numbers, and other CSS. Invalid or rejected values
log a warning and fall back to today’s default for that context (same pattern as invalid
`baseRadius`). Host-supplied themes must use the same grammar — do not forward arbitrary
CSS strings into styles.

Note: `parseFontSize` today rejects `"0rem"` / `"0px"` via a truthy check (bare `"0"`
slips through its numeric fallback and becomes `"0px"`). Padding parsing must explicitly
allow zero in all three forms.

#### Config sections (v1)

**Restrict to `[theme]` and `[theme.sidebar]` for v1.** Do **not** accept these keys under
`[theme.light]` / `[theme.dark]` (or their `.sidebar` sections) yet: per-appearance padding
would change page height on appearance toggle — layout shift that existing light/dark
options (colors, radii, fonts) do not cause. Easy to widen later; hard to narrow.

### Sidebar support

**Ship sidebar overrides in the same release** via `[theme.sidebar]`.

Today `createSidebarTheme` merges the full main `themeInput` into the sidebar, then
applies sidebar overrides. **Padding keys must be special-cased** (same pattern as
`headingFontSizes`, which is set from the sidebar input rather than inherited) so
main-area `paddingTop` / `paddingBottom` do **not** leak into the sidebar.

| Config | Effect |
| ------ | ------ |
| Neither set | Today’s main and sidebar paths (baseline above; composition tables below) |
| Only `[theme]` set | Applies to **main only**; sidebar unchanged |
| Only `[theme.sidebar]` set | Applies to **sidebar only**; main unchanged |
| Both set | Each section uses its own value |

How those values sit relative to chrome is [below](#how-values-compose). If scope must
shrink, drop sidebar to a follow-up — don’t invent a second API later.

### How values compose

Unset keeps today’s path for that context. Set replaces that path — do not add a legacy
aesthetic bump on top. Top keys are the gap under chrome that is actually there;
Streamlit still reserves that chrome. Bottom keys are aesthetic insets, not clearance.

#### Main top

`paddingTop` is the space between the bottom of Streamlit header chrome and the first
main content — not distance from the viewport top. `"0"` / `"0rem"` means flush under
the header, never overlapping it. Streamlit still clears a shown header (today
`theme.sizes.headerHeight`, `3.75rem`). CSS `padding-top` = `headerHeight` + author when
a header is shown, or the author value alone when it is not. Do not write the author
string in place of today’s `6rem` / `8rem` / embed totals.

**Regular header vs top nav:** today’s non-embedded defaults are `6rem` without top nav
and `8rem` with top nav ([#11836](https://github.com/streamlit/streamlit/pull/11836)).
That +`2rem` is a legacy aesthetic bump for a busier header, not a taller header — top
nav still lives inside the same `headerHeight` bar.

| Situation | Behavior |
| --------- | -------- |
| `paddingTop` unset | Preserve today’s policy: `6rem` vs `8rem` (and today’s embed/minimal paths) |
| `paddingTop` set | Author value is the gap, not the total. Header shown → `headerHeight` + author (no top-nav `+2rem`). No header → author alone. `"0"` with a header is flush under the bar (`headerHeight` total), never `0` on the container |

`client.toolbarMode` / `ui.hideTopBar` still choose which chrome exists; these keys do not hide it.

#### Sidebar

Same product rule as main top: `theme.sidebar.paddingTop` is the gap from sidebar chrome
to the first sidebar widget. Sidebar chrome is the header row (logo + collapse), plus
page nav when that nav is rendered above the widgets.

Main top nav lives *inside* the header, so one padding covers it. Sidebar page nav is a
*sibling* between the header row and the widgets, so the gap-before-widgets is a
different CSS property in each state. The author value is written to **exactly one** of
them — never both.

DOM order today:

1. `StyledSidebarHeaderContainer` (logo + collapse; `headerHeight` + `marginBottom: spacing.lg`)
2. optional `SidebarNav` when page nav is above
3. `StyledSidebarUserContent` (`paddingTop: spacing.twoXL` with page nav, else `0`) — first widgets

| `theme.sidebar.paddingTop` | Page nav above? | Header `marginBottom` | User-content `paddingTop` |
| -------------------------- | --------------- | --------------------- | ------------------------- |
| unset | no | `spacing.lg` | `0` |
| unset | yes | `spacing.lg` | `spacing.twoXL` |
| set | no | **author value** (gap under the logo row) | `0` |
| set | yes | `spacing.lg` (header-to-nav; not this option) | **author value** (gap under page nav) |

`"0"` means flush under the last chrome: the logo/collapse row when there is no page
nav, or under page nav when nav is above. The header row’s height is always reserved;
nav height is reserved when nav is shown. Do not also zero the other property.

`theme.sidebar.paddingBottom` is the aesthetic inset at the bottom of sidebar user
content. There is no sidebar footer and no `st.bottom` equivalent. It replaces today’s
`paddingBottom` (`sizes.sidebarTopSpace` / `6rem`) directly. `"0"` is flush with the
bottom of the sidebar content area. It does not affect main `paddingBottom` or
`st.bottom`.

#### Main bottom

There is no fixed Streamlit page footer (“Made with Streamlit” is menu-only).
`paddingBottom` replaces today’s main breathing room. Unlike top, there is no overlapping
chrome to clear — `"0"` is flush with the bottom of the main content area.

**`st.bottom`:** `theme.paddingBottom` customizes that main-area breathing room, not the
sticky container. Today, when `st.bottom` is present, main `paddingBottom` already falls
from `10rem` to `1rem` (`showPadding && !hasBottom ? "10rem" : spacing.lg`). A configured `paddingBottom` replaces that
main-area value either way; it does not restyle padding inside
`StyledBottomBlockContainer`. Sticky + spacer already prevents main content from
scrolling under `st.bottom`.

| Bottom element | Role |
| -------------- | ---- |
| Default `10rem` main bottom padding (no `st.bottom`) | Aesthetic room — what `paddingBottom` replaces when unset would have been `10rem` |
| `1rem` when `st.bottom` is present, or `showPadding` is false | Today’s shrunk path; configured `paddingBottom` still replaces main-area padding |
| `st.bottom` | Author sticky content; internals are not this option |
| Header toolbar / deploy / status | Header area, not a footer |
| Cloud “Manage app” | Host overlay in the bottom-right (~`2.75rem` tall); this API does not reserve space for it |

### Behavior

- **Defaults and inheritance:** unset preserves the paths in
  [What authors get today](#what-authors-get-today). Main keys do not flow into the
  sidebar ([Sidebar support](#sidebar-support)). v1 keys are not light/dark-scoped.
- **Host themes:** same value grammar and section rules as `config.toml`.
- **Print:** the print stylesheet replaces main `paddingTop` with an absolute `2.25rem`.
  It does not add `headerHeight` — most header chrome is hidden, and the header stays
  absolutely positioned. When `paddingTop` is set, the author value replaces that
  `2.25rem` as the entire print `paddingTop` — do not add `headerHeight`. A small value
  (`"0"`, `"0.5rem"`) may overlap a printed logo; that is accepted. Unset print is
  already below `headerHeight`, so print never cleared the full header. `paddingBottom`
  and sidebar padding are unchanged by print. No separate print API.
- **Small viewports:** the configured value applies unchanged across breakpoints
  (including mobile, where the sidebar is an overlay). No mobile-specific floor in v1.
- **No runtime Python setter** — [#14172](https://github.com/streamlit/streamlit/issues/14172)

### Examples

```toml
# Dense main area
[theme]
paddingTop = "0.5rem"
paddingBottom = "1rem"
```

```toml
# Dense main + sidebar
[theme]
paddingTop = "0.5rem"
paddingBottom = "1rem"

[theme.sidebar]
paddingTop = "0.5rem"
paddingBottom = "1rem"
```

```toml
# Airier than default (supported)
[theme]
paddingTop = "4rem"
paddingBottom = "4rem"
```

### Out of scope (future work)

- Left/right padding — [fast follow](#leftright-fast-follow-open); may pair with #5466
- Per-page padding via `st.set_page_config`
- Runtime theme mutation (#14172)
- Light/dark-scoped padding (`[theme.light]` / `[theme.dark]`)
- `footer_text` from the original issue
- Element/vertical `gap` / “remove all spacing”
- Hiding header, toolbar, or deploy button
- Author stylesheets / arbitrary CSS variables as the API
- Changing defaults for apps with no theme options
- Auto-clearing host overlays (Cloud “Manage app”, etc.)
- Restyling padding *inside* `st.bottom` via `theme.paddingBottom`
- Mobile-specific padding floors

### Design / mocks

No Figma in this PR. Visual sign-off is the implementation PR’s before/after screenshots
(and e2e snapshots): default baseline; small top/bottom with header + toolbar (no
clipping / focus-ring check at small inset); top nav with configured value (no +`2rem`
bump); sidebar overrides (including page-nav above and not); embedded minimal chrome;
host-supplied themes using the same value grammar; `st.bottom` / auto chat input; print
(including a small `paddingTop` that may overlap the logo); optional Cloud bottom-right
with near-zero `paddingBottom`.

Implementation should also add automated coverage: length parsing/fallback in
`frontend/lib/src/theme/utils.ts`, config-option tests mirroring `baseRadius`, and AppView
padding unit tests for unset `6rem`/`8rem`, set as `headerHeight` + author (author alone
with no header, no extra top-nav `+2rem`), and sidebar non-inheritance.
Screenshots supplement those assertions; they do not replace them.

## Checklist

| Item | ✅ or comment |
| ---- | ------------- |
| Works on SiS, Cloud, etc? | Yes — theme config already flows; verify host-supplied themes accept the new keys with the same grammar; document Manage-app caveat on Cloud |
| No breaking API changes | Yes — opt-in; unset preserves today’s padding |
| No new dependencies | Yes |
| Metrics collected | No — theme config keys are not individually metered; do not add telemetry for v1 |
| Any security/legal impact? | No — validated CSS length theme options only |
| Any docs changes needed? | Yes — theming docs, including `references/theme.md` in the developing-with-streamlit skill, and point #6336 workarounds at the new options |
