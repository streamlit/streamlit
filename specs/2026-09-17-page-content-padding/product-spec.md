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
with top nav) on top and a large bottom inset (~**10rem** when `st.bottom` is empty),
which wastes vertical space on dense dashboards. Authors currently hack this with fragile
CSS. This spec adds first-class theme options instead of the original
`st.set_page_config(margin_*)` proposal.

```toml
[theme]
# Exact names: outstanding decision #3
paddingTop = "1.5rem"
paddingBottom = "2rem"

[theme.sidebar]
paddingTop = "1rem"
paddingBottom = "1rem"
```

Product direction for [#6336](https://github.com/streamlit/streamlit/issues/6336)
(103 👍, Planned milestone).

## Outstanding decisions

1. **[API surface](#api-surface)** — **recommend advanced theming**, not
   `st.set_page_config` (principle 38: appearance in config, page behavior in code).
2. **[Which properties](#which-properties)** — **top + bottom this ship**; **left/right
   as a named fast follow** after a short layout-interaction pass (not blocked on #5466
   forever).
3. **[Option naming](#option-naming)** — **prefer `paddingTop` / `paddingBottom`** (section
   scopes the key). Alternative: `appPaddingTop` / `appPaddingBottom`. Reject
   `mainPadding*`.
4. **[Sidebar support](#sidebar-support)** — **recommend yes** via `[theme.sidebar]` with
   the same option names.
5. **[Header chrome composition](#how-values-compose-with-header-chrome)** —
   **content-inset for top** (gap between header chrome and first content, never
   underlapping). **When set, author `paddingTop` trumps the legacy `6rem` / `8rem`
   defaults** (including the top-nav aesthetic bump). Unset keeps today’s branching.
   Bottom is aesthetic inset + optional `st.bottom` coordination — **no** fixed Streamlit
   page footer and **no** auto-clearance for host overlays (e.g. Cloud “Manage app”).

## Problem

### Motivation / demand

[#6336](https://github.com/streamlit/streamlit/issues/6336) asks to reclaim ~100px+ above
page content so dense apps fit more before scrolling. Long-running, high-vote
layout/styling ask on the **Planned** milestone.

Johannes floated a “tight” layout mode
([comment](https://github.com/streamlit/streamlit/issues/6336#issuecomment-1487761420));
the OP accepted reduced aesthetic margins. Later commenters still want an official knob
because CSS hacks break across releases.

### What authors get today

Hardcoded main block-container padding in `StyledAppViewBlockContainer`:

| Context                    | Typical `padding-top`        | Typical `padding-bottom`        |
| -------------------------- | ---------------------------- | ------------------------------- |
| Normal app                 | `6rem` (`8rem` with top nav) | ~`10rem` when `st.bottom` empty |
| Embedded + padding/toolbar | `6rem`                       | varies                          |
| Embedded, minimal chrome   | `2.25rem`–`4.5rem`           | smaller                         |

Side padding is `theme.spacing.lg` (or `theme.sizes.wideSidePadding` in wide mode on
large screens). Sidebar top/bottom spacing is also not configurable. No public theme or
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

| Issue                                                         | Role                                                                    |
| ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [#6336](https://github.com/streamlit/streamlit/issues/6336)   | Primary ask                                                             |
| [#5466](https://github.com/streamlit/streamlit/issues/5466)   | Layout width / max content width — may pair with left/right fast follow |
| [#14172](https://github.com/streamlit/streamlit/issues/14172) | Runtime theme mutation — out of scope                                   |

## Proposal

### API surface

**Option 1: Advanced theming** ✅ PREFERRED — see Summary TOML.

- Pros: Principle 38; light/dark/sidebar sections; app-wide; no new Python API
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

| Property             | This ship?      | Rationale                                               |
| -------------------- | --------------- | ------------------------------------------------------- |
| Top                  | ✅              | Core of #6336                                           |
| Bottom               | ✅              | Same wasted-chrome complaint; large when no `st.bottom` |
| Left / right         | 🔜 fast follow  | Needs layout-interaction decisions below                |
| Element / widget gap | ❌ out of scope | Gap tokens, not page chrome                             |

**This ship:** top + bottom. **Fast follow:** `paddingLeft` / `paddingRight` or
`paddingX` (same naming pattern), after the pass below — not indefinite deferral, and not
invented ad hoc in the implementation PR.

#### Left/right fast follow (open)

Today `layout` owns horizontal space:

| Layout     | Side padding today                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| `centered` | `spacing.lg` inside fixed `contentMaxWidth` (736px)                                                           |
| `wide`     | On large viewports, jumps to `wideSidePadding` (5rem) so wide never offers _less_ content width than centered |

Before shipping side keys, decide:

1. **Replace which gutters?** (A) base only — wide bump still wins and looks broken;
   (B) all side padding — may break wide≥centered; (C) compose with layout policy
   (`max(author, layoutRequired)` or redesign the media query). **Core call.**
2. **Gutter-only vs [#5466](https://github.com/streamlit/streamlit/issues/5466)** — side
   padding alone only shrinks the gutter inside 736px; pair with max-width if “wider
   column” is the real ask.
3. Prefer symmetric `paddingX` unless there is a concrete asymmetry need.
4. Main `paddingLeft` is gutter _inside_ the main column — not sidebar width.
5. **Mins:** do **not** copy header-style overlay clearance sideways (no overlapping
   Streamlit side chrome; don’t bake host mins). **Do** decide whether layout’s
   wide≥centered rule still imposes an effective floor.

### Option naming

Theme keys are usually **unqualified**; the TOML section supplies scope. Prefixes appear
only for variants in the _same_ section (`baseRadius` vs `buttonRadius`, etc.).
`mainPadding*` is wrong under `[theme.sidebar]` and has no precedent.

**Option A: `paddingTop` / `paddingBottom`** ✅ PREFERRED

| Config key                    | Applies to             |
| ----------------------------- | ---------------------- |
| `theme.paddingTop`            | Main top content inset |
| `theme.paddingBottom`         | Main bottom inset      |
| `theme.sidebar.paddingTop`    | Sidebar top inset      |
| `theme.sidebar.paddingBottom` | Sidebar bottom inset   |

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

Values: CSS lengths (`"1.5rem"`, `"24px"`), prefer rem; invalid → warn + fall back to
today’s default (same as `baseRadius`). Allowed under `[theme]`, `[theme.light]`,
`[theme.dark]`, and corresponding `.sidebar` sections.

### Sidebar support

**Ship sidebar overrides in the same release** via `[theme.sidebar]` (and light/dark
sidebar). Same keys; unset → Streamlit’s current sidebar defaults (not necessarily the
configured main-area values). If scope must shrink, drop sidebar to a follow-up — don’t
invent a second API later.

### How values compose with header chrome

**Top — content-inset (required):** `paddingTop` is the space **between the bottom of
Streamlit header chrome** and the first content in that section — not distance from the
viewport top. `0` means flush under the header, never overlapping it. Streamlit still
clears the **actual** overlapping header (today `theme.sizes.headerHeight`, `3.75rem`) so
content does not clip.

**Regular header vs top nav:** today’s non-embedded defaults are **`6rem` without top
nav** and **`8rem` with top nav** ([#11836](https://github.com/streamlit/streamlit/pull/11836)).
That +`2rem` is a **legacy aesthetic bump** for a busier header, not a taller header —
top nav still lives inside the same `headerHeight` bar. It is **not** two different
author insets.

| Situation | Behavior |
| --------- | -------- |
| `paddingTop` **unset** | Preserve today’s policy: `6rem` vs `8rem` (and today’s embed/minimal paths) |
| `paddingTop` **set** | **Author value wins.** It replaces both the `6rem` and `8rem` defaults. Do **not** also add the top-nav +`2rem` bump on top of a configured value — same visual gap under chrome with or without top nav. Effective padding = *actual header clearance* (to avoid clipping) + author inset |
| Sidebar | Same trump rule if sidebar top is configurable; unset keeps today’s sidebar top spacing |

So configured apps do not inherit Streamlit’s “more air when top nav is on” opinion;
unset apps keep current look for compatibility.

**Bottom — aesthetic inset (no footer clearance):** there is no fixed Streamlit page
footer (“Made with Streamlit” is menu-only). `paddingBottom` replaces today’s large main
breathing room.

**`st.bottom` (explicit):** `theme.paddingBottom` customizes **main-area** space above
`st.bottom` when that container is used (today main bottom padding already shrinks when
`st.bottom` is present). It does **not** restyle padding inside
`StyledBottomBlockContainer` / the sticky bottom chrome itself. Sticky + spacer already
prevents main content from scrolling under `st.bottom`.

| Bottom element | Role |
| -------------- | ---- |
| Default ~`10rem` main bottom padding | Aesthetic room — what `paddingBottom` replaces |
| `st.bottom` | Author sticky content; see rule above |
| Header toolbar / deploy / status | Header area, not a footer |
| Cloud **“Manage app”** (~`2.75rem` tall from `font-size: 0.875rem`, `line-height: 1.25rem`, `padding: 0.75rem 1.5rem`) | Host overlay, bottom-right — **not** cleared by this API |

#### Risks

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| Header clipping | High if absolute CSS with no clearance | Content-inset: always clear real header height; author value is the gap under it |
| Re-applying top-nav `8rem` on top of a set value | Medium | Author config **trumps** `6rem`/`8rem`; no +`2rem` top-nav bump when set ([#11836](https://github.com/streamlit/streamlit/pull/11836) is unset-only legacy) |
| Cloud “Manage app” (and similar host chips) | Medium, corner-local | ~`2.75rem` chip; today’s `10rem` is general air, not calibrated clearance. Modest ~`3rem` usually enough; near-zero can overlap **bottom-right** content only. Document caveat — do **not** auto-clear unknown host UI |
| Cramped `st.bottom` / auto chat input | Low–medium | Main `paddingBottom` doesn’t restyle bottom-container internals; docs note flush chat vs viewport / Manage app |
| `st.toast` / skills nudge | Low | Top-right under header; unrelated to `paddingBottom` |

**Takeaway:** ship top + bottom. When authors opt in, their inset wins over Streamlit’s
default density (including top-nav air); Streamlit only protects real header overlap.
Bottom is opt-in aesthetic control with a small host-overlay caveat. Top-only remains an
optional review fallback, not the preferred plan.

Pixel/rem math for composing inset + header height is an implementation detail; the
product contract is: **authors set the gap under the header (and bottom breathing room);
configured values trump `6rem`/`8rem`; Streamlit prevents header underlap, not unknown
host overlays.**

Also: `client.toolbarMode` / `ui.hideTopBar` still choose which chrome exists; padding
does not hide them. Embed modes keep today’s branching when unset; when set, author inset
applies on top of real chrome clearance in those modes too.

### Behavior

- **Defaults:** unset → **preserve today’s hardcoded values** (`6rem` / `8rem` top,
  ~`10rem` bottom when no `st.bottom`, current sidebar spacing). No visual change for
  apps that set nothing.
- **Inheritance:** standard theme sidebar / light / dark rules
- **Host themes:** new keys participate like other theme options
- **Print:** keep today’s print reductions unless a value is set; no separate print API
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
- `footer_text` from the original issue
- Element/vertical `gap` / “remove all spacing”
- Hiding header, toolbar, or deploy button
- Author stylesheets / arbitrary CSS variables as the API
- Changing defaults for apps with no theme options
- Auto-clearing host overlays (Cloud “Manage app”, etc.)
- Restyling padding _inside_ `st.bottom` via `theme.paddingBottom`

### Design / mocks

Implementation PRs should include before/after screenshots for: default
baseline; small top/bottom with header + toolbar (no clipping); top nav path; sidebar
overrides; embedded minimal chrome; optional Cloud bottom-right with near-zero
`paddingBottom`.

## Checklist

| Item                       | ✅ or comment                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Works on SiS, Cloud, etc?  | Yes — theme config already flows; verify host-supplied themes accept the new keys; document Manage-app caveat on Cloud |
| No breaking API changes    | Yes — opt-in; unset preserves today’s padding                                                                          |
| No new dependencies        | Yes                                                                                                                    |
| Metrics collected          | Use existing theme/config metrics if available; else skip new telemetry for v1                                         |
| Any security/legal impact? | No — CSS length theme options only                                                                                     |
| Any docs changes needed?   | Yes — theming reference + point #6336 workarounds at the new options                                                   |
