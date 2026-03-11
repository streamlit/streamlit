---
author: sfc-gh-lwilby
created: 2026-02-26
---

# Layout Container State Persistence Across Reruns

## Summary

When a Streamlit app reruns and a conditional element above a layout container changes, the
container's position in the render tree (delta path) shifts, causing a React remount that
resets `st.tabs`, `st.expander`, and `st.popover` to their default state. This spec proposes
a fix: when `key` is provided, assign a stable `Block.id` via
`compute_and_register_element_id` and use the existing `WidgetStateManager.elementStates`
store on the frontend to restore state across remounts — without any API changes or widget
registration.

Stabilizing identity for elements *without* an explicit `key` is a follow-up investigation.

## Problem

### Current Behavior

When a conditional element above a layout container appears or disappears between reruns,
the container's delta path shifts, causing a React remount that resets it to its default state:

- A conditional element above `st.tabs` toggles → tabs remount → active tab resets to default.
- A conditional element above `st.expander` toggles → expander remounts collapsed.
- A conditional element above `st.popover` toggles → popover remounts closed.

```python
if st.toggle("Show summary"):
    st.write("Here is a summary of the data")

# When the toggle changes, st.write appears/disappears above the tabs,
# shifting their delta path → tabs remount → active tab resets to default
tab1, tab2, tab3 = st.tabs(["Overview", "Details", "Raw Data"])

with tab1:
    st.write("Overview content")
with tab2:
    st.dataframe(df)  # User was viewing this tab
with tab3:
    st.json(data)
```

### User Requests

