---
author: lukasmasuch
created: 2026-07-23
---

# Control wrapping in horizontal layouts and controls

## Summary

Add a keyword-only `wrap: bool | None = None` parameter to horizontal layout
collections, multi-item controls, and wrapping button-like commands. Setting `wrap=False`
keeps the controlled content to one row: collections use local horizontal scrolling, while
a button keeps its standard height and ellipsizes its label. For controls placed inside a
layout, the default `wrap=None` is "auto": Streamlit picks `False` when the control is
inside a horizontal container and `True` otherwise, so a control stays on one row exactly
where compact rows matter most (toolbars, `st.container(horizontal=True)`), following the
`st.markdown(width="auto")` precedent. The layout containers `st.container` and `st.columns`
do not use this adaptive resolution: their `wrap=None` keeps today's wrapping and stacking,
and a single row is requested only with an explicit `wrap=False`.

This is a layout control with an adaptive default. Existing apps keep their current
behavior everywhere except for controls inside horizontal containers, where the auto
default now favors a single row; the layout containers themselves keep their current
defaults. The initial API covers `st.container`, `st.columns`, `st.multiselect`,
`st.pills`, `st.segmented_control`, `st.button`, `st.download_button`, `st.link_button`,
`st.form_submit_button`, `st.popover`, `st.menu_button`, `st.checkbox`, and
`st.toggle`.

## Problem

Streamlit currently decides when horizontal content moves to another row. The default is
generally useful, but it can make compact layouts unstable:

- A horizontal toolbar becomes two or three rows as its container narrows.
- Selected values make `st.multiselect` taller than adjacent controls.
- `st.pills` and `st.segmented_control` consume several rows on mobile.
- A long button label wraps and makes one action taller than adjacent actions.
- A checkbox or toggle with a long label becomes taller than neighboring toolbar
  controls.
- `st.columns` stacks on small screens even when the app author needs a small grid or
  a row of controls to remain horizontal.

App authors often discover these changes only after deploying, when an app is viewed in
a sidebar, embedded iframe, split window, laptop display, or phone. Their current options
are to accept the layout change, restructure the app around another command, or inject
CSS that depends on Streamlit's private DOM.

### User requests

**Horizontal layouts**

