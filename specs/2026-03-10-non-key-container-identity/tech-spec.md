---
author: sfc-gh-lwilby
created: 2026-03-10
status: draft
---

# Non-Key Container Identity for State Persistence

## Summary

The [key-based persistence spec](../2026-02-26-layout-container-state-persistence/tech-spec.md)
solves frontend state loss for `st.tabs`, `st.expander`, and `st.popover` when the user
provides an explicit `key=`. This spec investigates whether we can stabilize identity for
these elements *without* requiring an explicit key, so that state persistence works
automatically.

This is an investigation spec — it evaluates approaches, documents trade-offs, and
recommends whether to proceed. It does not propose a specific implementation for adoption.

## Context

### The Problem

When a conditional element above a layout container is toggled between reruns, the container's
delta path (position in the render tree) shifts, causing a React remount that resets the
container to its backend default state. This is the core issue described in
[#8239](https://github.com/streamlit/streamlit/issues/8239).

With the key-based spec, users can work around this by adding `key=` to the affected
container. However, this requires the user to (a) understand that the problem is caused by
a delta path shift, and (b) know to add a key. Ideally, containers would maintain their state
automatically without any user intervention.

### Current Identity Model

Today, element identity in Streamlit is determined by:

- **Widgets (stateful elements):** `compute_and_register_element_id` computes a stable ID
  from `(element_type, semantic_params, active_script_hash)`, optionally anchored by a user
  `key`. This ID is registered for duplicate detection and used for widget state management.
- **Layout containers (non-stateful):** No ID is assigned. Identity is purely positional
  (delta path). Any structural change above the element shifts its path.

The key-based spec bridges this gap for keyed containers by assigning a `Block.id` via
`compute_and_register_element_id`. This investigation asks: can we assign a stable `Block.id`
to *non-keyed* containers?

## Approaches

### 1. Per-Type Call Counter

Assign each container a counter `N` that increments per `element_type` within a scope
(page or fragment). The ID is `md5(element_type, label, N, scope)`.

```python
scope = ctx.current_fragment_id or ctx.active_script_hash
counter_key = f"{scope}:{element_type}"
n = ctx.call_counter.get(counter_key, 0)
ctx.call_counter[counter_key] = n + 1
raw = f"{element_type}:{label}:{n}:{scope}".encode("utf-8")
block_proto.id = hashlib.md5(raw).hexdigest()
```

**Strengths:**
- Simple to implement — one new `dict[str, int]` on `ScriptRunContext`, reset each run.
- Type-scoped: inserting a different element type above the target doesn't shift its counter.
- Label included: renaming the element produces a new ID (treated as a new element).

**Weaknesses / trade-offs:**
- Inserting or conditionally rendering another element of the *same type* before the target
  shifts the counter. This is the same class of issue that delta paths have, but scoped to
  the element type rather than all elements.
- The counter approach would change identity for elements whose delta path is currently
  stable, which could be a regression for some apps. For example, if a user has two
  `st.expander` calls and one is conditionally rendered, today the second expander's delta
  path may still be stable (if no other elements shift). With counters, its identity would
  change when the conditional expander appears or disappears.

### 2. Code-Position Capture via `inspect`

Use Python's `inspect` module to capture the file and line number of each call site as the
stable identity.

**Strengths:**
- Immune to structural changes — the identity is tied to source location, not runtime order.
- No counter needed.

**Weaknesses / trade-offs:**
- The captured frame is fragile through decorators, wrappers, and helper functions where it
  may not correspond to the user's actual code.
- Any line added or removed above the element shifts its line number, losing stored state
  during active development.
- Requires `inspect.stack()` which has non-trivial performance cost on every call.

### 3. Structural Hashing

Hash properties of the surrounding element tree (e.g. parent block types, sibling count)
to create a positional fingerprint that is more resilient than the raw delta path.

**Strengths:**
- Does not depend on call order or source location.
- Could be more stable than delta paths for certain structural changes.

**Weaknesses / trade-offs:**
- Computationally expensive to compute on every call.
- Still sensitive to structural changes — just a different set of changes than delta paths.
- Complex to reason about which changes invalidate the hash.

### 4. Hybrid: Counter Scoped by Label

Use a counter that increments only within elements sharing the same label, so
`st.expander("A")` and `st.expander("B")` have independent counters.

**Strengths:**
- Conditional rendering of a differently-labeled element doesn't affect the counter.
- Handles the common case where conditionally rendered elements have different labels.

**Weaknesses / trade-offs:**
- Multiple elements with the same label still collide.
- More complex to implement and reason about.

## Test Cases

Any proposed approach must be evaluated against these scenarios from #8239 and common
Streamlit patterns:

| # | Scenario | Expected: identity stable? |
|---|---|---|
| 1 | Conditional `st.write()` above `st.expander("A")` | Yes — different element type |
| 2 | Conditional `st.expander("B")` above `st.expander("A")` | Yes — this is the hard case |
| 3 | `st.expander("A")` inside `if toggle:` block, another `st.expander("A")` outside | Ambiguous — same label, same type |
| 4 | `st.expander` in a `for` loop with variable iteration count | Depends on approach |
| 5 | `st.tabs` called inside a fragment, re-executed on fragment rerun | Yes — scope includes fragment ID |
| 6 | Two `st.tabs` with identical tab lists on the same page | Must produce distinct IDs |

Test case #2 is the critical one. It is the scenario Lukas raised in review of the original
spec, and it reflects a real pattern in Streamlit apps where conditionally rendered elements
of the same type appear above another element.

## Recommendation

TBD — this spec is in draft. The investigation should determine:

1. Whether any approach reliably handles test case #2 without regressing existing apps.
2. Whether the improvement over "just add `key=`" justifies the complexity and risk.
3. Whether this should be a cross-cutting change to element identity (all elements) rather
   than a special case for layout containers.

## Related

- [Key-based persistence spec](../2026-02-26-layout-container-state-persistence/tech-spec.md) —
  the actionable first step that this investigation builds on.
- [#8239](https://github.com/streamlit/streamlit/issues/8239) — the user-facing issue.
