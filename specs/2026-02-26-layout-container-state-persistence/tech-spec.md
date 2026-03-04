---
author: sfc-gh-lwilby
created: 2026-02-26
---

# Layout Container State Persistence Across Reruns

## Summary

When a Streamlit app reruns, `st.tabs`, `st.expander`, and `st.popover` reset their frontend
state — the active tab, expanded state, or open state — because the backend always sends the
configured default and the frontend resets to it on every rerun and remount. This spec proposes
a fix that assigns each container a stable `Block.id` on the backend (counter-based for unkeyed
elements, key-based for keyed), then uses the existing `WidgetStateManager.elementStates` store
on the frontend to restore state across reruns and remounts — without any API changes or widget
registration.

## Problem

### Current Behavior

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

- [#8239](https://github.com/streamlit/streamlit/issues/8239) — `st.tabs` & `st.expander`:
  Improve handling of frontend state/mount (79 👍). This spec addresses the active-tab reset,
  the expander expanded-state reset, and the equivalent popover open-state reset.

---

## Proposal

### Stable Identity via Global Call Counter

The fix applies to non-stateful containers (`on_change="ignore"` or `None`, the default for
all three elements). Stateful elements (`on_change="rerun"` or a callable) already use
backend widget state as the source of truth and are unaffected. No new API parameters are
required — `key=` and `on_change` already exist on all three elements.

The root cause of the reset is that there is no stable, content-independent identifier for
layout container calls. Tab labels change, indices shift on insertion, expander labels
change — none of these give a reliable key.

The fix is to assign a stable `Block.id` on the backend per element type:

```python
# Pseudocode — no widget registration, no inspect dependency
# Applied the same way for st.tabs, st.expander, and st.popover
import hashlib

# Scope ties the counter to the current execution context:
# - Inside a fragment: fragment_id (stable, includes call-site delta path)
# - Outside a fragment: active_script_hash (scopes to the current page)
scope = ctx.current_fragment_id or ctx.active_script_hash

if user_key:
    # Format: "$$ID-<hash>-<user_key>" — produces CSS class st-key-<user_key>
    raw = f"{element_type}:{user_key}:{scope}".encode("utf-8")
    digest = hashlib.md5(raw).hexdigest()
    block_proto.id = f"$$ID-{digest}-{user_key}"
else:
    counter_key = f"{scope}:{element_type}"
    n = ctx.call_counter.get(counter_key, 0)
    ctx.call_counter[counter_key] = n + 1
    # Raw hex hash — does not start with "$$ID", so no CSS class is generated
    raw = f"{element_type}:{n}:{scope}".encode("utf-8")
    block_proto.id = hashlib.md5(raw).hexdigest()
```

Set `block_proto.id` (not `tabContainer.id` / `expandable.id` / `popover.id`). This ID must
be computed directly (a lightweight hash), **not** via
`compute_and_register_element_id`. That function registers the ID into `widget_ids_this_run`
and raises `StreamlitDuplicateElementId` for duplicate calls — which would break elements in
loops. The counter-based passive ID bypasses widget registration entirely.

`ctx.call_counter` is a new `dict[str, int]` field on `ScriptRunContext`, reset to `{}` in
`ScriptRunContext.reset()` alongside `widget_ids_this_run`.

**Main script run** (full rerun — all code executes):

```python
# scope = active_script_hash = "abc" (current_fragment_id is None outside fragments)

st.expander("A")  # counter_key="abc:expander", n=0 → md5("expander:0:abc")
st.expander("B")  # counter_key="abc:expander", n=1 → md5("expander:1:abc")
st.tabs(["X"])    # counter_key="abc:tabs",     n=0 → md5("tabs:0:abc")
```

Each element type has its own counter, so non-tab elements inserted above `st.tabs` don't
shift its ID. Adding a new `st.tabs()` before an existing one does shift it — add `key=` to
make it immune.

**Fragment script run** (only the fragment executes — full script does not run):

```python
@st.fragment
def my_fragment():
    st.tabs(["X"])  # scope="frag1", n=0 → md5("tabs:0:frag1")
    st.tabs(["Y"])  # scope="frag1", n=1 → md5("tabs:1:frag1")

st.tabs(["A"])  # scope="abc", n=0 → md5("tabs:0:abc")
my_fragment()   # current_fragment_id = "frag1" (hash of function + call-site delta path)

# ── Main script run ───────────────────────────────────────────────────────
# call_counter = {}; full script executes
#   st.tabs(["A"]) → scope="abc",   n=0 → md5("tabs:0:abc")
#   st.tabs(["X"]) → scope="frag1", n=0 → md5("tabs:0:frag1")
#   st.tabs(["Y"]) → scope="frag1", n=1 → md5("tabs:1:frag1")

# ── Fragment run (user interacts inside my_fragment) ──────────────────────
# call_counter = {}; only my_fragment() executes — st.tabs(["A"]) never runs
#   st.tabs(["X"]) → scope="frag1", n=0 → md5("tabs:0:frag1")  ✓ same ID
#   st.tabs(["Y"]) → scope="frag1", n=1 → md5("tabs:1:frag1")  ✓ same ID
```

`current_fragment_id` is set by the fragment machinery before executing the fragment body on
both full and fragment runs. It is a hash of the fragment function's module, name, and call-site
delta path — so two calls to `my_fragment()` in the same script get different scopes and
independent counters, naturally producing different `Block.id`s without needing `key=`.

Outside any fragment, `current_fragment_id` is `None`, and `active_script_hash` scopes the
counter to the current page, consistent with `compute_and_register_element_id`.

### Frontend State Store

Use the existing `WidgetStateManager.setElementState` / `getElementState` API, already used
by `Video`, `Audio`, `PlotlyChart`, and `DeckGlJsonChart` for the same purpose. The
`useWidgetManagerElementState` hook wraps this for component use.

**Read on render** — on each delta, resolve the active state. Store both the user's active
value and the last-seen backend default; if the default changes, the stored user state is
discarded and the new default takes effect:

```typescript
// Tabs — store { activeLabel, lastDefault } together
const [stored, setStored] = useWidgetManagerElementState<
  { activeLabel: string; lastDefault: number } | undefined
>(widgetMgr, node.deltaBlock.id, "tabState")

// If the developer changed default=, discard stored state and use the new default.
const activeIndex =
  stored && stored.lastDefault === defaultTabIndex
    ? (tabLabels.indexOf(stored.activeLabel) ?? defaultTabIndex)
    : defaultTabIndex

// Expander — store { expanded, lastDefault } together
const [stored, setStored] = useWidgetManagerElementState<
  { expanded: boolean; lastDefault: boolean } | undefined
>(widgetMgr, node.deltaBlock.id, "expanderState")

const expanded =
  stored && stored.lastDefault === protoDefault ? stored.expanded : protoDefault

// Popover — no developer-controlled default, store boolean directly
const [open, setOpen] = useWidgetManagerElementState<boolean>(
  widgetMgr, node.deltaBlock.id, "open", false
)
```

**Write on interaction** — update the store with both the new active value and the current
backend default so future renders can detect a default change:

```typescript
// On tab switch:
setStored({ activeLabel: newLabel, lastDefault: defaultTabIndex })

// On expander toggle:
setStored({ expanded: newExpanded, lastDefault: protoDefault })

// On popover open/close:
setOpen(newOpen)
```

No rerun is triggered because `Block.id` carries no widget semantics (unlike `tabContainer.id`,
which calls `widgetMgr.setStringValue` and triggers a rerun). Changing `key=` produces a new
`Block.id` with no store entry, so the backend default is used — consistent with how keys work
across Streamlit.

**Cleanup** — `elementStates` entries are garbage-collected by `removeInactive` when their
ID is absent from `activeWidgetIds`. `Block.id`s are not currently in that set (only
widget IDs are). Extend `ElementsSetVisitor` to collect them in the same traversal already
used for widgets:

```typescript
// ElementsSetVisitor.ts — add alongside existing elements set
public readonly blockIds: Set<string> = new Set()

visitBlockNode(node: BlockNode): Set<Element> {
  if (node.deltaBlock?.id) this.blockIds.add(node.deltaBlock.id) // new
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

**Unkeyed elements** receive no CSS class — the raw hex digest doesn't start with `$$ID`, so
`isValidElementId` returns `false` and no class is applied. This is intentional: without a
user-specified key there is no stable, human-readable name to target in CSS. Users who want
to style a specific element should add `key=` to get a predictable `st-key-<keyname>` class.

### Behavior Summary
#### `st.tabs`

| Scenario | Before | After |
|---|---|---|
| Conditional element above tabs toggled (remount) | Tab jumps to default | Tab stays on active position |
| Developer changes `default=` | Tab resets to new default | Tab resets to new default ✓ |
| New `st.tabs()` call inserted before this one | Always resets (no persistence today) | Resets to default (counter shifts); add `key` to make immune |
| Tabs in a loop | Always resets (no persistence today) | Each iteration tracked independently (counter increments per call) |
| Page refresh | Tab resets to default | Tab resets to default |

#### `st.expander`

| Scenario | Before | After |
|---|---|---|
| Conditional element above expander toggled (remount) | Expander resets to `expanded=` default | Expander stays open/closed |
| Developer changes `expanded=` | Expander resets to new default | Expander resets to new default ✓ |
| New `st.expander()` call inserted before this one | Always resets (no persistence today) | Resets to default (counter shifts); add `key` to make immune |
| Page refresh | Expander resets to default | Expander resets to default |

#### `st.popover`

| Scenario | Before | After |
|---|---|---|
| Conditional element above popover toggled (remount) | Popover closes | Popover stays open |
| New `st.popover()` call inserted before this one | Always resets (no persistence today) | Closes (counter shifts); add `key` to make immune |
| Page refresh | Popover closes | Popover closes |

**Note on page refresh:** Streamlit session state is server-side and bound to a session.
The frontend store does not survive a full page refresh (new session). This is the expected
behavior — in-session persistence is the goal of this spec.

---

## Alternatives Considered

### Delta Path Identity

Using the element's delta path (its position in the render tree, e.g. `[0, 3, 1]`) as
`Block.id` instead of a counter.

**Rejected because:** The delta path shifts when *any* element above the target is added or
removed, regardless of type. Toggling a conditional `st.write()` before `st.tabs` would change
the tab's path and invalidate stored state — which is exactly the primary scenario this spec
addresses (conditional element above causes remount). The counter is type-scoped, so only
inserting another element of the *same type* before the target affects its ID.

Delta paths do handle fragments naturally (each call site has a unique path, stable across full
and fragment runs) without needing `current_fragment_id`, but the conditional-element
sensitivity is a dealbreaker given the core use case.

### Call-Site Capture via `inspect`

Using Python's `inspect` module to capture the file and line number of the call site as the
stable identity.

**Rejected because:** The captured frame is fragile through decorators, wrappers, and helper
functions where it may not correspond to the user's actual code. Any line added or removed
above the element shifts its line number, losing stored state during active development.

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
| New `ScriptRunContext` field | `call_counter: dict[str, int]`, keyed by `f"{scope}:{element_type}"`, reset to `{}` in `ScriptRunContext.reset()` |
| Metrics collected | TBD — could track whether frontend store is used |
| Any security/legal impact? | No |
| Any docs changes needed? | Yes — document `key=` persistence behavior for all three elements; note page refresh resets to default |
| CSS key styling | Setting `Block.id` also enables `st-key-*` CSS classes for keyed elements; key class goes on `StyledLayoutWrapper` (expander, popover) and `StyledTabContainer` (tabs); keyed ID format must be `$$ID-<hash>-<user_key>` |
| Expander `blockId` compat | Existing `blockId` prop on `Expander` places the key class on `StyledExpandableContainer` — check if shipped; if not, remove in this PR and use `StyledLayoutWrapper` instead |
