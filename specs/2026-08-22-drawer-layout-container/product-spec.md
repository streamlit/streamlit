---
author: lukasmasuch
created: 2026-08-22
---

# Drawer (`st.drawer`)

## Summary

Add a full-height surface that enters from a viewport edge for record details,
copilots, help, settings, and secondary workflows.

There are two coherent product directions:

1. A **modal decorator**, following `@st.dialog`, for temporary content opened by an
   app action. This is the smallest API and implementation.
2. A **modeless root container**, following `st.sidebar`, for a resizable companion
   pane that keeps the main canvas interactive.

Both address valid use cases, but they have different execution and state lifecycles.
This spec compares them rather than hiding both behaviors behind one overloaded API.
The decorator direction is specified in more detail so reviewers can evaluate the
simpler v1 independently.

## Problem

Streamlit has no side surface for substantial secondary content:

- `st.sidebar` is a leading root container intended primarily for navigation and
  global controls.
- `st.dialog` is modal, centered, and optimized for focused tasks.
- `st.popover` is anchored to a built-in trigger and best suited to compact content.
- `st.expander` keeps secondary content in the document flow and lengthens the page.

### User requests

- [#8186](https://github.com/streamlit/streamlit/issues/8186) requests a dismissible
  surface that slides in from the side for information, forms, chat, and continuous
  interactions.
- [#1980](https://github.com/streamlit/streamlit/issues/1980) requests a right-hand
  surface for explanations, settings, help, and assistants.
- [#7311](https://github.com/streamlit/streamlit/issues/7311) requests configurable
  sidebar placement.

### Use cases

1. **Action-opened details:** Open a record or artifact from a table, card, or button,
   then dismiss it back to the originating context.
2. **Secondary workflow:** Complete a form without navigating away from the current
   page.
3. **Help and documentation:** Read substantial supporting content without placing it
   inline.
4. **Persistent copilot:** Keep an assistant visible while working in the main canvas.
5. **Settings and filters:** Place controls beside their results and continue using
   both areas.

The first three work naturally as a modal drawer. The last two materially benefit from
a modeless companion pane.

## What other design systems establish

The term “drawer” describes a spatial form, not a universal modality contract:

- [Ant Design Drawer](https://ant.design/components/drawer/) is masked by default but
  exposes four placements, optional title and close controls, controlled open state,
  sizes, and resizing.
- [Base Web Drawer](https://baseweb.design/components/drawer/) exposes four anchors,
  controlled visibility, several sizes, an optional backdrop, and dialog-style focus
  behavior.
- [shadcn Drawer](https://ui.shadcn.com/docs/components/base/drawer) supports four
  swipe directions and explicitly allows `modal={false}`. Its separate
  [Sheet](https://ui.shadcn.com/docs/components/base/sheet) extends a dialog and
  supports four sides.
- [HashiCorp Helios Flyout](https://helios.hashicorp.design/components/flyout) is a
  right-side, full-height modal overlay with medium and large sizes, a required title,
  focus trapping, and an inert page.
- [Atlassian Drawer](https://atlassian.design/components/drawer) is a left-side panel
  that is planned for deprecation in favor of Modal.

These systems validate both modal and non-modal uses. They do not resolve the
Streamlit-specific question: a modal decorator has a stable fragment lifecycle, while
a modeless surface must survive unrelated full-script reruns.

## Product directions

| Question | Modal decorator | Modeless root container |
|---|---|---|
| Primary job | Temporary details or workflow | Persistent companion canvas |
| Python form | Decorated function call | Root container composition |
| Main app while open | Visible but inert | Interactive on wide screens |
| Content execution | Lazy fragment | Eager full rerun by default |
| Full main-app rerun | Closes unless function is called again | Re-emits stable root content |
| Desktop layout | Overlay with backdrop | Docked/reflow by default; optional overlay |
| Compact layout | Modal sheet | Modal sheet |
| Implementation | Reuse dialog/event infrastructure | Add a fifth root and app-shell layout |
| Directly covers | #8186 | #8186 and #1980 |

### Why a `modal` parameter is not a small compromise

It is tempting to add `modal: bool = True` to the decorator. In a browser component,
that can mean only “remove the backdrop and focus trap.” In Streamlit, it also changes
the execution lifecycle:

```python
@st.drawer("Details", modal=False)
def details(): ...


if st.button("Open"):
    details()
```

After a main-area interaction, the app performs a full rerun. The button is no longer
newly clicked, so `details()` is not called and the drawer disappears. Keeping it open
requires Session State plus an `on_dismiss` callback, or a new rule that event content
survives full reruns. Both are substantially more complex than the apparent boolean.

Therefore, the decorator proposal below is modal in v1 and has no `modal` parameter.
The root-container proposal owns the modeless use case.

## Option 1: Modal decorator

### Proposed API

```python
def drawer(
    title: str | None = None,
    *,
    position: Literal["left", "right"] = "right",
    width: DialogWidth = "small",
    dismissible: bool = True,
    icon: str | None = None,
    on_dismiss: Literal["ignore", "rerun"] | WidgetCallback = "ignore",
) -> Callable[[F], F]: ...
```

An overload also accepts the decorated function directly, so the decorator supports
both bare and configured forms:

```python
@st.drawer
def show_help():
    st.markdown(help_text)


@st.drawer(
    "Order details",
    position="right",
    width="medium",
    icon=":material/receipt_long:",
)
def show_order(order_id: str):
    render_order(order_id)
```

The decorated function may accept positional and keyword arguments. Calling it opens
the drawer and renders its Streamlit commands inside the drawer body.

### Parameters

| Parameter | Proposed behavior |
|---|---|
| `title` | Optional visible header title. Supports the same inline Markdown as `st.dialog`. If omitted, the sticky header contains only the close control and the surface uses the accessible name “Drawer.” |
| `position` | Edge from which the drawer enters: `"right"` (default) or `"left"`. Top and bottom add height and mobile-policy questions, so they are deferred. |
| `width` | Reuse `st.dialog` values and dimensions: `"small"` (default), `"medium"`, or `"large"`. On a narrow viewport, available width wins. |
| `dismissible` | Match `st.dialog`. When `True`, X, `Escape`, and backdrop press dismiss. When `False`, those paths are disabled and app logic must call a full `st.rerun()` to close. |
| `icon` | Optional emoji, Material icon, or `"spinner"`, following `st.dialog`. Supplying an icon without a title raises `StreamlitAPIException`. |
| `on_dismiss` | Match `st.dialog`: `"ignore"`, `"rerun"`, or a callback that runs before the dismissal rerun. |

This deliberately adds only two differences from `st.dialog`: the side presentation
and an optional title. `position` is the only new behavioral parameter.

### Basic details example

```python
import streamlit as st


@st.drawer("Order details", icon=":material/receipt_long:")
def show_order(order_id: str) -> None:
    order = load_order(order_id)
    st.metric("Total", order.total)
    st.dataframe(order.line_items)


if st.button("Open order 1042"):
    show_order("1042")
```

Closing the drawer returns the user to the button. The drawer can only be reopened by
calling `show_order(...)` again.

### Untitled help example

```python
@st.drawer
def show_help() -> None:
    st.subheader("How this report works")
    st.markdown(help_text)


if st.button("Help", icon=":material/help:"):
    show_help()
```

The content heading is app output, not framework chrome. The drawer keeps a compact
sticky row for its close control.

### Dismissal callback example

```python
def clear_editing_state() -> None:
    st.session_state.editing_order = None


@st.drawer(
    "Edit order",
    position="left",
    width="medium",
    on_dismiss=clear_editing_state,
)
def edit_order(order_id: str) -> None:
    render_order_form(order_id)


if order_id := st.session_state.editing_order:
    edit_order(order_id)
```

The callback clears the condition before the full dismissal rerun, so the drawer does
not immediately reopen.

### Lifecycle

The behavior matches `@st.dialog`:

| Event | Behavior |
|---|---|
| Call the decorated function | Open the drawer |
| Interact with a widget inside | Rerun only the drawer fragment and keep it open |
| Call `st.rerun(scope="fragment")` during a drawer rerun | Rerun the drawer fragment |
| Call full `st.rerun()` inside | Run the full app; close unless app code calls the drawer again |
| Dismiss with `on_dismiss="ignore"` | Close in the browser without a rerun |
| Dismiss with `on_dismiss="rerun"` | Close and rerun the full app |
| Dismiss with a callback | Run the callback, then rerun the full app |
| Interact with the main app | Not possible while the drawer is open |

The drawer body inherits normal fragment restrictions. Side effects in external
containers accumulate across fragment reruns, and `st.sidebar` calls from the drawer
function are unsupported.

### Visual and responsive behavior

- The drawer overlays the entire app from the configured edge and spans the dynamic
  viewport height.
- A light backdrop keeps page context visible while communicating that it is inert.
- A sticky header holds the optional icon and title plus the close control. The body
  scrolls independently.
- Width uses the selected dialog preset and is capped by available viewport width.
  The user cannot resize it in v1, and no browser-local width is stored.
- On phone-sized viewports, the drawer fills the viewport width and height, including
  safe-area and software-keyboard handling. It continues to enter from its configured
  side rather than changing to a bottom sheet.
- The drawer uses the main theme, even when opened from `st.sidebar`.
- Entry and exit use a short horizontal transition and honor
  `prefers-reduced-motion`.

### Accessibility

The drawer uses modal dialog semantics:

- Move focus into the drawer on open and trap it while open.
- Make the rest of the app inert to pointer, keyboard, scrolling, and assistive
  technology.
- Return focus to the opener when it still exists, otherwise use a stable fallback.
- Give the close control an accessible name and support `Escape` when dismissible.
- Use the visible title as the accessible name. Without a title, use `aria-label="Drawer"`.
- Ensure nested widget overlays, including selects, date pickers, dataframe menus, and
  popovers, render and remain interactive above the drawer.
- A backdrop press dismisses but never activates the underlying app.

### Restrictions and errors

- Only one modal event surface may be open at a time. A script run cannot open two
  drawers, a drawer and dialog, or nested modal surfaces.
- `title=""` is treated like no title. `icon` without a non-empty title raises a clear
  error.
- Invalid `position`, `width`, or `on_dismiss` values fail immediately with the same
  error conventions as existing commands.
- A non-dismissible drawer is a UX constraint, not a security boundary.
- The decorator is unavailable from a parallel fragment worker, matching `st.dialog`.

### Trade-offs

**Pros**

- Small public API: nearly identical to `st.dialog`.
- Natural programmatic trigger and parameterized content.
- Lazy fragment execution and dismissal callbacks are already understood.
- Reuses the event root, modal state, focus management, stale cleanup, and most tests.
- No fifth root container, app-shell reflow, resize persistence, or open-state protocol.

**Cons**

- Main-area interaction is disabled on every viewport.
- Does not provide a persistent agent canvas or right sidebar.
- Full app reruns close the drawer unless the app calls it again.
- Large drawers can feel unnecessarily modal for reference content used alongside the
  page.

## Option 2: Modeless root container with `update()`

```python
def show_order(order_id: str) -> None:
    st.session_state.selected_order = order_id
    st.drawer.update(open=True)


st.button("Open details", on_click=show_order, args=(order_id,))

if selected_order := st.session_state.get("selected_order"):
    with st.drawer:
        render_order(selected_order)
```

On wide screens, this drawer is a resizable trailing pane that shrinks and reflows the
main area by default. Users can undock it into a modeless overlay. When there is not
enough room for the drawer plus at least `480px` of main content, it becomes a modal
sheet.

`update(open=True)` follows the mutable-container pattern established by
`st.status().update(...)`. Passive content collapses to a framework-owned edge
launcher; an app-controlled opening dismisses without a launcher and reopens only
through another app action.

**Pros**

- Covers both persistent companion and action-opened details use cases.
- Keeps the desktop main canvas interactive and unobscured when docked.
- Stable root content naturally survives unrelated full reruns.
- `with st.drawer:` is as concise as `st.sidebar`.

**Cons**

- Requires a fifth root, app-shell layout changes, responsive docking, resizing, and
  frontend-owned state.
- Eager content executes on full reruns even while closed.
- Python cannot observe browser-only dismissal or run a callback.
- Passive versus app-controlled close behavior is implicit.

## Option 3: Stateful root container

```python
drawer = st.drawer(
    open=False,
    key="order_details",
    on_change="rerun",
)


def show_order(order_id: str) -> None:
    st.session_state.selected_order = order_id
    st.session_state.order_details = True


st.button("Open details", on_click=show_order, args=(order_id,))

if drawer.open:
    with drawer:
        render_order(st.session_state.selected_order)
```

This follows the newer `st.expander`, `st.popover`, and `st.tabs` state pattern. It
adds `open`, `key`, `on_change`, `args`, `kwargs`, and a returned `.open` property.

**Pros**

- Supports Session State control, user-close callbacks, and lazy content.
- State survives full main-area reruns predictably.
- Uses established container state vocabulary.

**Cons**

- More parameters and boilerplate than either the modal decorator or `update()` root.
- Opening and closing trigger full reruns.
- The common form becomes `with st.drawer():` rather than `with st.drawer:`.
- Inherits widget restrictions in cached functions, forms, and fragment writes to
  outside containers.

## Option 4: Combine decorator and root container

```python
with st.drawer:
    render_copilot()


@st.drawer("Details")
def show_details() -> None:
    render_details()
```

This puts two visually similar surfaces under one discoverable name, but their
execution, rerun, dismissal, and composition behavior differ. The public object must
also be both a container proxy and decorator factory.

**Recommendation:** Do not combine these forms in v1. A simple API is more than a
short name; the same syntax family should have one lifecycle.

## Decision framework

The design-system survey does not make one direction objectively correct. The decision
depends on which primary job v1 promises:

- Choose the **modal decorator** when simplicity, details, forms, and action-triggered
  content are primary. This is a strong, self-contained feature, but it intentionally
  leaves #1980's persistent pane unsolved.
- Choose the **modeless root container** when copilots, agent canvases, and simultaneous
  work are primary. This covers more use cases but requires substantially more product,
  state, and frontend layout design.

If the decorator is selected, ship it as modal-only rather than adding a misleadingly
simple `modal=False`. If the root is selected, prefer `update(open=...)` for the
smallest v1 unless Python-readable dismissal and lazy execution are launch
requirements.

## Technical feasibility

### Modal decorator

Reuse `dialog_decorator`, the event root, implicit fragments, widget-backed
`on_dismiss`, and modal frontend primitives. Add drawer-specific position and styling
to the dialog block or introduce a sibling event block that shares the same single-open
guard. The latter keeps dialog styling and drawer placement explicit in the proto.

The main new work is a full-height edge panel, optional-title header, left/right
transitions, viewport and keyboard handling, and layering tests. No app-shell reflow,
root-tree changes, or persistent width state are required.

### Modeless root

Add a fifth `RootContainer`, a corresponding `AppRoot` node, and an adaptive drawer in
`AppView`. A stable workspace flex wrapper after the sidebar contains the main content
and drawer, allowing docked reflow without a resize feedback loop. The `update()`
variant needs a one-shot control message; the stateful variant can reuse bool widget
state and `on_change` machinery.

## Out of scope (future work)

- Shipping modal decorator and modeless root lifecycles under the same `st.drawer`
  name in v1.
- `modal=False` on the decorator without a separate persistent-state design.
- `position="top" | "bottom"`; these require direction-independent sizing and a mobile
  policy.
- User resizing or browser-local width persistence for the modal decorator.
- Multiple or stacked drawers and nested drawer/dialog surfaces.
- Built-in trigger elements.
- Swipe-to-dismiss and snap points on mobile.
- Drawer-specific theme configuration.

## Checklist

| Item | ✅ or comment |
|---|---|
| Works on SiS, Cloud, etc.? | ✅ Both options use existing element transport and size to the embedded viewport. |
| No breaking API changes | ✅ New additive API. |
| No new dependencies | ✅ Reuses existing modal, resize, icon-button, and theme primitives as applicable. |
| Metrics collected | ✅ Record decorated calls or root/control usage through normal command metrics. |
| Any security/legal impact? | ✅ No new data or network surface. Modality and `dismissible=False` are UX behavior, not authorization boundaries. |
| Any docs changes needed? | ✅ Compare drawer, sidebar, dialog, popover, and expander; document lifecycle, modality, position, dismissal, and mobile behavior. |
