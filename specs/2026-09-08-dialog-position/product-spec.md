---
author: lukasmasuch
created: 2026-09-08
---

# Position `st.dialog` as a side drawer

## Summary

Add a keyword-only `position` parameter to `@st.dialog` that accepts
`"center"` (default), `"left"`, or `"right"`. `"left"` and `"right"` render the
dialog as a full-height, dismissible modal side drawer attached to the edge of
the viewport instead of a centered modal. Apart from placement and pointer-drag
resizing, the drawer stays modal, and `width`, `dismissible`, `icon`, and
`on_dismiss` behave identically in every position.

This extends the existing dialog surface rather than adding a separate
`st.drawer` command, so users get side drawers with a one-word change and no new
mental model.

## Problem

Streamlit has centered modal dialogs (`@st.dialog`), transient popovers
(`st.popover`), and one persistent left `st.sidebar`. It has no drawer — a
panel that slides in from the side, temporarily overlaps the main area without
replacing it, and is dismissed on demand. Drawers are a common surface for
right-hand detail/inspector panels and side-anchored settings or filter forms.
On-demand chat or assistant panels that stay open while the main page remains
interactive are a non-modal companion pane and are out of scope (see
[Non-modal companion panes need a dedicated command](#non-modal-companion-panes-need-a-dedicated-command)).

### User requests

- [#8186](https://github.com/streamlit/streamlit/issues/8186) asks for a
  dismissible container that slides in from the
  side and overlaps the main content without masking it, for use cases like a
  Copilot/GitLab-Duo-style chat panel, a details/inspector panel, continuous
  data entry, or a side-anchored form. A maintainer noted this is appealing
  specifically when it is *not* a permanent sidebar but shows up temporarily and
  overlaps the page.
- [#1980](https://github.com/streamlit/streamlit/issues/1980) asks for a
  permanent second sidebar on the right for long-form explanations and guidance.
  This is a persistent-layout request rather than an on-demand overlay and needs
  a dedicated command (see [Non-modal companion panes need a dedicated command](#non-modal-companion-panes-need-a-dedicated-command)).

### Current workarounds

- **Left `st.sidebar`.** The only built-in side panel. It is always the left
  navigation surface and cannot be summoned on demand, positioned on the right,
  or shown/hidden per interaction without session-state juggling. Rich
  conditional content clutters navigation. #8186 explicitly calls this out.
- **Centered `@st.dialog`.** Works for confirmations and short forms, but a
  centered modal covers the middle of the page. It is a poor fit for a tall
  detail panel or a chat panel that should sit beside the content the user is
  looking at.
- **Custom components / injected CSS.** Community drawer components and CSS hacks
  that re-anchor a dialog exist, but they depend on Streamlit's private DOM and
  break across versions.

### Use cases

1. **Detail / inspector panel.** Click a row (for example, a `ButtonColumn`
   cell in `st.dataframe`) and open a right-hand drawer showing that record's
   full details, then dismiss it back to the table.
2. **Side-anchored form or settings.** A roomier alternative to a centered
   dialog for a multi-field form, filters, or configuration that is filled in,
   submitted, and closed without navigating away from the page.
3. **Help & documentation.** Show substantial supporting content (docs,
   onboarding, a walkthrough) beside the current page and dismiss it when done,
   instead of lengthening the page inline.

Each is a temporary, action-opened task where the user finishes in the drawer
and returns to the page — the modal contract fits. Surfaces the user keeps open
*while* working in the main page (copilots, persistent panels) are a separate
concern; see
[Non-modal companion panes need a dedicated command](#non-modal-companion-panes-need-a-dedicated-command).

## Proposal

### API

Add `position` as a keyword-only parameter to `@st.dialog`, placed right after
`width` (both describe the dialog's shape and placement):

```python
@st.dialog(
    title: str,
    *,
    width: Literal["small", "medium", "large"] = "small",
    position: Literal["center", "left", "right"] = "center",  # NEW
    # ... existing parameters (dismissible, icon, on_dismiss) ...
)
```

| Value | Placement |
| --- | --- |
| `"center"` (default) | Centered modal in the viewport (today's behavior, unchanged). |
| `"left"` | Full-height drawer flush to the left edge of the viewport. |
| `"right"` | Full-height drawer flush to the right edge of the viewport. |

An invalid value raises `StreamlitValueError` (listing `'left'`, `'center'`,
`'right'`), matching how `st.navigation(position=...)` and `on_dismiss` validate
their arguments. Unlike `width`, which silently falls back to `"small"` for
unrecognized values, `position` follows the stricter, fail-fast pattern.

### Behavior

A side drawer is the same modal dialog, re-anchored to an edge. Aside from
placement and interactive resizing (below), its behavior is identical to a
centered dialog:

- **Still modal.** The rest of the app is inert while the drawer is open, and an
  overlay dims the background. This is the key difference from the original
  #8186 request, which imagined an optionally non-modal, background-scrollable
  panel. Keeping the modal contract means one predictable dismissal model and no
  new "is the background interactive?" mode to design and document.
- **Dismissal is unchanged.** When `dismissible=True` (default), the user can
  dismiss via the "**X**", `ESC`, or clicking the dimmed area outside the drawer.
  When `dismissible=False`, the "**X**" is hidden and the drawer must be closed
  programmatically with `st.rerun()`. `on_dismiss` (`"ignore"` / `"rerun"` /
  callback) applies the same way.
- **`width` sets the initial thickness.** The existing width caps apply to the
  drawer's horizontal width: `"small"` ≈ 500px (default), `"medium"` ≈ 750px,
  `"large"` ≈ 1280px. This is the drawer's starting width. The drawer always
  spans the full viewport height.
- **Resizable.** Left and right drawers can be resized by dragging their inner
  edge (the one facing the app). `width` sets the starting width; the drag
  overrides it, and double-clicking the handle restores the preset (matching
  `st.sidebar`). A dragged width persists for the currently open drawer,
  including across fragment reruns triggered by widgets inside it. It resets to
  the `width` preset when the drawer is dismissed, and does not persist across a
  page reload. It is per-dialog (not shared across dialogs). Resizing is
  pointer-based (matching `st.sidebar`) and handled entirely
  in the frontend — it does not rerun the app or change widget state — and does
  not apply to centered dialogs. Because the drawer overlays the page, resizing
  changes only the drawer's own width; the main content is not reflowed (unlike
  `st.sidebar`, where dragging resizes both the sidebar and the main area). The
  handle stays available at every viewport size; the width is clamped so a strip
  of the app always remains visible, and users can still drag narrower on small
  screens. The pointer-only tradeoff is covered under **Accessibility** below.
- **Geometry.** The panel is flush to its edge (no outer margin) and has square
  inner corners, so it reads as attached to the viewport rather than floating. A
  left drawer overlays the `st.sidebar` and the app header; a right drawer
  overlays the header. Neither docks beside app chrome or reflows it, and the
  covered chrome (including the sidebar collapse control) is inert with the rest
  of the app while the drawer is open.
- **Scrolling.** Tall content scrolls inside the drawer panel; the panel itself
  stays pinned full-height and does not move as content scrolls.
- **Never full-screen.** The drawer always leaves a small strip of the app
  visible on the inner edge (the side facing the page), so it never fully covers
  the viewport. This caps the maximum width everywhere — the `width` presets,
  user resizing, and narrow (mobile) screens, where the drawer expands toward but
  stops short of covering the full width.
- **Accessibility.** Side drawers keep dialog modal semantics: focus moves into
  the drawer and is trapped, the rest of the app is inert, and focus returns to
  the opener on close. Nested widget overlays (selectboxes, date pickers,
  dataframe menus) render above the drawer. Resize is pointer-only, matching
  `st.sidebar`; this trades off WCAG 2.2 SC 2.5.7 (Dragging Movements), which is
  acceptable because the drawer is fully usable at the `width` preset, so
  resizing is a convenience rather than required functionality. The resize
  handle is intentionally not a tab stop (`aria-hidden` and not focusable): a
  focusable-but-unlabeled control inside the dialog's focus trap would be worse
  than no keyboard handle, and a fully accessible one would need a visible focus
  style, an assistive-tech name, and an extra tab stop for little benefit. A
  keyboard-operable resize handle is out of scope for v1.
- **`icon`, Markdown title, one-dialog-at-a-time, fragment rerun semantics, and
  the "no `st.sidebar` inside a dialog" rule** are all unchanged.

`position` is placement-only: it does not change widget state, fragment/rerun
semantics, or return behavior. It is part of the dialog's element identity (used
so the frontend never reuses another dialog's DOM and shows stale content), the
same as `width`.

### Examples

**Simplest — a right drawer:**

```python
import streamlit as st


@st.dialog("Details", position="right")
def show_details(item):
    st.write(f"Details for {item}")


if st.button("Open details"):
    show_details("Order #1234")
```

**Detail panel opened by a `ButtonColumn` click:**

```python
import pandas as pd
import streamlit as st


@st.dialog("Row details", position="right", width="medium")
def row_details(row):
    st.header(row["name"])
    st.json(row)


df = pd.DataFrame({"name": ["Alice", "Bob"], "role": ["Admin", "User"]})
df["view"] = ":material/visibility: View"

st.dataframe(
    df,
    column_config={"view": st.column_config.ButtonColumn("", key="view_click")},
    hide_index=True,
)

# The click trigger value is set only during the click rerun, so the drawer
# opens once and does not reopen on subsequent reruns.
if click := st.session_state.get("view_click"):
    row_details(df.iloc[click["row"]].to_dict())
```

**Left settings drawer that closes on submit:**

```python
import streamlit as st


@st.dialog("Filters", position="left")
def filters():
    category = st.selectbox("Category", ["All", "Books", "Toys"])
    if st.button("Apply"):
        st.session_state.category = category
        st.rerun()  # Closes the drawer.


if st.button("Edit filters"):
    filters()
```

## Alternatives considered

### Option A: `position` parameter on `@st.dialog` — ✅ preferred

```python
@st.dialog("Details", position="right")
```

- **Pros:** A side drawer *is* a placement variant of the modal-overlay concept
  Streamlit already ships. Dismissal, `width`, `icon`, `on_dismiss`,
  one-at-a-time, and fragment reruns are all identical, so extending the command
  reuses everything and follows "extend before inventing." Users adopt it with a
  one-word change and no new API to learn. `position` is a semantic name that is
  already established vocabulary in the API — `st.navigation(position=...)`
  places the navigation menu (`"sidebar"` / `"top"` / `"hidden"`) — so reusing it
  follows the standardized-vocabulary principle, and a `Literal` leaves room to
  grow (see below).
- **Cons:** `@st.dialog` now has two shape/placement parameters (`width` and
  `position`); the naming "dialog" is slightly less obvious for a drawer than a
  dedicated command would be.

### Option B: New `st.drawer` command (the literal #8186 request)

```python
@st.drawer("Details")
```

- **Pros:** Most discoverable name for the drawer use case; could later diverge
  from dialog semantics (for example, a non-modal drawer).
- **Cons:** Duplicates almost the entire dialog surface (dismiss model, `width`,
  `icon`, `on_dismiss`, one-open-at-a-time, fragment behavior) for what is
  fundamentally the same modal overlay in a different position. Two overlapping
  commands increase API surface and force users to choose between near-identical
  APIs. If richer drawer-only behavior is demanded later, a dedicated command can
  still be introduced without blocking this smaller step.

### Option C: `drawer: bool` (or `side: "left" | "right"`) instead of `position`

```python
@st.dialog("Details", drawer=True)
```

- **Pros:** Minimal.
- **Cons:** A boolean cannot express left vs right and locks out future
  placements; it also splits placement across two ideas (centered vs. drawer,
  then which side). A single `position` enum covers center/left/right today and
  can grow to `"top"`/`"bottom"` later, following "prefer enums over booleans."

## Non-modal companion panes need a dedicated command

This spec covers only the **modal** case: while a side drawer is open, the rest
of the app is inert. That fits temporary, action-opened content — details, short
forms, help — where the user finishes in the drawer and returns to the page.

It intentionally does **not** cover surfaces that must stay open *while the user
keeps interacting with the main page*, such as:

- A persistent copilot or agent canvas beside the main content.
- A right-hand reference/help or settings pane kept open across interactions.
- A permanent second, right-side sidebar for long-form guidance
  ([#1980](https://github.com/streamlit/streamlit/issues/1980)).
- Continuous side-by-side workflows — edit in the panel, watch results update in
  the page — as also envisioned in
  [#8186](https://github.com/streamlit/streamlit/issues/8186).

The two forms differ in far more than appearance:

| Aspect | Modal side drawer (`st.dialog`, this spec) | Non-modal companion pane (future command) |
| --- | --- | --- |
| Primary job | Temporary details, forms, or help | Persistent companion kept open while working |
| Python form | Decorated function call | Root or stateful container composition |
| Main app while open | Visible but inert | Interactive (at least on wide screens) |
| Content execution | Lazy fragment | Eager on full reruns |
| Full main-app rerun | Closes unless the function is called again | Stays open; re-emits stable content |
| Desktop layout | Overlay with backdrop | Docks and reflows the page; optional overlay |
| Resizing | Drags the drawer's own width only | Sidebar-like: reflows the main content as it resizes |
| Compact (mobile) layout | Clamped side overlay (never full-width) | Modal sheet |
| Implementation | Reuses shipped dialog/event infrastructure | New root container and app-shell layout |
| Directly covers | #8186 (temporary side content) | #8186 (persistent) and #1980 |

These require a different usage pattern and should be their own command (a
non-modal drawer / side canvas / sheet, or a right-side `st.sidebar` variant),
not a `modal=False`-style flag on `st.dialog`, for two reasons:

1. **Modality is not a one-line toggle in Streamlit.** In a typical component
   library, "non-modal" just removes the backdrop and focus trap. In Streamlit
   it also changes the execution lifecycle. A dialog/decorator surface opens
   because its function is called during a script run; after a main-area
   interaction triggers a full rerun, that call no longer happens, so the
   surface closes. A `modal=False` flag would therefore either disappear on the
   next main-page interaction or require new rules for keeping event content
   alive across full reruns — far more than the boolean suggests.
2. **A modeless pane needs persistent, layout-level state.** To stay open across
   reruns while the main canvas remains interactive, the surface must behave like
   a root container (`st.sidebar`) or a stateful container (`open` + `key` +
   `on_change`, like `st.expander` / `st.popover`), and likely dock and reflow
   the layout on wide screens instead of overlaying it. That is a substantial
   product, state, accessibility, and frontend-layout effort that stands on its
   own.

Design systems treat these as distinct modes rather than a single "drawer":
Ant Design, Base Web, and shadcn ship both masked/modal and explicitly modeless
drawers, while HashiCorp's Helios Flyout is a modal-only side overlay. The modal
form is what this spec delivers; the modeless form is the separate command.

### Possible shapes (illustrative, not proposed)

A dedicated command could take a few forms. Two sketches show why the lifecycle
is different from a decorator:

**Modeless root container with an imperative `update()`** — composed like
`st.sidebar` and opened programmatically, so its content survives full reruns:

```python
def open_order(order_id: str) -> None:
    st.session_state.selected_order = order_id
    st.drawer.update(open=True)


st.button("Open details", on_click=open_order, args=(order_id,))

# Re-emitted on every run, so the pane stays open while the main app is used.
if selected_order := st.session_state.get("selected_order"):
    with st.drawer:
        render_order(selected_order)
```

**Stateful container** following the `st.expander` / `st.popover` pattern
(`open` + `key` + `on_change`), where open state lives in Session State:

```python
drawer = st.drawer(open=False, key="order_details", on_change="rerun")

if drawer.open:
    with drawer:
        render_order(st.session_state.selected_order)
```

Both keep the main canvas interactive and the pane open across reruns — behavior
the modal decorator deliberately does not provide. We keep them as future work
so this spec can ship the small, self-contained modal enhancement now without
committing to the larger companion-pane design.

## Out of scope (future work)

- **Non-modal companion panes** (persistent copilot/canvas, right-hand reference
  pane, permanent second right sidebar for #1980). These keep the main page
  interactive and need a dedicated command with a different lifecycle — see
  [Non-modal companion panes need a dedicated command](#non-modal-companion-panes-need-a-dedicated-command).
- **`"top"` / `"bottom"` drawers.** The `position` enum can grow to add these
  later if requested; only `"left"`/`"right"` ship initially.
- **Multiple simultaneous drawers.** The one-dialog-at-a-time rule still applies,
  so a drawer and a centered dialog cannot be open at once.

## Checklist

| Item | ✅ or comment |
| --- | --- |
| Works on SiS, Cloud, etc? | ✅ Placement is handled in the frontend; no platform-specific API. |
| No breaking API changes | ✅ New optional parameter; default `"center"` preserves today's behavior. |
| No new dependencies | ✅ Reuses the existing Modal component and layout. |
| Metrics collected | ✅ Covered by the existing `@st.dialog` `gather_metrics` tracking (records that the `position` keyword was passed — argument name, type, and length). We intentionally rely on this and do not add dedicated tracking of the specific `"left"`/`"center"`/`"right"` value. |
| Any security/legal impact? | ✅ None. As with `dismissible`, a side drawer being modal is not a security guarantee — do not rely on it to block main-app interaction for security-critical checks. |
| Any docs changes needed? | ✅ Update the `st.dialog` docstring/API reference and the layouts skill reference (both done in the implementation PR). Public docs mention only that side drawers are user-resizable — not the drag mechanics, starting-vs-dragged width, or rerun behavior (users discover drag, as with `st.sidebar`). |
