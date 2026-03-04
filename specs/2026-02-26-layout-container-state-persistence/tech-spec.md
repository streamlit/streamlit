---
author: sfc-gh-lwilby
created: 2026-02-26
---

# Layout Container State Persistence Across Reruns

## Summary

When a Streamlit app reruns, `st.tabs`, `st.expander`, and `st.popover` reset their frontend
state — the active tab, expanded state, or open state — because the backend always sends the
configured default and the frontend resets to it. This causes jarring jumps when any widget
interaction triggers a rerun, and when conditional elements above the container cause it to
remount. This spec proposes a fix that uses a backend-generated counter-based identity to give
every container element a stable key, combined with a frontend store that uses that key to
restore state across reruns and remounts — without any API changes or widget registration.

## Problem

### Current Behavior

For non-stateful containers (`on_change` not set, or `on_change="ignore"`), the backend
always sends the configured default state. The frontend resets to it on every rerun:

- The user navigates to Tab 3, then interacts with any widget → app reruns → tabs jump back
  to Tab 1.
- The user opens an expander, then a conditional element above it changes → the expander
  remounts collapsed.
- The user opens a popover, interacts with a widget inside → app reruns → popover closes.

```python
tab1, tab2, tab3 = st.tabs(["Overview", "Details", "Raw Data"])

with tab1:
    st.write("Summary")
with tab2:
    st.dataframe(df)  # User navigates here
with tab3:
    st.json(data)

# User clicks this button → app reruns → user is snapped back to "Overview"
if st.button("Refresh"):
    df = fetch_data()
```

### User Requests