- [#12582](https://github.com/streamlit/streamlit/issues/12582) requests wrap control
  for horizontal `st.container`.
- [#9544](https://github.com/streamlit/streamlit/issues/9544) requests horizontal
  scrolling for `st.container`, addressed here by `st.container(horizontal=True, wrap=False)`.
- [#5003](https://github.com/streamlit/streamlit/issues/5003) requests a way to keep
  `st.columns` horizontal on mobile.
- [#2313](https://github.com/streamlit/streamlit/issues/2313) requests horizontal
  scrolling for a row of wide `st.columns` (e.g. side-by-side charts) rather than
  clipping or stacking them.
- [#6592](https://github.com/streamlit/streamlit/issues/6592) requests configurable
  column responsiveness and shows that the current fixed breakpoint is not suitable for
  every layout.

**Horizontal option and selection collections**

- [#12644](https://github.com/streamlit/streamlit/issues/12644) requests a fixed-height,
  horizontally scrollable `st.multiselect`.
- [#13516](https://github.com/streamlit/streamlit/issues/13516) requests a single-row,
  horizontally scrollable `st.segmented_control` on mobile.
- [#12645](https://github.com/streamlit/streamlit/issues/12645) reports that wrapped
  pills and segments lose the expected alignment.
- [#12038](https://github.com/streamlit/streamlit/issues/12038) reports uneven option
  widths after pills and segments wrap with `width="stretch"`.

A previous change partially addressed the multiselect requests
[#8671](https://github.com/streamlit/streamlit/issues/8671) and
[#9085](https://github.com/streamlit/streamlit/issues/9085) by capping the widget's height
and adding vertical scrolling. That prevents unbounded growth, but the control can still
become several rows tall.

### Current behavior audit

A local audit against the current codebase used the same content at three viewport widths.
Representative results:

| Element | 1280 px | 800 px | 390 px |
| --- | ---: | ---: | ---: |
| Three widget labels in columns | 24 / 24 / 24 px | 24 / 45 / 24 px | Columns stack; all 24 px |
| Three buttons in columns | 40 / 40 / 40 px | 40 / 55 / 40 px | Columns stack; all 40 px |
| `st.multiselect` with 12 selected values | 101 px | 134 px | 184 px, then scrolls vertically |
| `st.pills` or `st.segmented_control` with 8 options | 60 px | 96 px | 132 px |
| Horizontal radio with three long options | 40 px | 40 px | 61 px |

The remaining problem is primarily the number of item rows, plus long labels inside
standard buttons.

### Goals

- Let app authors opt out of item wrapping where keeping a compact row is more important
  than showing every item at once.
- Use one simple parameter with the same promise across the applicable commands:
  keep the controlled content in one row.
- Keep overflow local to the element so an app does not gain a page-level horizontal
  scrollbar.
- Let app authors keep buttons at their standard height without hiding the entire action.
- Make the common compact-row case work without extra arguments via an adaptive default,
  while preserving current behavior outside horizontal containers.

### Non-goals

- Guarantee that arbitrary elements placed side by side have equal height.
- Control line wrapping inside general text, labels above input widgets, or radio option
  labels.
- Let authors configure the breakpoint or minimum width at which `st.columns` wraps.
- Improve how wrapped rows distribute or align their items.
- Add a general CSS overflow API with clipping, truncation, or always-visible scrollbars.

## Proposal

### API

Add `wrap` as a keyword-only parameter:

```python
st.container(
    ...,
    horizontal: bool = False,
    wrap: bool | None = None,  # NEW
    ...,
)

st.columns(
    spec,
    *,
    ...,
    wrap: bool | None = None,  # NEW
)

st.multiselect(
    label,
    options,
    ...,
    *,
    ...,
    wrap: bool | None = None,  # NEW
)

st.pills(
    label,
    options,
    *,
    ...,
    wrap: bool | None = None,  # NEW
)

st.segmented_control(
    label,
    options,
    *,
    ...,
    wrap: bool | None = None,  # NEW
)

st.button(
    label,
    ...,
    *,
    ...,
    wrap: bool | None = None,  # NEW
)

# Add the same keyword-only parameter to:
# st.download_button, st.link_button, st.form_submit_button, and st.popover.

st.menu_button(
    label,
    options,
    ...,
    *,
    ...,
    wrap: bool | None = None,  # NEW
)

# Add wrap: bool | None = None to both binary controls:
# st.checkbox and st.toggle.
```

| Value | Collections and multi-item controls | Single-label controls |
| --- | --- | --- |
| `None` (default) | Layout containers (`st.container`, `st.columns`) keep today's behavior (wrap or stack); request a single row with an explicit `wrap=False`. Multi-item controls use auto: `False` inside a horizontal container and `True` in any other layout. | Auto: behaves like `False` inside a horizontal container and `True` in any other layout. |
| `True` | Items move to additional rows when they cannot fit. | The label can wrap and increase the control height. |
| `False` | Items remain in one row and the element scrolls horizontally if needed. | The control keeps its standard height and ellipsizes an overflowing label. |

The auto default applies to controls placed inside a layout — the single-label controls and
the multi-item controls (`st.multiselect`, `st.pills`, `st.segmented_control`). Each
resolves `None` from its nearest layout ancestor: `False` inside a horizontal container
(compact rows where they matter most, such as `st.container(horizontal=True)` and other
toolbars) and `True` everywhere else. A button placed directly in `st.columns` (a vertical
column) still defaults to wrapping; use an explicit `wrap=False` there.

The layout containers themselves — `st.container` and `st.columns` — do not use this
adaptive resolution. Their `wrap=None` keeps today's behavior (a horizontal container wraps
its children onto more rows; `st.columns` stacks responsively), and a single row is
requested only with an explicit `wrap=False`. Resolving a container's own default from
whether it happens to be nested in another horizontal container would be surprising and
could silently change existing layouts.

`wrap` is layout-only. Changing it must not reset a widget's value or session state.

### What `wrap` controls

The controlled content differs by command, but the promise is always the same: it stays
in one row when `wrap=False`.

| Command | Content controlled by `wrap` | Overflow behavior with `wrap=False` |
| --- | --- | --- |
| `st.container(horizontal=True)` | Direct child elements | Scroll the container |
| `st.columns` | Column containers | Shrink columns, then scroll the group if needed |
| `st.multiselect` | Selected-value chips in the closed control | Scroll the chip area |
| `st.pills` | Option buttons | Scroll the option group |
| `st.segmented_control` | Option buttons | Scroll the option group |
| `st.button`, `st.download_button`, `st.link_button`, `st.form_submit_button` | Label inside the button | Ellipsize the label |
| `st.popover` | Label inside the popover trigger | Ellipsize the label; keep the chevron visible |
| `st.menu_button` | Label inside the menu trigger | Ellipsize the label; keep the expansion icon visible |
| `st.checkbox` | Label beside the checkbox | Ellipsize the label; keep the indicator visible |
| `st.toggle` | Label beside the switch | Ellipsize the label; keep the switch visible |

Except for the explicitly listed single-label controls, the parameter does not change
wrapping inside an item. For example, `wrap=False` on `st.columns` keeps columns in one
row but does not change a long input-widget label inside a column.

### Shared no-wrap behavior

When `wrap=False` on a collection:

- The collection uses one horizontal row.
- Overflow is contained by that command, never by the full app page.
- Native horizontal scrolling is enabled only when the items cannot shrink enough to fit.
- Touch, trackpad, mouse shift-wheel, and keyboard scrolling continue to use browser-native
  behavior.
- Keyboard focus automatically scrolls an off-screen interactive item into view.
- Existing item width and minimum-width rules still apply unless a command-specific rule
  below overrides them.
- No content is removed from the DOM, preserving accessible names and keyboard order.

When `wrap=False` on a single-label control:

- The outer control keeps its current standard single-row height.
- Button icons, keyboard shortcuts, expansion icons, checkbox indicators, toggle
  switches, and help icons remain visible.
- Only the text portion of the label shrinks and renders an ellipsis.
- The full label remains the control's accessible name.
- When `help` is not set, hovering the control reveals the full label in a tooltip (see
  "Tooltip for the full label").

### Tooltip for the full label

When a single-label control is set to `wrap=False`, its label can be ellipsized, so the
control exposes the full label in a tooltip on hover to keep the wording recoverable
without changing the app. The rules:

- **Native `title` tooltip.** The full label is attached as the element's native HTML
  `title` attribute, which the browser shows on hover. This is a deliberate simplification
  over measuring the label to decide when it is clipped: no width measurement, resize
  observation, or Streamlit tooltip component is involved.
- **Whenever `wrap=False`.** Because a native `title` cannot be conditioned on actual
  clipping without measurement, the tooltip is present for every `wrap=False` control, not
  only when the label is truncated. A short label that fits therefore also shows a tooltip
  with its own text on hover. This is an accepted trade-off for the simpler implementation.
- **Only when `help` is unset.** If `help` is passed, its tooltip takes precedence and no
  `title` is added, so the two never compete. `help` stays the way to add context beyond
  the label.
- **Plain text.** For Markdown labels the tooltip shows the plain-text label (the same
  text used as the accessible name); the native tooltip does not render inline Markdown or
  icons.

Screen-reader users already receive the full label as the control's accessible name, so
this tooltip is a visual aid for pointer users and, like `help`, does not apply on touch.
It covers the button-like controls (`st.button`, `st.download_button`, `st.link_button`,
`st.form_submit_button`, `st.popover`, `st.menu_button`) and applies the same rule to
`st.checkbox` and `st.toggle`.

The native `title` is used instead of Streamlit's styled tooltip because it removes the
frontend truncation-measurement machinery entirely. The visible trade-offs are that the
tooltip uses the browser's default styling (not the `help` tooltip style) and appears even
on labels that are not clipped.

### Deterministic height

A shared benefit of `wrap=False` is that the controlled content stays at a deterministic
height that no longer depends on the viewport width:

- Multi-item controls (`st.multiselect`, `st.pills`, `st.segmented_control`) render their
  control body at the same one-row height at every viewport width and item or selection
  count. This excludes the external widget label, which can still wrap.
- Single-label controls keep their standard single-row height because the label
  ellipsizes instead of growing onto another line.

This does not extend to `st.container(horizontal=True)` and `st.columns`: `wrap=False`
fixes them to a single row, but each child element can still reflow internally, so the
row's height continues to depend on its content.

### Command-specific behavior

#### `st.container`

`wrap` applies only when `horizontal=True`.

```python
import streamlit as st

with st.container(horizontal=True, wrap=False):
    for label in ("Edit", "Duplicate", "Archive", "Delete"):
        st.button(label)
```

The buttons stay in one row. If their combined minimum widths exceed the container, the
container scrolls horizontally.

Passing an explicit `wrap=False` with `horizontal=False` raises a `StreamlitAPIException`
explaining that no horizontal collection exists to wrap. `st.container` does not use the
adaptive auto resolution: `wrap=None` always keeps today's behavior — a horizontal
container wraps its children onto additional rows — regardless of whether the container is
itself nested in another horizontal container. Existing calls therefore do not need to
specify `wrap`; keep the children in one row with an explicit `wrap=False`.

#### `st.columns`

`wrap=False` disables responsive stacking and keeps the columns in the row described by
`spec`.

```python
import streamlit as st

thumbnail_columns = st.columns(6, gap="xsmall", wrap=False)
for column, image in zip(thumbnail_columns, images):
    column.image(image)
```

- Relative widths from `spec` remain unchanged.
- Columns may shrink with the group as they do above the current mobile breakpoint.
- Each column retains a usable minimum width rather than shrinking to zero. This is a new
  layout invariant that the implementation defines for `wrap=False` columns (today a
  column can shrink toward zero), not a reference to an existing CSS `min-width`. Once the
  columns reach that minimum and still do not fit, the column group scrolls horizontally
  rather than overflowing the page, so content is never shrunk below a readable width.
- `wrap=None` (the default) and `wrap=True` keep the current breakpoint and stacking
  behavior. `st.columns` does not use the adaptive auto resolution, so placing it inside a
  horizontal container does not disable stacking; opt out only with an explicit
  `wrap=False`.

This addresses the request to disable column responsiveness in #5003. It does not address
the opposite request in #6592 to wrap sooner or at a configurable threshold.

#### `st.multiselect`

`wrap=False` keeps selected chips in a single, control-height row:

```python
import streamlit as st

regions = st.multiselect(
    "Regions",
    ["Africa", "Asia", "Europe", "North America", "Oceania", "South America"],
    default=["Asia", "Europe", "North America"],
    wrap=False,
)
```

- Only the selected-chip area scrolls. The clear and dropdown controls stay pinned.
- Focusing the input or adding a selection scrolls the newest selection and input into
  view.
- Removing a chip preserves the nearest useful scroll position.
- The open dropdown is unchanged.
- An empty value renders exactly like today's empty multiselect.

#### `st.pills` and `st.segmented_control`

`wrap=False` keeps all options in a horizontally scrollable row:

```python
import streamlit as st

period = st.segmented_control(
    "Period",
    ["Today", "7 days", "30 days", "Quarter", "Year", "All time"],
    default="30 days",
    wrap=False,
)
```

- Option buttons retain their current minimum height and single-line labels.
- With `width="content"`, options use their natural widths.
- With `width="stretch"`, options distribute across the available width when they fit.
  If they do not fit, they stop shrinking below their usable minimum width and the group
  scrolls.
- On initial render, a selected option that would otherwise be off-screen is scrolled
  into view. Keyboard focus does the same while navigating.
- Selection behavior, return values, and callbacks are unchanged.

#### Buttons and button-like triggers

`wrap=False` keeps a button aligned with neighboring controls even when its label is too
long for the available width:

```python
import streamlit as st

left, middle, right = st.columns(3)
left.button("Edit", width="stretch", wrap=False)
middle.button("Regenerate the complete report", width="stretch", wrap=False)
right.button("Export", width="stretch", wrap=False)
```

The middle button remains the same height as its neighbors and displays a label like
`"Regenerate the complete…"`. Because no `help` is set, hovering the button reveals the
full label in a native tooltip (see "Tooltip for the full label").

The behavior applies consistently to:

- `st.button`
- `st.download_button`
- `st.link_button`
- `st.form_submit_button`
- the trigger button rendered by `st.popover`
- `st.menu_button`

For labels with Markdown, ellipsis applies to the rendered inline label as a whole.
Icons and shortcuts are not ellipsized. The button's return value, navigation or download
behavior, callback, and form behavior are unchanged.

`st.menu_button` uses the same wrapping behavior as other buttons today. Its expansion
icon leaves less horizontal space for the label, so an equally sized menu button can wrap
sooner than a standard button. With `wrap=False`, the label ellipsizes while the expansion
icon remains visible. This parameter controls only the trigger label; menu option labels
are unaffected.

`st.page_link` is not included because its navigation-row design already keeps labels to
one line and is not intended to grow like a general-purpose button.

#### `st.checkbox` and `st.toggle`

`wrap=False` keeps a binary control to one line in compact filters and toolbars:

```python
import streamlit as st

with st.container(horizontal=True, wrap=False):
    show_archived = st.checkbox(
        "Include archived projects",
        wrap=False,
        help="Include archived projects in the results",
    )
    live_updates = st.toggle("Enable live updates", wrap=False)
```

- The checkbox indicator or toggle switch retains its size and never shrinks.
- The label consumes the remaining width and ellipsizes when necessary.
- When no `help` is set, hovering the control reveals the full label in a native tooltip
  (see "Tooltip for the full label").
- The optional help icon remains visible.
- `width="content"` and `width="stretch"` continue to determine the control's available
  width. Ellipsis appears only when that width constrains the label.
- `label_visibility="hidden"` and `"collapsed"` are unchanged.
- The boolean value, callback, query-parameter binding, and session state are unchanged.

The default is `None` (auto), matching the other controls: inside a horizontal container
the checkbox or toggle keeps to one line and ellipsizes an overflowing label, while in
normal vertical layouts the label wraps as it does today. Because the full label stays
available as the accessible name and via the hover tooltip, the compact single-row default
is safe in toolbars without hiding what state is being changed.

### Why a boolean with an auto default

For the commands in scope, there are two useful explicit modes: allow the controlled
content to use another row (`True`) or keep it to one row (`False`). A collection scrolls
because clipping would make interactive or selected items unusable. A single-label control
can stay operable while its visual label is ellipsized because its full accessible name
remains available and a hover tooltip reveals the full label (or `help`, when set).

The default is a third value, `None` ("auto"), rather than a fixed `True`, because the
right choice is context-dependent: a compact single row is almost always what you want
inside a horizontal container, whereas wrapping is the safer default elsewhere. Resolving
`None` from the layout gives the common toolbar case the compact behavior for free while
keeping explicit `True`/`False` for full control. This mirrors the existing
`st.markdown(width="auto")` default, which likewise resolves to `content` inside horizontal
containers and `stretch` otherwise. This adaptive resolution applies only to controls placed
inside a layout; the layout containers `st.container` and `st.columns` keep a fixed `None`
default (today's wrapping and stacking), because deriving a container's own wrapping from
whether it is nested in another horizontal container would be surprising and could silently
change existing layouts.

The parameter is named `wrap` rather than `wrap_lines` (the `st.code` precedent) because it
controls whether items flow onto additional rows in a layout, whereas `wrap_lines` controls
line wrapping of text within a code block. Breakpoint control for columns and truncation
for text are separate behaviors, not additional values of this parameter. `None`/`True`/
`False` stay layout-only; they never carry additional semantics.

## Alternatives considered

### Option A: Shared `wrap` parameter with an auto default — preferred

```python
st.segmented_control("View", options, wrap=False)
```

- **Pros:** Short, discoverable, and consistent; maps directly to the user-visible one-row
  choice; the `None`/auto default gives compact toolbars the right behavior with no extra
  arguments while preserving current behavior elsewhere.
- **Cons:** The different overflow treatments must be documented; the adaptive default
  must be explained; adding the parameter to thirteen commands increases the API surface.

### Option B: `overflow: Literal["wrap", "scroll"]`

```python
st.segmented_control("View", options, overflow="scroll")
```

- **Pros:** Names both resulting behaviors and could grow to more overflow modes.
- **Cons:** Exposes CSS-oriented vocabulary; suggests clipping or other modes that are not
  useful for interactive items; is inaccurate when columns or stretch-width children can
  shrink enough that no scrolling occurs.

### Option C: Element-specific parameters

Examples include `height` on `st.multiselect`, `responsive` on `st.columns`,
`overflow` on `st.container`, and `max_lines` on buttons.

- **Pros:** Each API can model every element-specific nuance.
- **Cons:** Users must learn different controls for the same basic item-flow decision;
  behavior becomes harder to compose and document.

### Option D: Put `wrap` only on containers

```python
with st.container(horizontal=True, wrap=False):
    st.segmented_control("View", options)
```

- **Pros:** Smallest API surface.
- **Cons:** A parent container cannot control wrapping inside a child widget or button.
  Pills, segments, and multiselect chips would continue to add internal rows, and long
  button labels could still increase height.

### Option E: Change defaults automatically

Examples include never wrapping on mobile, truncating all widget labels, or disabling
wrapping whenever an element is in `st.columns`.

- **Pros:** Existing apps benefit without code changes.
- **Cons:** No default is correct for both content visibility and compactness; changing
  existing apps would be visually breaking and context-dependent behavior would be hard
  to predict.

## Out of scope and follow-ups

### Text and non-button label line wrapping

[#12583](https://github.com/streamlit/streamlit/issues/12583) asks for non-wrapping
`st.markdown` and `st.text`. Widget labels can also change height at intermediate widths,
as the audit shows. This refers to labels displayed above inputs such as `st.selectbox`;
checkbox and toggle labels are covered by this proposal. Other labels need a separate
design because truncating descriptive content has different usability and API trade-offs
from truncating a compact control label.

A follow-up should compare a generic `max_lines: int | None` API with targeted automatic
ellipsis for widget labels. Adding `wrap` to every text-bearing widget in this project
would create a much larger API surface.

### Configurable column wrapping threshold

`st.columns(wrap=False)` covers layouts that must never stack. It does not cover #6592,
where columns should stack **earlier** based on their content or a custom minimum width.
A follow-up can investigate a `min_width` parameter or container-query-based automatic
behavior after the binary opt-out is validated.

### Wrapped-row alignment and distribution

This proposal offers a single-row alternative for #12645 and #12038 but does not change
`wrap=True`. Better alignment and balanced row distribution can be implemented
independently without an API change.

### Horizontal radio layout

[#7184](https://github.com/streamlit/streamlit/issues/7184) primarily requests that radio
options distribute across the available width. `st.pills` and `st.segmented_control`
already serve compact horizontal selection better, so `st.radio` is excluded from the
initial API. `st.radio(horizontal=True)` could technically accept `wrap` for consistency,
but it is left out to keep the initial surface minimal; it can adopt the same one-row
contract in a follow-up if demand warrants.

### Styled, only-when-clipped label tooltip

The full-label tooltip uses the native HTML `title` for simplicity (see "Tooltip for the
full label"), which means it uses the browser's default styling and shows even when the
label is not actually clipped. A follow-up could replace it with Streamlit's styled
tooltip gated on real truncation detection (measuring the label width and re-checking on
resize) so it matches the `help` tooltip styling and appears only when the label is
clipped. This was intentionally deferred to avoid the frontend measurement machinery.

## Documentation and testing

- Add parameter documentation and a compact-toolbar example to each command.
- Add one guide example comparing wrapping and horizontally scrolling option groups.
- Add one guide example showing a no-wrap toolbar that combines
  `st.container(horizontal=True, wrap=False)` and `st.button(wrap=False)`.
- Add frontend tests for no-wrap styles, scoped overflow, focus visibility, and pinned
  multiselect controls.
- Add button tests for ellipsis, icons, shortcuts, Markdown, accessible names, and
  popover/menu expansion icons.
- Add tests that the full-label `title` tooltip is set when `wrap=False` and no `help` is
  set, is omitted when `help` is present (so `help` takes precedence), and uses plain text
  for Markdown labels.
- Add tests that the auto default (`wrap=None`) resolves to no-wrap inside a horizontal
  container and to wrapping in other layouts for single-label and multi-item controls, and
  that `st.container` and `st.columns` keep their fixed default (today's wrapping and
  stacking) regardless of the surrounding layout.
- Add checkbox and toggle tests for ellipsis, fixed indicators, help icons, label
  visibility, and accessible names.
- Add E2E coverage at desktop, intermediate, and phone widths in Chromium, Firefox, and
  WebKit.
- Test touch-style horizontal scrolling and keyboard navigation.
- Verify light/dark themes, sidebar, dialog, form, popover, fragment, and embedded iframe
  contexts.
- Verify protobuf messages with an absent `wrap` field resolve via the auto default for
  controls — wrapping in vertical layouts and staying single-row inside horizontal
  containers — while `st.container` and `st.columns` keep today's wrapping and stacking.

## Checklist

| Item | ✅ or comment |
| --- | --- |
| Works on SiS, Cloud, etc? | ✅ Frontend-only behavior; no platform-specific API |
| No breaking API changes | ✅ Additive parameter; the auto default preserves current behavior except for controls inside horizontal containers, where it favors a single row; layout containers keep their current defaults |
| No new dependencies | ✅ Uses native flex and overflow behavior |
| Metrics collected | ✅ Page profiling for explicit `wrap=False` |
| Any security/legal impact? | ✅ None |
| Any docs changes needed? | ✅ API docs and layout examples |
