---
author: mayagbarnes
created: 2026-09-17
---

# Configurable page content padding

## Summary

Allow authors to reduce or increase blank spacing around the main content area (and
optionally the sidebar) through **advanced theming** in `.streamlit/config.toml`, with
optional overrides under `[theme.sidebar]`.

Today a non-embedded app pads the main block container by **6rem** top (**8rem** with
top nav) and **10rem** bottom (**1rem** when `st.bottom` is present). That wastes space
on dense dashboards; authors hack it with fragile CSS. This spec adds theme options
instead of shipping `st.set_page_config` padding as the sole API.

```toml
[theme]
paddingTop = "1.5rem"
paddingBottom = "2rem"

[theme.sidebar]
paddingTop = "1rem"
paddingBottom = "1rem"
```

Addresses [#6336](https://github.com/streamlit/streamlit/issues/6336) (Planned, 103 👍).

## Decisions for review

Items 1–5 are the proposed contract. The only unresolved design is
[left/right](#leftright-fast-follow-open).

1. **[API surface](#api-surface)** — theming for v1; page-config-only rejected; optional
   `st.set_page_config` override later if demand (page_config wins).
2. **[Which properties](#which-properties)** — top + bottom this ship; left/right fast
   follow.
3. **[Option naming](#option-naming)** — prefer `paddingTop` / `paddingBottom`;
   alternative `appPadding*`; reject `mainPadding*`.
4. **[Sidebar support](#sidebar-support)** — yes via `[theme.sidebar]`; main does not
   leak.
5. **[How values compose](#how-values-compose)** — prefer **A**: top = gap from Streamlit
   chrome to the first author widget. Bottom = aesthetic only (no footer, no Cloud
   “Manage app” floor).

## Problem

### Motivation / demand

[#6336](https://github.com/streamlit/streamlit/issues/6336) asks to reclaim ~100px+ above
page content so dense apps fit more before scrolling. Long-running, high-vote ask on the
**Planned** milestone.

A maintainer proposed a “tight” layout mode
([comment](https://github.com/streamlit/streamlit/issues/6336#issuecomment-1487761420));
the issue author agreed reduced aesthetic margins would solve their problem. Later
commenters still want an official knob because CSS hacks break across releases.

### What authors get today

Hardcoded main padding in `StyledAppViewBlockContainer`:

| Context | Typical `padding-top` | Typical `padding-bottom` |
| ------- | --------------------- | ------------------------ |
| Non-embedded | `6rem` (`8rem` with top nav). Ignores both props below | `10rem` when no `st.bottom`, else `1rem` (`spacing.lg`) |
| Embedded | `6rem` if `showPadding` or `showToolbar`; else `4.5rem` if header or sidebar chrome; else `2.25rem` | `10rem` only if `showPadding` and no `st.bottom`; otherwise `1rem` |

Columns use props into `StyledAppViewBlockContainer`, not URL option strings.

- `showPadding` = `!isEmbed() || isPaddingDisplayed()` (`embed_options=show_padding`).
  Always true outside embeds → `10rem` bottom is the normal-app default. Field name
  `bottomEmbedPadding` is historical, not embed-only.
- `showToolbar` ≠ URL `show_toolbar`. It is
  `(!isEmbed() || isToolbarDisplayed()) && hasContentToShow`. With
  `toolbarMode = "minimal"` and no menu/toolbar items, an embed can request
  `show_toolbar` and still take `4.5rem` / `2.25rem` top. Does not affect bottom.

Side padding: `theme.spacing.lg` (or `wideSidePadding` in wide mode on large screens).
Sidebar today: user-content `paddingTop` = `twoXL` when page nav above, else `0`;
`paddingBottom` = `sidebarTopSpace` (`6rem`); header row adds `headerHeight` +
`spacing.lg` margin. None configurable.

### Workarounds today

CSS against private classes (`.block-container`, `.stMainBlockContainer`, emotion hashes):
breaks across releases; can clip under the header
([example](https://github.com/streamlit/streamlit/issues/6336#issuecomment-1478146883));
ignores embed / top-nav / toolbar branching. Hiding chrome (`client.toolbarMode`,
`ui.hideTopBar`) does not reclaim block-container inset.

### Use cases

1. Dense internal dashboards
2. Kiosk / wallboard / TV layouts
3. Embedded apps (tight host height)
4. Sidebar-heavy apps (same top waste)

### Related issues

| Issue | Role |
| ----- | ---- |
| [#6336](https://github.com/streamlit/streamlit/issues/6336) | Primary ask |
| [#5466](https://github.com/streamlit/streamlit/issues/5466) | Max content width — may pair with left/right |
| [#14172](https://github.com/streamlit/streamlit/issues/14172) | Runtime theme mutation — out of scope |

## Proposal

### API surface

| Shape | v1? | Notes |
| ----- | --- | ----- |
| **1. Advanced theming** | ✅ Preferred | App-wide; shareable across apps via `config.toml` |
| **2. `st.set_page_config` only** | ❌ Rejected as sole path | Weak for MPA + corporate share |
| **3. Theme now + page_config later** | 🔜 If demand | Feasible; page_config takes precedence |

**Option 1 — Advanced theming** ✅ for v1 (example in Summary).

- Pros: Set once / share across apps (corporate fleets); `[theme.sidebar]`; rem/px like
  other theme lengths; chrome appearance surface; advances theming adoption; no new
  Python API; matches app-wide #6336
- Cons: Not per-page; config discoverability; restart like other theme keys
- Novelty: first theme **spacing** options (today: colors, fonts, radii, borders)

**Option 2 — `st.set_page_config` only** (original #6336 ask) — ❌ not sole v1 path

```python
st.set_page_config(margin_top=20, margin_bottom=50)
```

- Pros: Next to `layout`; per-page; obvious call-site; no config restart
- Cons as sole API: MPA v1 needs every page (or sticky surprises); MPA v2 home script
  still not shared across apps; no sidebar section; int pixels vs rem; grows a broad
  command; undercuts advanced theming adoption

**Option 3 — Density preset only** (`layout="tight"` / `theme.density = "compact"`):
tiny API, no fine control. Only if review wants a smaller first ship.

**Recommendation:** Ship Option 1 only for v1. Reject Option 2 as the only surface. Do
not ship theme + page_config together until demand (issue/feedback).

**Future dual surface (if demand):** theme stays default; page_config is an optional
override. Feasible because theme (`NewSession.custom_theme`, before script) and
page_config (`ForwardMsg.page_config_changed`, mid-script) are already orthogonal.

| Rule | Detail |
| ---- | ------ |
| Precedence | Frontend: `page_config ?? theme ?? built-ins`. Omitted params = fall through to theme (UNSET like `layout`), not reset to Streamlit defaults |
| Grammar | Same rem/px as theme |
| Flash | Theme/default until page_config arrives — same class as `layout="wide"` flash |
| Multipage | Like `layout`, value sticks in App state across pages until another page sets it — define clear-on-nav vs sticky in the follow-up |
| Sidebar | Theme keeps `[theme.sidebar]`; page_config has no sidebar styling today — later override main-only or explicit nested API; main must not leak |
| Proto | New optional `PageConfig` fields; compose in `AppView` / styled components |

### Which properties

| Property | This ship? | Rationale |
| -------- | ---------- | --------- |
| Top | ✅ | Core of #6336 |
| Bottom | ✅ | Large aesthetic inset today (`10rem` without `st.bottom`) |
| Left / right | 🔜 fast follow | Needs layout decisions below |
| Element / widget gap | ❌ | Gap tokens, not page chrome |

Fast follow: `paddingLeft` / `paddingRight` or `paddingX` after the pass below — not
indefinite deferral, not invented in the implementation PR.

#### Left/right fast follow (open)

Today `layout` owns horizontal space:

| Layout | Side padding today |
| ------ | ------------------ |
| `centered` | `spacing.lg` inside fixed `contentMaxWidth` (736px) |
| `wide` | Large viewports: `wideSidePadding` (5rem) so wide never offers *less* width than centered |

Before shipping side keys, decide:

1. **Replace which gutters?** (A) base only — wide bump still wins / looks broken;
   (B) all side padding — may break wide≥centered; (C) compose with layout
   (`max(author, layoutRequired)` or redesign media query). **Core call.**
2. **Gutter-only vs [#5466](https://github.com/streamlit/streamlit/issues/5466)** — side
   padding alone only shrinks gutter inside 736px; pair with max-width if “wider column”
   is the real ask.
3. Prefer symmetric `paddingX` unless asymmetry is needed.
4. Main `paddingLeft` is gutter *inside* the main column — not sidebar width.
5. **Mins:** do not copy header overlay clearance sideways; do decide whether
   wide≥centered still imposes a floor.

### Option naming

Theme keys are usually **unqualified**; the TOML section supplies scope. Prefixes are for
variants in the *same* section (`baseRadius` vs `buttonRadius`). `mainPadding*` is wrong
under `[theme.sidebar]`.

**Option A: `paddingTop` / `paddingBottom`** ✅ PREFERRED

| Config key | Applies to |
| ---------- | ---------- |
| `theme.paddingTop` | Main: gap under header → first widget |
| `theme.paddingBottom` | Main: aesthetic bottom inset |
| `theme.sidebar.paddingTop` | Sidebar: gap under chrome → first widget |
| `theme.sidebar.paddingBottom` | Sidebar: aesthetic bottom inset |

- Pros: Matches `backgroundColor` / `borderColor`; natural under `[theme.sidebar]`
- Cons: Docs must clarify this is not widget padding

**Option B: `appPaddingTop` / `appPaddingBottom`** — stronger “not widget” signal, but
`app` is vague and `theme.sidebar.appPadding*` sounds global.

**Rejected:** `mainPadding*`; `marginTop` (implementation is padding); shorthand
`padding = "1rem 2rem"`.

**Recommendation:** A (B if review wants a stronger shell signal).

#### Value grammar

Non-negative **`rem` or `px` only** (`"0"`, `"0rem"`, `"0px"` OK; prefer documenting rem).
Reject negatives, `%`, `vh`/`vw`, `calc()`, unitless non-zero, other CSS. Invalid → warn
+ fall back (like `baseRadius`). Host themes: same grammar — no arbitrary CSS strings.

`parseFontSize` today rejects `"0rem"` / `"0px"` (bare `"0"` → `"0px"`). Padding parsing
must allow all three zeros.

#### Config sections (v1)

**`[theme]` and `[theme.sidebar]` only.** Not `[theme.light]` / `[theme.dark]` (or their
`.sidebar` sections): per-appearance padding would change page height on toggle.

Some options are already section-limited (`base`, `baseFontSize`, `showSidebarBorder` →
`[theme]` only). Exact `[theme]` + `[theme.sidebar]` without light/dark is a new combo
but supported by `_create_theme_options` `categories`. Easy to widen later; hard to
narrow.

### Sidebar support

Ship sidebar overrides in the same release. `createSidebarTheme` merges full main
`themeInput` then sidebar overrides — **special-case padding** (like `headingFontSizes`)
so main values do **not** leak.

| Config | Effect |
| ------ | ------ |
| Neither set | Today’s paths ([baseline](#what-authors-get-today); [compose](#how-values-compose)) |
| Only `[theme]` | Main only |
| Only `[theme.sidebar]` | Sidebar only |
| Both | Each section its own value |

If scope must shrink, drop sidebar to a follow-up — don’t invent a second API later.

### How values compose

Unset → today’s path. Set → replace that path; do not add legacy aesthetic bumps
(including main top-nav `+2rem`).

#### What does a configured top value mean?

Today’s `6rem` / `8rem` / embed totals are **CSS `padding-top`**, which also clears the
overlay header. A public key cannot mean that total without authors knowing
`headerHeight`. Three readings:

**A: Gap from Streamlit chrome → first author widget** ✅ PREFERRED

Author sets breathing room under chrome; Streamlit still reserves chrome that is there
(main: `headerHeight` when shown; sidebar: logo/collapse, plus page nav when present).
`"0"` = flush under chrome, never underlap.

- Pros: Matches #6336; one number with/without top nav or embed chrome; `"0"` safe; same
  meaning on main and sidebar
- Cons: Value ≠ raw CSS `padding-top`; docs must say “gap under chrome”

**B: Absolute CSS `padding-top`**

`paddingTop = "2rem"` → container gets `2rem`. With a `3.75rem` overlay header, content
clips unless the author adds clearance.

- Pros: Literal CSS; matches some hacks
- Cons: Small values clip
  ([known](https://github.com/streamlit/streamlit/issues/6336#issuecomment-1478146883));
  author must know `headerHeight`; chrome changes change the required number; sidebar
  (in-flow) ≠ main (overlay) under the same key

**C: Total from viewport top → first widget (including chrome)**

CSS padding ≈ `max(0, author − headerHeight)`.

- Pros: “From the top of the page” model
- Cons: Values below `headerHeight` no-op; hiding chrome silently changes the gap; poor
  fit for in-flow sidebar

**Recommendation:** A. B is why CSS hacks break. C makes small values meaningless.

**Bottom:** no overlay footer, so B/C do not apply. Aesthetic only — no Streamlit footer,
no Cloud “Manage app” floor (corner host control; absent on localhost). Same configured
bottom on localhost and Cloud.

#### Main top (A)

CSS `padding-top` = `headerHeight` + author if header shown, else author alone. Do not
substitute the author string for today’s `6rem` / `8rem` / embed totals. `"0"` with a
header → `headerHeight` total (flush under the bar).

Non-embedded defaults: `6rem` without top nav, `8rem` with
([#11836](https://github.com/streamlit/streamlit/pull/11836)). The +`2rem` is aesthetic,
not a taller header — when set, do **not** also add it.

| Situation | Behavior |
| --------- | -------- |
| unset | Today’s `6rem` / `8rem` / embed paths |
| set | `headerHeight` + author if header; author alone if not |

`client.toolbarMode` / `ui.hideTopBar` still choose chrome; these keys do not hide it.

#### Sidebar (A)

Same meaning as main top. Chrome = logo/collapse row + page nav when above widgets.
Main top nav is *inside* the header; sidebar nav is a *sibling* — write the author value
to **exactly one** CSS property:

1. `StyledSidebarHeaderContainer` (`headerHeight` + `marginBottom: spacing.lg`)
2. optional `SidebarNav`
3. `StyledSidebarUserContent` (`paddingTop: twoXL` with page nav, else `0`)

| Config | Page nav? | Header `marginBottom` | User-content `paddingTop` |
| ------ | --------- | --------------------- | ------------------------- |
| unset | no | `spacing.lg` | `0` |
| unset | yes | `spacing.lg` | `spacing.twoXL` |
| set | no | **author** | `0` |
| set | yes | `spacing.lg` (header→nav) | **author** |

`"0"` = flush under last chrome. Do not also zero the other property.

`theme.sidebar.paddingBottom` replaces today’s `sidebarTopSpace` / `6rem`. No effect on
main bottom or `st.bottom`.

#### Main bottom

Replaces today’s `10rem` / `1rem` breathing room. `"0"` = flush with content bottom.

**`st.bottom`:** configures that main-area breathing room, not the sticky container.
Today padding falls `10rem` → `1rem` when `st.bottom` is present
(`showPadding && !hasBottom ? "10rem" : spacing.lg`). Configured value replaces
main-area padding either way; does not restyle `StyledBottomBlockContainer`. Sticky +
spacer already prevent scroll-under.

| Element | Role |
| ------- | ---- |
| `10rem` / `1rem` paths | What `paddingBottom` replaces |
| `st.bottom` | Author sticky content; internals out of scope |
| Cloud “Manage app” | Corner overlay — no padding floor |

### Behavior

- **Defaults / inheritance:** unset → [baseline](#what-authors-get-today). Main does not
  flow to sidebar. v1 not light/dark-scoped.
- **Host themes:** same grammar and section rules as `config.toml`.
- **Print:** main `paddingTop` → absolute `2.25rem` (no added `headerHeight`). When set,
  author value replaces that `2.25rem`. Small values may overlap a printed logo
  (accepted; unset print is already below `headerHeight`). Bottom / sidebar unchanged.
- **Small viewports:** value unchanged across breakpoints. No mobile floor in v1.
- **No runtime Python setter** — [#14172](https://github.com/streamlit/streamlit/issues/14172)

### Examples

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
# Airier than default
[theme]
paddingTop = "4rem"
paddingBottom = "4rem"
```

### Out of scope (future work)

- Left/right — [fast follow](#leftright-fast-follow-open); may pair with #5466
- Per-page via `st.set_page_config` — [API surface](#api-surface) if demand
- Runtime theme mutation (#14172); light/dark-scoped padding
- `footer_text`; element `gap`; hiding header/toolbar/deploy
- Author stylesheets / arbitrary CSS variables
- Changing defaults when unset; auto-clearing host overlays
- Restyling padding *inside* `st.bottom`; mobile-specific floors

### Design / mocks

No Figma here. Implementation PR: screenshots / e2e + automated tests.

- Visual: default; small inset + header/toolbar (focus-ring); top nav without +`2rem`;
  sidebar ± page nav; embed minimal; host theme grammar; `st.bottom` / chat input; print
  (small top may overlap logo); optional Cloud corner + near-zero bottom
- Automated: parse/fallback in `theme/utils.ts`; config tests like `baseRadius`; AppView
  unset `6rem`/`8rem`; set = `headerHeight` + author (author alone if no header; no
  top-nav bump); sidebar non-inheritance

Screenshots supplement assertions; they do not replace them.

## Checklist

| Item | ✅ or comment |
| ---- | ------------- |
| Works on SiS, Cloud, etc? | Yes — theme already flows; verify host themes + grammar; document Manage-app caveat |
| No breaking API changes | Yes — opt-in; unset preserves today |
| No new dependencies | Yes |
| Metrics collected | No — no v1 telemetry |
| Any security/legal impact? | No — validated CSS lengths only |
| Any docs changes needed? | Yes — theming docs + `references/theme.md`; point #6336 workarounds here |