**`st.tabs`:**
- [#8239](https://github.com/streamlit/streamlit/issues/8239) — `st.tabs` & `st.expander`:
  Improve handling of frontend state/mount (79 👍). This spec addresses both the tab position
  reset and the expander expanded-state reset.
- [#6257](https://github.com/streamlit/streamlit/issues/6257) — Component in tab 2 triggers
  app to jump back to tab 1.
- [#7435](https://github.com/streamlit/streamlit/issues/7435) — Changing name to a tab after
  a rerun switches to the first tab. Resolved: the counter-based identity is independent of
  both labels and index, so neither renaming a tab nor inserting one before the active tab
  within the same `st.tabs()` call invalidates the stored position.

**`st.expander`:**
- [#2360](https://github.com/streamlit/streamlit/issues/2360) — Expander resets its expanded
  state when new elements are included (closed in favor of #8239).
- [#2241](https://github.com/streamlit/streamlit/issues/2241) — Conditional use of containers
  can make expanders collapse.
- [#2399](https://github.com/streamlit/streamlit/issues/2399) — st.expander expanded/collapsed
  state (93 👍).

**`st.popover`:**
- [#9067](https://github.com/streamlit/streamlit/issues/9067) — Popover collapses when using
  st.rerun and time.sleep (fixed in v1.39.0 for the regression case; general remount behavior
  is addressed here).

---

## Proposal

### Stable Identity via Global Call Counter

The root cause of all identity problems is that there is no stable, content-independent
identifier for layout container calls. Tab labels change, indices shift on insertion,
expander labels change — none of these give a reliable key.

The fix is to assign a stable `Block.id` on the backend per element type. The scheme depends
on whether the user provides a `key`:

- **Keyed elements:** `Block.id = hash(element_type, user_key, script_hash)`. The key is
  the complete stable anchor — no counter involved. Immune to structural changes anywhere
  in the script. Users who provide a key get fully reliable persistence.

- **Unkeyed elements:** `Block.id = hash(element_type, N, script_hash)`, where N is a
  **global per-type call counter** that increments on each call and resets at the start of
  each run. As long as the order of calls for that element type is unchanged across reruns,
  N is deterministic and the ID is stable.

```python
# Pseudocode — no widget registration, no inspect dependency
# Applied the same way for st.tabs, st.expander, and st.popover
if user_key:
    # Format: "$$ID-<hash>-<user_key>" — produces CSS class st-key-<user_key>
    block_proto.id = f"$$ID-{hash(element_type, user_key, ctx.page_script_hash)}-{user_key}"
else:
    n = ctx.call_counter[element_type]
    ctx.call_counter[element_type] += 1
    # Raw hex hash — does not start with "$$ID", so no CSS class is generated
    block_proto.id = hash(element_type, n, ctx.page_script_hash)
```

`Block.id` (not `tabContainer.id` / `expandable.id` / `popover.id`) is intentionally used.
The frontend uses `tabContainer.id` as the signal that tabs are a stateful widget — when set,
it calls `widgetMgr.setStringValue` on tab switch, which triggers a rerun. `Block.id` is
already the documented non-widget identity field (used for CSS key styling) and carries no
such behavior.

This ID must be computed directly (a lightweight hash), **not** via
`compute_and_register_element_id`. That function registers the ID into `widget_ids_this_run`
and raises `StreamlitDuplicateElementId` for duplicate calls — which would break elements in
loops. The counter-based passive ID bypasses widget registration entirely. `ctx.call_counter`
is a new `dict[str, int]` field on `ScriptRunContext`, reset to `{}` in
`ScriptRunContext.reset()` alongside `widget_ids_this_run`.

Including the key when available directly mitigates the main weakness of the counter approach:
a new call inserted before a keyed element has no effect on that element's ID. Users who want
reliable persistence can simply add a `key`.

This approach was preferred over capturing the call-site file and line number via `inspect`
because: call-site capture is fragile through decorators, wrappers, and helper functions
where the captured frame may not correspond to the user's code; and any added or removed line
of code above the element shifts its line number and loses stored state during active
development.

### Frontend State Store

The existing `WidgetStateManager.setElementState` / `getElementState` API is exactly the
right mechanism — it is already used by `Video`, `Audio`, `PlotlyChart`, and
`DeckGlJsonChart` to persist state across remounts for the same reason. The
`useWidgetManagerElementState` React hook wraps this pattern for component use.

State is keyed by `Block.id`. The `tabContainer.id` / `expandable.id` / `popover.id` fields
are not used as store keys because the frontend uses them as the signal to register a widget
and call `widgetMgr.setStringValue` on interaction — which triggers a rerun. `Block.id`
carries no such behavior.

`Block.id` is not currently included in the `activeWidgetIds` set used by `removeInactive`.
This was never needed before because: (a) non-stateful blocks never had `Block.id` set so
there was nothing to clean up, and (b) stateful blocks use element-level IDs
(`tabContainer.id` etc.) as widget IDs, and those are repopulated by the backend on every
rerun anyway. This is the first time anything is stored in `elementStates` keyed by
`Block.id`, which makes the gap relevant.

`getElements()` uses `ElementsSetVisitor`, which already visits every `BlockNode` (to
recurse into children) but discards the block data. Rather than a separate visitor and
traversal, extend `ElementsSetVisitor` to also collect block IDs as a side effect:

- Add a `public readonly blockIds: Set<string>` property to `ElementsSetVisitor`.
- In `visitBlockNode`, collect `node.deltaBlock?.id` (if set) before recursing.
- Add `AppRoot.getActiveIds(): { elements: Set<Element>; blockIds: Set<string> }` that runs
  one traversal and returns both.
- In each `activeWidgetIds` construction site in `App.tsx` (three places), use
  `getActiveIds()` and spread both sets into `activeWidgetIds`.

Each element type stores a different key:

- **`st.tabs` (`"activeLabel"`):** stores the active tab label. When a tab delta arrives
  and a stored entry exists:
  1. Search for the stored label in the new tab list.
  2. If found: activate that tab at its current index (handles insertion and reordering).
  3. If not found (label renamed or tab removed): use `default_tab_index` — same as current
     behavior.
  When the user switches tabs, update the stored entry.

- **`st.expander` (`"expanded"`):** stores a boolean (`true` = expanded). When an expander
  delta arrives and a stored entry exists, apply it instead of the proto `expanded` default.
  When the user toggles, update the entry.

- **`st.popover` (`"open"`):** stores a boolean (`true` = open). When a popover delta
  arrives and a stored entry exists, apply it instead of the default closed state. When the
  user opens or closes, update the entry.

Because `WidgetStateManager` lives outside React component state, stored entries survive
component unmounts and remounts — directly addressing the GitHub issues.

### Handling Developer-Controlled Default Changes

When the developer changes a default parameter (`default=` for tabs, `expanded=` for
expander), the backend sends a different value. The frontend detects this by storing the
last-received backend default alongside the active state:

- Backend default unchanged from last render → use stored state.
- Backend default changed → use the new backend value and reset the store entry.

For **keyed elements**, the simpler convention also applies: changing the `key` produces a
new `Block.id` with no store entry, so the backend default is used. This is consistent with
how keys work across Streamlit.

`st.popover` has no developer-controlled default, so this logic does not apply.

### Scope

This fix applies to all non-stateful containers — where `on_change` is `"ignore"` (the
default for all three elements) or `on_change=None` (tabs-only default). Stateful elements
(`on_change="rerun"` or a callable) already use the backend as source of truth via widget
state and are not affected. All three elements already have both `key=` and `on_change`
in their current API; no new parameters are required.

`key=` is **identity only** — it produces a stable `Block.id` that is immune to structural
code changes, with no backend widget registration. The frontend store provides all
persistence; no backend passive tracking is needed.

### CSS Key Class Styling (Side Effect)

Setting `Block.id` on all three elements also enables CSS key class styling, which currently
does not work for `st.tabs`, `st.expander`, or `st.popover` because they never set
`Block.id`. As a consequence of this spec, users who provide a `key=` will automatically get
an `st-key-<keyname>` CSS class on the element, which they can use for custom styling.

**Unkeyed elements** receive no CSS class. `getKeyFromId` first calls `isValidElementId`,
which requires the ID to start with `$$ID` and have at least 3 dash-separated parts
(`$$ID-<hash>-<key>`). A raw counter-based hash (hex digest) does not start with `$$ID`, so
`isValidElementId` returns `false` → `getKeyFromId` returns `undefined` → no CSS class.

**Keyed elements** DO generate a CSS class. Their `Block.id` must use the format
`$$ID-<hash>-<user_key>` — the format that `getKeyFromId` parses via
`parts.slice(2).join("-")`. The keyed ID scheme must produce this shape; the existing CSS
key infrastructure requires no changes.

**Frontend placement** of the CSS class must be on exactly one element per block (placing it
on two nested divs would cause a rule like `.st-key-mykey { padding: 10px }` to match both):

| Element | Element that receives `st-key-*` class |
|---|---|
| `st.expander` | `StyledLayoutWrapper` (outermost; not `StyledExpandableContainer`) |
| `st.popover` | `StyledLayoutWrapper` (outermost; not `Box`) |
| `st.tabs` | `StyledTabContainer` (outermost; tabs bypass `StyledLayoutWrapper`) |

This is consistent with `st.container`, where the class lives on `StyledFlexContainerBlock`
(the outermost element). `StyledLayoutWrapper` in `BlockNodeRenderer` (`Block.tsx`) covers both
expander and popover in one place. `st.tabs` bypasses `StyledLayoutWrapper` and must apply the
class directly in `Tabs.tsx` on `StyledTabContainer` (using `node.deltaBlock.id`, not
`tabContainer.id`).

**Popover body caveat:** The BaseWeb popover renders its content panel into a `document.body`
portal, outside the DOM subtree. Descendant selectors from `StyledLayoutWrapper`'s key class
cannot reach the popover body. Users who need to style popover content should use the global
`.stPopoverBody` class.

**Expander `blockId` prop:** The existing `blockId` prop on `Expander.tsx` currently applies
the key class to `StyledExpandableContainer` — but only for stateful expanders
(`on_change="rerun"`), because the backend only sends `Block.id` when `is_stateful=True`.
This spec's change (sending `block_proto.id` for passive keyed elements) activates the CSS
class for passive expanders for the first time. Since the class will now come from
`StyledLayoutWrapper` (outermost) via `BlockNodeRenderer`, the `blockId` prop on `Expander`
creates a duplicate — the same class on two nested divs. Remove `blockId` from `ExpanderProps`
and its callsite in `Block.tsx`, and remove the `convertKeyToClassName` call from
`StyledExpandableContainer`. Verify first that this has not shipped in a released version; if
it has, treat it as a breaking change.

### Behavior Summary

#### `st.tabs`

| Scenario | Before | After |
|---|---|---|
| Widget interaction triggers rerun | Tab jumps to default | Tab stays on active position |
| Conditional element above tabs toggled (remount) | Tab jumps to default | Tab stays on active position |
| Developer changes `default=` | Tab resets to new default | Tab resets to new default ✓ |
| Tab label renamed | Tab jumps to default | Tab jumps to default (label not found) |
| Tab inserted before active tab | Tab follows label to new index | Tab follows label to new index ✓ |
| New `st.tabs()` call inserted before this one | Always resets (no persistence today) | Resets to default (counter shifts); add `key` to make immune |
| Tabs in a loop | Always resets (no persistence today) | Each iteration tracked independently (counter increments per call) |
| Page refresh | Tab resets to default | Tab resets to default |

#### `st.expander`

| Scenario | Before | After |
|---|---|---|
| Widget interaction triggers rerun | Expander resets to `expanded=` default | Expander stays open/closed |
| Conditional element above expander toggled (remount) | Expander resets to `expanded=` default | Expander stays open/closed |
| Developer changes `expanded=` | Expander resets to new default | Expander resets to new default ✓ |
| Expander label renamed | Always resets (no persistence today) | Stays open/closed (label not used for identity) |
| New `st.expander()` call inserted before this one | Always resets (no persistence today) | Resets to default (counter shifts); add `key` to make immune |
| Page refresh | Expander resets to default | Expander resets to default |

#### `st.popover`

| Scenario | Before | After |
|---|---|---|
| Widget interaction inside popover triggers rerun | Popover closes | Popover stays open |
| Conditional element above popover toggled (remount) | Popover closes | Popover stays open |
| New `st.popover()` call inserted before this one | Always resets (no persistence today) | Closes (counter shifts); add `key` to make immune |
| Page refresh | Popover closes | Popover closes |

**Note on page refresh:** Streamlit session state is server-side and bound to a session.
The frontend store does not survive a full page refresh (new session). This is the expected
behavior — in-session persistence is the goal of this spec.

---

## Alternatives Considered

### Backend Passive Tracking

Registering containers as widgets and storing active state in backend widget state, then
sending it back to the frontend on the next rerun.

**Rejected because:** Backend widget state is server-side and session-scoped. It does not
survive a page refresh (new session), so it provides no additional persistence over the
frontend store. Additionally, registering as a widget means these elements cannot be used
inside `@st.cache_data` functions, where widgets are not permitted — a new restriction with
no user benefit to justify it.

---

## Checklist

| Item | ✅ or comment |
|---|---|
| Works on SiS, Cloud, etc? | Yes — backend counter/hash changes are lightweight |
| Breaking API changes | None — `key=` and `on_change` already exist on all three elements |
| No new dependencies | Yes |
| New `ScriptRunContext` field | `call_counter: dict[str, int]`, reset in `ScriptRunContext.reset()` |
| Metrics collected | TBD — could track whether frontend store is used |
| Any security/legal impact? | No |
| Any docs changes needed? | Yes — document `key=` persistence behavior for all three elements; note page refresh resets to default |
| CSS key styling | Setting `Block.id` also enables `st-key-*` CSS classes for keyed elements; key class goes on `StyledLayoutWrapper` (expander, popover) and `StyledTabContainer` (tabs); keyed ID format must be `$$ID-<hash>-<user_key>` |
| Expander `blockId` compat | Existing `blockId` prop on `Expander` places the key class on `StyledExpandableContainer` — check if shipped; if not, remove in this PR and use `StyledLayoutWrapper` instead |
