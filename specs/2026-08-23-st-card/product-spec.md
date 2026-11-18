---
author: lukasmasuch
created: 2026-08-23
---

# `st.card` layout container

## Summary

Add `st.card`, a titled panel for dashboards. A card is a container with a consistent
header, an arbitrary body, and an outline by default. The header has a label, icon,
caption, help tooltip, and an `actions` slot for compact controls such as segmented
controls, toggles, and badges. The body holds charts, tables, metrics, and filters. Cards
fill the height of their row by default, so side-by-side cards line up in `st.columns` and
`st.grid`.

## Problem

Dashboards are built from panels: a chart or table with a short title, a line of context,
and a few compact controls on the right of the title row. Streamlit apps build each panel
by hand. The [business intelligence (BI) dashboard demo](https://github.com/streamlit/feature-demos/tree/main/bi-dashboard)
uses this helper for all 13 of its panels:

```python
def card_header(title, caption=None, *, help=None):
    with st.container(horizontal=True, vertical_alignment="center", gap="small"):
        with st.container(gap=None):
            st.markdown(f"**{title}**", help=help)
            if caption:
                st.caption(caption)
        controls = st.container(
            horizontal=True, horizontal_alignment="right", width="content"
        )
    return controls


with st.container(border=True, height="stretch"):
    controls = card_header("MRR by plan", "Monthly recurring revenue in $K")
    view = controls.segmented_control(
        "View", ["$", "%"], default="$", label_visibility="collapsed"
    )
    st.area_chart(mrr if view == "$" else mrr_share)
```

The helper works, but:

- Each panel needs three nested containers, and every panel needs `height="stretch"`, or
  panels in the same row end up with different heights.
- Nothing keeps headers consistent across panels and widths. Long titles wrap in narrow
  columns, captions push charts down unevenly, and a control makes the title row taller.
- A chart's or dataframe's hover toolbar covers controls placed above it. In the demo, a
  dataframe toolbar covered a right-aligned "Show closed" toggle and blocked clicks, so the
  toggle had to move to the left.
- The panel has no name for assistive technology or the agent API. It is an anonymous
  group that starts with a bold paragraph.
- The filled "cards on a tinted canvas" look needs custom CSS on private selectors.

### User requests

- [#16379](https://github.com/streamlit/streamlit/issues/16379) requests a first-class
  `st.card` container with a title, help, and arbitrary body content.
- [#12418](https://github.com/streamlit/streamlit/issues/12418) requests a less busy way to
  separate dashboard cells, proposing cards or filled containers.
- [#10531](https://github.com/streamlit/streamlit/issues/10531) requests container
  background colors for card-like dashboards.
- [#12301](https://github.com/streamlit/streamlit/issues/12301) requests container shadows
  for a card look. Shadows are not part of this proposal.
- Building the BI dashboard demo with an earlier draft of this spec: 5 of 13 panels needed
  controls in the title row (a segmented control, an active-filter badge, a count badge,
  and a toggle).
- Hand-built dashboard cards reviewed for this spec put up to eight controls in the title
  row: a time-range segmented control, icon buttons for a date picker, chart type, query,
  and data views, and a "More" menu. Others add tabs below the title to switch between the
  chart, its data, and its query.
- [#12322](https://github.com/streamlit/streamlit/issues/12322) and
  [#9370](https://github.com/streamlit/streamlit/issues/9370) request actions on
  `st.metric` ([draft spec #13212](https://github.com/streamlit/streamlit/pull/13212)).
  Card and metric actions should look and behave the same.

### Use cases

1. **Chart panels** with a time range, a view control such as absolute values versus
   shares, and switches between the chart, its data, and its query.
2. **Table panels** with an active-filter badge, a row count, or a toggle.
3. **Detail panels** in dialogs and drawers, such as an account's history and product
   adoption.

Galleries and entity cards still work by composing `st.image` and text in the body, but
the design does not optimize for them.

### Goals

- Create a titled dashboard panel in one call, without CSS or a helper.
- Keep headers consistent across cards and widths: predictable height and consistent
  truncation.
- Give side-by-side cards equal heights in `st.columns` and `st.grid` by default.
- Use regular Streamlit elements for header controls instead of card-specific parameters.
- Keep the API small and consistent with `st.expander` and `st.container`.

### Non-goals

- A general styling API: arbitrary colors, shadow sizes, or outline styles.
- Clickable or selectable cards ([#10678](https://github.com/streamlit/streamlit/issues/10678)).
  A clickable card would wrap interactive body elements in a clickable region.
- Collapsible cards. Use `st.expander`.
- Replacing `st.metric` for KPI tiles.
- Aligning headers or body sections across cards in the first version. Header alignment is
  a [follow-up](#layout).
- Header images in the first version. They are a [follow-up](#header-and-content).
  Multiple header images, carousels, and video headers are out of scope.
- Dashboard-builder features such as dragging or resizing cards.

## Proposal

### API

```python
st.card(
    label: str,
    *,
    icon: str | None = None,
    caption: str | None = None,
    help: str | None = None,
    key: Key | None = None,
    border: bool = True,
    background: bool = False,
    width: "stretch" | "content" | int = "stretch",
    height: "stretch" | "content" | int = "stretch",
) -> CardContainer
```

| Parameter | Behavior |
| --- | --- |
| `label` | The card title. It supports the inline Markdown accepted by other Streamlit labels. |
| `icon` | Optional emoji, Material icon, or `"spinner"` displayed before the label, following `st.expander`. |
| `caption` | Optional secondary text below the label. It supports inline Markdown. |
| `help` | Optional Markdown tooltip displayed beside the label. |
| `key` | Optional identifier that follows `st.container`, including the `st-key-<key>` CSS class. |
| `border` | Whether to show the card's outline. Defaults to `True`, like `st.form(border=...)`. See [Surface](#surface). |
| `background` | Whether to fill the card with the theme's secondary background color. See [Surface](#surface). |
| `width` | Same values and behavior as `st.container`. |
| `height` | Same values as `st.container`, with a `"stretch"` default. |

`label` is the only positional parameter. `None` raises
`StreamlitMissingRequiredParameterError`, as in `st.expander`. An empty string logs the
standard label accessibility warning, as for widget labels. An empty or whitespace-only
`caption` or `help` counts as not set. For an untitled bordered group, use
`st.container(border=True)`.

`CardContainer` is a container with one extra member, `actions`, the header's controls
slot. `card.actions` always refers to the same container. Like other containers, the card
supports `with` notation and method calls, and `with` returns the card:

```python
with st.card("Revenue", caption="Last 12 months") as card:
    card.actions.badge("Live", color="green")
    st.line_chart(revenue)

revenue_card = st.card("Revenue")
revenue_card.line_chart(revenue)
```

### Structure

A card has two regions:

1. **Header:** the icon, label, help icon, and caption on the left, and the actions on the
   right.
2. **Body:** the elements written to the card, with normal element spacing.

A card with an empty body renders only its header, without an empty padded body. A
skeleton, a `with st.skeleton()` block, or a pending fragment in the body counts as
content, so the body keeps its space while the data loads (see
[Loading and fragments](#loading-and-fragments)).

### Header layout and overflow

The header layout must work in a card about `12.5rem` wide (200 pixels at the default
font size), the default minimum column width of `st.grid`. At that width, actions wider
than an icon button usually move to their own row (see narrow cards below).

| Part | Behavior |
| --- | --- |
| Label | One line. An overflowing label ends in an ellipsis. The icon and help icon stay visible. |
| Caption | Below the label, in the `st.caption` style. It wraps to at most two lines, then ends in an ellipsis. |
| Actions | At the top right, next to the label. A control taller than the label extends down beside the caption instead of pushing it down, so actions stay next to the title when the caption wraps. |
| Height | The header is at least one standard widget height (`2.5rem`), so a button or segmented control beside the label does not make it taller. |
| Narrow cards | The label keeps a minimum width (about `8rem`; the final value comes from design). Below that, the actions move to their own row under the caption. |
| Print | The label and caption wrap instead of ending in an ellipsis, as `st.metric` does. |

A truncated label or caption keeps its full text available the same way as
[`wrap=False` labels](../2026-07-23-horizontal-wrap-control/product-spec.md#tooltip-for-the-full-label):

- A native `title` tooltip shows the plain text, only when the text is clipped.
- It stays alongside `help`, because the help icon is a separate target.
- The full label is the card's accessible name and the full caption is its accessible
  description. Like `help`, the tooltip does not apply on touch.

The docstring recommends labels of about 30 characters or fewer. Captions should hold
units, the time window, or one short hint. Longer explanations belong in `help` or the body.

These rules keep cards in a row aligned:

- **Outer heights match** because `height="stretch"` is the default.
- **Header heights vary only with the caption** (none, one, or two lines) and with the
  narrow-card actions row. The docstring recommends the same header fields for every card
  in a row.
- **Chart bottoms line up** in fixed-height cards and in grids with a fixed `row_height`: a
  body chart or dataframe with `height="stretch"` absorbs the remaining difference.
- **Exact header alignment** across a grid row is a
  [follow-up](#layout).

### Header actions

`card.actions` is a horizontal, right-aligned, content-width container in the header:

- **Content:** compact elements that fit one row: `st.badge`, `st.button`,
  `st.download_button`, `st.link_button`, `st.menu_button`, `st.popover`,
  `st.segmented_control`, `st.pills`, and `st.toggle`. Other elements are not rejected, but
  they can break the header layout. If the items do not fit on one row, they wrap within
  the actions area. An empty `card.actions` takes no width and adds no row.
- **Many controls:** Icon-only tertiary buttons with `help` keep a busy header compact, and
  an `st.menu_button` can collect the rest in a "More" menu. A second row of controls, or
  `st.tabs` that switch between a chart, its data, and its query, goes at the top of the
  body.
- **Labels:** Widgets whose label sits above the input should use
  `label_visibility="collapsed"`. The label remains the widget's accessible name.
- **Write order:** Actions can be added before or after body content, for example a row
  count after the data loads.
- **Toolbars:** Hover toolbars of body elements, such as charts and dataframes, must not
  cover the actions.
- **Focus order:** label and help, then actions, then the body.

```python
with st.card("MRR by plan", caption="Monthly recurring revenue in $K") as card:
    view = card.actions.segmented_control(
        "View", ["$", "%"], default="$", label_visibility="collapsed"
    )
    st.area_chart(mrr if view == "$" else mrr_share)
```

The same placement, sizing, and truncation rules apply to the single `action` proposed for
`st.metric` in #13212. A metric is a leaf element, so it takes one action parameter instead
of a slot. A KPI tile that needs more, such as a menu or a period toggle, puts the metric in
a card:

```python
kpi = st.card("ARR")
kpi.actions.menu_button("Actions", ["Export", "Open report"], type="tertiary")
kpi.metric("ARR", "$4.2M", "+8%", label_visibility="collapsed")
```

### Surface

By default, a card has an outline in the theme's border color with the standard corner
radius and padding. This matches `st.container(border=True)` and `st.metric(border=True)`,
so KPI tiles and cards on one dashboard look like one system.

`border` and `background` combine into four surfaces:

| `border` | `background` | Result |
| --- | --- | --- |
| `True` (default) | `False` (default) | Outlined card. |
| `True` | `True` | Filled card with an outline. |
| `False` | `True` | Filled card without an outline, the "less busy" look requested in #12418. |
| `False` | `False` | No frame and no padding, like `st.form(border=False)`. The header and body remain, so this works as a titled section inside something that already has a frame, such as a bordered grid cell, an expander, or a dialog. |

The docstring recommends `border=False` for cards inside `st.grid(border=True)` or another
bordered container, which would otherwise show a double frame.

`background=True` fills the card. The fill uses the theme-aware color swap described in the
[container background spec (#14683)](https://github.com/streamlit/streamlit/pull/14683),
the same technique the sidebar uses:

- The card uses the secondary background color of its immediate theme context.
- Children that normally use the background color use the secondary background color, and
  the reverse. Buttons, inputs, charts, and other theme-aware children stay readable.
- Nested filled cards swap again.
- In the sidebar, the swap uses the sidebar's theme colors. With the default sidebar
  theme, this resolves to the app's background color.

The card's fill does not depend on `st.container` gaining a `background` parameter. It
reuses only the theming technique.

For example, white cards on a gray page come from the existing theme options:

```toml
[theme]
backgroundColor = "#f0f2f6"
secondaryBackgroundColor = "#ffffff"
```

Third-party components that do not consume Streamlit's theme context may not adapt.

A card inside a scoped theme (`st.container(theme=...)`, proposed in
[#16290](https://github.com/streamlit/streamlit/pull/16290)) uses that theme's border and
background colors. Brand or status colors therefore come from the theme, not from card
parameters.

### Visual language

The card's border, radius, and padding are those of `st.container(border=True)`, as
described in [Surface](#surface). From `st.expander`, the card takes only the icon
placement in the header, without any expander interaction: it has no chevron, hover state,
or pointer cursor. The label uses the body font size with a semibold weight. It is not a
heading, so it has no anchor and is not part of the page's heading outline. Exact spacing
and tokens are finalized in the design system.

### Sizing and layout

- `width` matches `st.container`. With `width="content"`, the header and body determine
  the width, up to the parent width.
- `height="stretch"` (default) follows the `st.container` contract: the card is as tall as
  the larger of its content and the parent's available height. Inside a column row, a grid
  row, or a fixed-height container, the card fills the space. In the main page flow, the
  sidebar, and tabs, it is as tall as its content. Stretch never clips or scrolls content.
- `height="content"` grows with the content.
- An integer height creates a fixed-height card. The header stays pinned and the body
  scrolls. Body elements with `height="stretch"` fill the space below the header. This
  differs from `st.container`, which has no header and scrolls as a whole.

In `st.grid`, each card is one cell: `grid.card(...)`. A wide card uses
`grid.cell(column_span=2).card(...)`. For the wide card to match its neighbors in a
content-height row, `grid.cell()` must fill the row the way direct grid children do, which
[#17891](https://github.com/streamlit/streamlit/pull/17891) fixes. Fixed uneven splits use
`st.columns([3, 2])`.

### Loading and fragments

Cards fit layout-first loading
([#17756](https://github.com/streamlit/streamlit/pull/17756)) with the `st.skeleton`
behavior shipped in #17924 and #17920:

- **The header shows first.** A card created in the main script shows its header as soon
  as the script reaches it. The body can load afterward in a fragment or behind a
  skeleton.
- **A skeleton holds the body's space.** `with st.skeleton(height=...)` in the body shows
  its skeleton at once and keeps it until the first visible element in the block,
  including one drawn by a parallel fragment called inside it. On reruns, the previous
  content stays mounted, and the skeleton covers it only if the new content takes longer
  than 0.5s. In a card with a bounded height, such as an integer height or a grid row with
  a fixed `row_height`, `height="stretch"` fills the body, so nobody measures the content.
  Elsewhere, the skeleton's height must match the content's, or the first load shifts.
- **A fragment's own reruns need a skeleton inside the fragment.** A fragment-only rerun,
  such as one triggered from `card.actions`, doesn't re-enter the block around the call.
  A body that's slow on those reruns wraps its content in a second `with st.skeleton()`,
  as #17756 describes.
- **Header controls can rerun just the body.** Give the body fragment a `key` and trigger
  it from the control with an
  [event-scoped rerun](../2026-06-23-event-scoped-fragment-reruns/product-spec.md). The
  fragment reads the control's value from session state.
- **Data-dependent actions need the card inside the fragment.** A parallel fragment cannot
  write to containers created outside it, and that includes `card.actions`. To add actions
  that depend on the loaded data, such as a row count, create the card inside the
  fragment.

The MRR card from [Header actions](#header-actions), with its body in a parallel fragment:

```python
@st.fragment(parallel=True, key="mrr_body")
def mrr_body():
    share = st.session_state.mrr_view == "%"
    with st.skeleton():  # Covers the reruns triggered by the view control
        st.area_chart(load_mrr(share=share), height=320)


with st.card("MRR by plan", caption="Monthly recurring revenue in $K") as card:
    card.actions.segmented_control(
        "View",
        ["$", "%"],
        default="$",
        key="mrr_view",
        label_visibility="collapsed",
        on_change=lambda: st.rerun("mrr_body"),
    )
    with st.skeleton(height=320):  # Holds the body's space on the first load
        mrr_body()
```

An [automatic body skeleton](#header-and-content), a follow-up, would replace both blocks.

### Accessibility

- The card is a group. Its accessible name is the plain text of the label and its
  accessible description is the plain text of the caption, without Markdown syntax or
  icon shortcodes, as for other labels.
- The card is not a heading or a landmark region. A dashboard can hold a dozen or more
  cards, and listing each one would crowd the page's heading and landmark lists. Headings
  such as `st.subheader` above a group of cards give the page a structure to skim.
- The card itself is not focusable. Actions and body elements keep their own names and
  focus behavior.
- Truncated text follows the rules in [Header layout and overflow](#header-layout-and-overflow).

### Examples

#### Dashboard row

```python
import streamlit as st

grid = st.grid(3)
with grid.cell(column_span=2).card(
    "Revenue trend", caption="Monthly revenue, last 12 months", background=True
):
    st.line_chart(revenue)
with grid.card("Revenue by region", background=True):
    st.bar_chart(revenue_by_region, horizontal=True)
```

With the theme above, this renders white, equal-height cards on a gray page.

#### Table with a count badge after loading

```python
import streamlit as st

with st.card("Upcoming renewals", caption="Next 90 days, soonest first") as card:
    table = st.skeleton(height=340)
    renewals = load_renewals()
    table.dataframe(renewals, height=340)
    card.actions.badge(f"{len(renewals)} accounts", color="gray")
```

The header and a 340-pixel skeleton appear immediately. When the data is ready, the table
replaces the skeleton and the badge appears.

## Alternatives considered

### Option A: `st.card` container — preferred

- **Pros:** Discoverable; one call per panel; one header contract across apps; equal
  heights by default; names the panel for assistive technology and agents.
- **Cons:** Adds a command that overlaps with `st.container(border=True)`.

### Option B: Extend `st.container`

For example, `st.container(border=True, label=..., caption=...)` with `.actions` on every
container.

- **Pros:** No new command.
- **Cons:** A header does not fit horizontal containers, and every container would carry
  an actions slot. The card's defaults (outline, stretch height,
  pinned header) differ from the container's. `st.expander` is the precedent for a labeled
  container with its own command.

### Option C: Document the helper pattern

- **Pros:** No new API.
- **Cons:** Three nested containers per panel. There is no truncation contract, toolbar
  protection, or accessible name, and every app reinvents the helper.

### Header actions: slot vs. parameter

**A `card.actions` slot is preferred.** It accepts stateful controls and display elements,
and it can be filled after the body loads.

- **An `actions=["Export", ...]` parameter** that returns the clicked label covers only
  buttons. None of the header controls on the demo's five cards is a plain button. A card
  also returns a container, so a clicked value would need another channel.
- **A `header, body = st.card(...)` tuple**, like `st.columns`, is awkward with `with`.
  Every card would also pay for a header container it may not use.

The slot is named `actions`, matching the header `action` slot of MUI's `CardHeader` and
the `action` proposed for `st.metric` in #13212. `card.header` is taken, since every
container exposes `st.header` as a method. `toolbar` would be confused with element
toolbars.

### Surface: outline by default vs. adaptive fill

**An outlined card with opt-in `background=True` is preferred.** It matches the outlines of
`st.metric(border=True)` and `st.container(border=True)` in both modes, and it needs no
third state. All four hand-built dashboard cards reviewed for this spec rely on an outline,
in light and dark mode.

An adaptive default (transparent in light mode, filled in dark mode) gives a nicer dark
mode out of the box. But cards would then look different from bordered metrics and
containers on the same page. It would also add a third state to spell, either
`bool | None` as on `st.container(border=...)` or `"auto"`. A fixed, designed surface with
no parameter would be smaller, but the filled-canvas look is the main request in #10531 and
#12418. Shadows are a follow-up.

### Height default: `"stretch"` vs. `"content"`

**`"stretch"` is preferred.** In `st.columns` and `st.grid` rows, cards only match their
neighbors' heights with `"stretch"`. With `"content"`, three cards in one grid row measured
99, 182, and 307 pixels. In the main page flow, the sidebar, and tabs, `"stretch"` falls
back to the content height, so the default costs nothing there. In a fixed-height parent,
a card fills the remaining space, and `height="content"` opts out. `"content"` would match
`st.container` and `st.metric`, but nearly every card in the BI demo passes
`height="stretch"`.

### Overflow: truncate vs. wrap

**Truncating the label and limiting the caption to two lines is preferred.**

- **Wrapping everything** hides nothing, but header heights drift in narrow grid cells and
  charts start at different heights.
- **One line for both** is the most uniform, but it cuts off units and hints, such as the
  demo's "Bubble size shows seats. Use the select tool to filter the table."

`st.metric`, the other dashboard tile, also keeps its label on one line.

### `label` vs. `title`

**`label` is preferred** because Streamlit's API principles standardize user-facing element
text on `label`, as in `st.expander`, `st.popover`, and `st.status`. `title` is the usual
card term and is used by `st.dialog`. The docstring can still call the visible text the
card title.

### `caption` vs. `description`

**`caption` is preferred** because the slot uses the `st.caption` style and stays short.
`description` suggests longer text, which belongs in `help` or the body.

### Command name

**`st.card` is preferred.**

| Name | Used by | Pros | Cons |
| --- | --- | --- | --- |
| `st.card` ✅ | Material Design, Bootstrap, MUI, Ant Design; Shiny `ui.card`, Dash Bootstrap `dbc.Card`, NiceGUI `ui.card`, Reflex `rx.card` | The most widely recognized term; what #16379 asks for; the `st.grid` docs and bundled agent skill already call these cards | Power BI's "Card" visual is a single KPI number; can suggest image or product cards |
| `st.panel` | Grafana and Kibana dashboards | The most precise term for BI dashboards | Same name as the HoloViz Panel library; also suggests side panels and drawers |
| `st.tile` | Looker and Power BI dashboards, IBM Carbon | Fits uniform grid cells | Suggests small, fixed-size squares rather than a card that holds a long table; "tiles" already means map tiles for `st.map` and `st.pydeck_chart` |
| `st.section` | HTML `<section>` | Semantic | Suggests page structure rather than a framed surface; headings already structure a page |
| `st.box`, `st.frame` | | Short | Generic; "frame" is easily confused with dataframes |
| `st.widget` | Databricks dashboards | | Streamlit already uses "widget" for interactive inputs |

Names that say what the card contains, such as `st.chart_card`, are too narrow: cards also
hold tables, metrics, and filters.

Users who know "card" from Power BI might expect `st.card` to show a single number. The
docstring points them to `st.metric` for KPI tiles.

## Compatible follow-ups

Each follow-up is additive, so code written against the first version keeps working.

### Header and content

- **Header image.** `image=` shows a full-bleed image above the header. It accepts the same
  single-image inputs as `st.image`, keeps the image's natural aspect ratio, and follows the
  card's rounded top corners. Because `label` is required, image cards always have an
  accessible name. An `image_alt` parameter can describe images that carry meaning beyond
  the label. Crop controls (`image_height`, aspect ratio, focal point) come only if usage
  shows that preparing images by hand is too much work.
- **Footer slot.** `card.footer` is a container pinned to the bottom of the card, for links,
  actions, and "last updated" text. Because cards in a row have equal heights, their
  footers line up.
- **Header updates.** `card.update(label=..., caption=..., icon=...)` works like
  `st.status.update()`, for example to replace a `"spinner"` icon once the data loads.
- **Automatic body skeleton.** The body behaves like a `with st.skeleton()` block, so a
  card shows a skeleton until its first visible body element without a block of its own.
  The skeleton fills the body when the card's height is bounded and has the default
  skeleton height otherwise. The header and `card.actions` are never covered. Open points:
  - **Sizing an unbounded card:** the outermost pending skeleton wins today, so the card's
    skeleton would hide an explicit `with st.skeleton(height=...)` inside it. An explicit
    height in the body should win instead.
  - **Fragment reruns:** a skeleton created by the main script doesn't cover a fragment's
    own reruns. Covering the reruns of a fragment that fills the body is safe for cards,
    because the controls that trigger them sit in the header. This follows #17756's
    decision on fragment skeletons.
  - **Default or opt-in:** as the default, it changes how slow card bodies load in apps
    built on the first version, so it needs product sign-off, as #17920 did. Otherwise it
    is an opt-in parameter.
- **Header loading state.** The header shows that the body is still loading, for example
  with a spinner icon while the body's skeleton is visible, as suggested in #17756.
- **Selectable title.** Some dashboards make the title a dropdown that switches the shown
  metric, such as "Developers ▾". Today a selectbox goes in `actions` or the body. A later
  version could let the label position hold a compact selector.
- **Edge-to-edge tables.** A dataframe in a card draws its own frame inside the card's
  outline. A `border` parameter on `st.dataframe`, like `st.table(border=...)`, would let a
  table sit flush with the card.

### Surface

- **Shadow.** `shadow: bool = False` adds subtle elevation that stays visible in dark mode,
  for example with the adaptive shadow described in #14683.
- **Adaptive fill.** A third `background` value fills cards only in dark mode. `True` and
  `False` keep their meaning.
- **Theme default.** A theme option makes filled cards the default, so a dashboard doesn't
  repeat `background=True` on every card. An explicit argument still wins.
- **Card theme.** `st.card(theme=...)` takes the same mapping as `st.container(theme=...)`
  in #16290, for brand or status colors such as a red `border_color` on an alerting panel.
  Until then, wrap the card in a themed container.
- **Filled metric tiles.** `st.metric(border=True, background=True)` uses the card fill, so
  KPI tiles match filled cards.

### Interaction

- **Fullscreen.** A card toolbar button opens the whole card in fullscreen, header actions
  included. Element fullscreen today shows only the chart or table, so the card's controls
  are unavailable there. Start as opt-in so existing cards don't gain a new hover button.
- **Metric actions.** `st.metric(on_click=..., action=...)` from #13212 uses the header
  actions placement and truncation rules defined here.

### Layout

- **Header alignment across a grid row.** Cards in one `st.grid` row share a header height,
  for example with CSS subgrid, so their bodies start at the same height even when captions
  differ. This changes layout but not the API. It needs a design check, because it adds
  space above shorter headers.

## Design references

- [Grafana panels](https://grafana.com/docs/grafana/latest/panels-visualizations/)
- [Material Design 3 cards](https://m3.material.io/components/cards/overview)
- [Component Gallery card anatomy](https://component.gallery/components/card/)
- [Streamlit design-system exploration](https://www.figma.com/design/svukmRMf0N9yQzdv8f7sgO/Streamlit-Open-Source-design-system?node-id=3924-321050)
- [BI dashboard demo](https://github.com/streamlit/feature-demos/tree/main/bi-dashboard)
- Dashboard background comparison in
  [#12418](https://github.com/streamlit/streamlit/issues/12418)

## Checklist

| Item | ✅ or comment |
| --- | --- |
| Works on SiS, Cloud, etc? | ✅ Uses existing container patterns with no platform-specific behavior |
| No breaking API changes | ✅ New command |
| No new dependencies | ✅ |
| Metrics collected | ✅ Command usage and `actions` usage only |
| Any security/legal impact? | ✅ Same Markdown considerations as existing labels |
| Any docs changes needed? | ✅ Layout API reference, dashboard examples, and bundled agent guidance |