- [#8239](https://github.com/streamlit/streamlit/issues/8239) — `st.tabs` & `st.expander`:
  Improve handling of frontend state/mount (79 👍). This spec addresses the active-tab reset,
  the expander expanded-state reset, and the equivalent popover open-state reset.

---

## Proposal

This spec covers non-stateful containers — those with `on_change="ignore"` (the default
for all three elements) — where the user explicitly provides `key=`. Stateful elements
(`on_change="rerun"` or a callable) already use backend widget state as the source of
truth and are unaffected by remounts.

### Stable Identity via `key`

When `key` is provided, compute `Block.id` using `compute_and_register_element_id` with
`key_as_main_identity=True`. This is the same function used for all other keyed Streamlit
elements, producing the standard `$$ID-<hash>-<user_key>` format.

```python
# New passive path (on_change="ignore" + key).
# The stateful path already computes element_id and sets both block_proto.id
# and the element-level ID (e.g. expandable_proto.id). The change here is to
# also compute it for the passive case — setting block_proto.id only.
if user_key and not is_stateful:
    block_proto.id = compute_and_register_element_id(
        element_type,
        user_key=user_key,
        dg=dg,
        key_as_main_identity=True,
    )
```

This provides:

- **Stable identity across remounts:** The `Block.id` is derived from the key and
  `active_script_hash`, independent of the element's position in the render tree.
  Conditional elements above the container can change freely without affecting the ID.
- **CSS class `st-key-<keyname>`:** The `$$ID-<hash>-<user_key>` format is recognized by
  `isValidElementId` / `getKeyFromId`, which produce the `st-key-*` CSS class on the
  outermost DOM element. No changes to the existing CSS key infrastructure are needed.

**Fragment compatibility:** `compute_and_register_element_id` incorporates
`ctx.active_script_hash`, so `Block.id` is stable across full and fragment reruns.

**`on_change` transition:** `Block.id` is always set when `key` is provided, in both
passive and stateful modes (it drives the CSS class and the `elementStates` key). The
element-level ID (e.g. `tabContainer.id`) is what distinguishes a widget from a passive
container. Changing `on_change` from `"ignore"` to `"rerun"` adds the element-level ID
and calls `register_widget` — widget state becomes the source of truth and the
`elementStates` entry keyed by `Block.id` is no longer read.

### Frontend State Store

Use the existing `WidgetStateManager.setElementState` / `getElementState` API, already used
by `Video`, `Audio`, `PlotlyChart`, and `DeckGlJsonChart` for the same purpose. The
`useWidgetManagerElementState` hook wraps this for component use.

**Read on render** — if stored state exists, use it; otherwise use the proto value as the
initial default. Changes to `default=` / `expanded=` are ignored while stored state exists
— consistent with how keyed widgets behave (the default is only the initial seed). To reset,
change `key=` or use `on_change="rerun"` + `session_state[key]` for programmatic control.

```typescript
// Tabs — store the active label
const [stored, setStored] = useWidgetManagerElementState<
  { activeLabel: string } | undefined
>(widgetMgr, node.deltaBlock.id, "tabState")

// If stored, look up the label in the current tab list.
// If the label no longer exists (tab was renamed or removed), fall back to default.
const foundIndex = stored ? tabLabels.indexOf(stored.activeLabel) : -1
const activeIndex =
  foundIndex >= 0 ? foundIndex : defaultTabIndex

// Expander — store the expanded state
const [stored, setStored] = useWidgetManagerElementState<
  { expanded: boolean } | undefined
>(widgetMgr, node.deltaBlock.id, "expanderState")

const expanded = stored ? stored.expanded : protoDefault

// Popover — store boolean directly
const [open, setOpen] = useWidgetManagerElementState<boolean>(
  widgetMgr, node.deltaBlock.id, "open", false
)
```

**Write on interaction** — update the store on user interaction:

```typescript
// On tab switch:
setStored({ activeLabel: newLabel })

// On expander toggle:
setStored({ expanded: newExpanded })

// On popover open/close:
setOpen(newOpen)
```

No rerun is triggered because the element-level ID (e.g. `tabContainer.id`) is not set —
only `Block.id` is present, so the frontend does not treat the container as a widget.
Changing `key=` produces a new `Block.id` with no store entry, so the backend default is
used — consistent with how keys work across Streamlit.

### Cleanup

`elementStates` entries are garbage-collected by `removeInactive` when their ID is absent
from `activeWidgetIds`. Because we use `compute_and_register_element_id`, the `Block.id`
is registered in `widget_ids_this_run` on the backend. On the frontend, we need to ensure
these `Block.id`s are included in the active ID set passed to `removeInactive`.

Extend `ElementsSetVisitor` to collect `Block.id`s in the same traversal already used for
widgets:

```typescript
// ElementsSetVisitor.ts — add alongside existing elements set
public readonly blockIds: Set<string> = new Set()

visitBlockNode(node: BlockNode): Set<Element> {
  if (node.deltaBlock?.id) this.blockIds.add(node.deltaBlock.id)
  for (const child of node.children) child.accept(this)
  return this.elements
}

// AppRoot.ts — new method replaces getElements() at the three removeInactive call sites
getActiveIds(): { elements: Set<Element>; blockIds: Set<string> } {
  const visitor = new ElementsSetVisitor()
  ;[this.main, this.sidebar, this.event, this.bottom].forEach(r => r.accept(visitor))
  return { elements: visitor.elements, blockIds: visitor.blockIds }
}

// App.tsx — at each of the three removeInactive call sites
const { elements, blockIds } = this.state.elements.getActiveIds()
const activeWidgetIds = new Set([
  ...Array.from(elements).map(getElementId).filter(notUndefined),
  ...blockIds,
])
this.widgetMgr.removeInactive(activeWidgetIds)
```

### CSS Key Class Styling

Setting `Block.id` enables `st-key-<keyname>` CSS classes on all three elements for the
first time. The class must appear on the outermost DOM element only — placing it on a nested
div too would cause rules like `.st-key-mykey { padding: 10px }` to match both:

| Element | Outermost element | Implementation note |
|---|---|---|
| `st.expander` | `StyledLayoutWrapper` | Via `BlockNodeRenderer` (`Block.tsx`); not `StyledExpandableContainer` |
| `st.popover` | `StyledLayoutWrapper` | Via `BlockNodeRenderer` (`Block.tsx`); not `Box`. Popover body renders into a `document.body` portal — descendant selectors can't reach it; use `.stPopoverBody` instead |
| `st.tabs` | `StyledTabContainer` | Applied in `Tabs.tsx` using `node.deltaBlock.id` (not `tabContainer.id`); tabs bypass `StyledLayoutWrapper` |

**Keyed elements** use `$$ID-<hash>-<user_key>` as `Block.id`, which `getKeyFromId` parses
into the CSS class. No changes to the existing CSS key infrastructure are needed.

### Behavior Summary

#### `st.tabs`

| Scenario | Before | After (with `key=`) |
|---|---|---|
| Conditional element above tabs toggled (remount) | Tab jumps to default | Tab stays on active position |
| Developer changes `default=` | Tab resets to new default | Stored state wins; default change ignored (consistent with keyed widgets) |
| Tab list changed — stored `activeLabel` still exists | Always resets | Stays on stored tab |
| Tab list changed — stored `activeLabel` removed | Always resets | Resets to default |
| Developer changes `key=` | N/A | New identity, no stored state → uses new default |
| Page refresh | Tab resets to default | Tab resets to default |

#### `st.expander`

| Scenario | Before | After (with `key=`) |
|---|---|---|
| Conditional element above expander toggled (remount) | Expander resets to `expanded=` default | Expander stays open/closed |
| Developer changes `expanded=` | Expander resets to new default | Stored state wins; default change ignored (consistent with keyed widgets) |
| Developer renames label | Expander resets to default | Stays (identity is key-based, not label-based) |
| Developer changes `key=` | N/A | New identity, no stored state → uses new default |
| Page refresh | Expander resets to default | Expander resets to default |

#### `st.popover`

| Scenario | Before | After (with `key=`) |
|---|---|---|
| Conditional element above popover toggled (remount) | Popover closes | Popover stays open |
| Developer renames label | Popover closes | Stays (identity is key-based, not label-based) |
| Developer changes `key=` | N/A | New identity, no stored state → closes |
| Page refresh | Popover closes | Popover closes |

**Note on default changes:** The "Before" column reflects the current behavior *without*
`key=`, which is unchanged by this spec. Without a key, the element has no stable identity
and the proto value (the developer's parameter) is used directly on every render — so
changing `default=` / `expanded=` continues to take effect immediately, consistent with
how unkeyed widgets include all parameters in their element ID.

**Note on page refresh:** Streamlit session state is server-side and bound to a session.
The frontend store does not survive a full page refresh (new session). This is the expected
behavior — in-session persistence is the goal of this spec.

---

## Alternatives Considered

### Backend Passive Tracking

Registering containers as widgets and storing active state in backend widget state, then
sending it back to the frontend on the next rerun.

**Rejected because:** Registering as a widget would populate `session_state[key]`, which
invites users to gate content on the active tab — silently broken without `on_change="rerun"`
since no rerun fires on interaction. It also means these elements cannot be used inside
`@st.cache_data` functions, where widgets are not permitted.

---

## Checklist

| Item | Status |
|---|---|
| Works on SiS, Cloud, etc? | Yes — uses standard `compute_and_register_element_id` |
| Breaking API changes | None — `key=` and `on_change` already exist on all three elements |
| No new dependencies | Yes |
| New `ScriptRunContext` fields | None — `compute_and_register_element_id` uses existing infrastructure |
| Metrics collected | TBD — could track whether frontend store is used |
| Any security/legal impact? | No |
| Any docs changes needed? | Yes — document `key=` persistence behavior for all three elements; note page refresh resets to default |
| CSS key styling | Setting `Block.id` also enables `st-key-*` CSS classes for keyed elements; key class goes on `StyledLayoutWrapper` (expander, popover) and `StyledTabContainer` (tabs); keyed ID format is `$$ID-<hash>-<user_key>` |
