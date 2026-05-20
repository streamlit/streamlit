# External Container Writes Prototype Assessment

**Date:** 2026-05-20  
**PR #13621:** [Prototype] Allow fragments to write widgets to outside containers  
**Related:** Parallel Fragments feature (PRs #15214, #15251)

---

## 1. Summary of the Prototype Approach

PR #13621 enables fragments to write widgets to containers declared outside the fragment's scope (e.g., `st.sidebar`, a parent-scoped `st.container()`). Previously, this was explicitly blocked by `check_fragment_path_policy()` due to widget duplication bugs.

### Key Changes

**Backend (`lib/streamlit/elements/lib/policies.py`):**
- Removes the call to `check_fragment_path_policy()` from `check_widget_policies()`
- This lifts the restriction that prevented widgets from being written to containers outside the fragment's delta path

**Frontend (`frontend/lib/src/render-tree/visitors/ClearStaleNodeVisitor.ts`):**
- Modifies `visitElementNode()` to clear stale elements based on the **element's own `fragmentId`**, not the parent block's `fragmentId`
- Previously, elements were only cleared if their parent block's `fragmentId` matched the running fragment
- Now, elements are cleared if:
  1. The element has a `fragmentId` matching a running fragment, AND
  2. The element's `scriptRunId` doesn't match the current run

### How It Solves the Duplication Bug

The original bug occurred because:
1. External containers' cursors are not restored on fragment reruns
2. Each rerun places widgets at NEW delta paths (cursor auto-increments)
3. Old widgets weren't cleared because the external container's block didn't have the fragment's `fragmentId`

The prototype fixes this by making element clearing operate at the element level rather than the block level. Elements now carry their `fragmentId` tag, and the stale node visitor clears them based on that tag regardless of which block they're in.

---

## 2. Interaction with Parallel Fragments

### Current Parallel Fragments Restriction (PR #15251)

The parallel fragments implementation on `cursor/fragment-api-restrictions-d298` adds a new restriction in `delta_generator.py._enqueue()`:

```python
if ctx:
    ts = ThreadState.get()
    if ts.is_parallel_worker:
        fragment_path = ts.delta_path
        cursor_path = tuple(dg._cursor.delta_path) if dg._cursor else ()
        if fragment_path and not _is_inside_fragment_path(cursor_path, fragment_path):
            raise StreamlitAPIException(
                "Writing to containers outside a parallel fragment is not "
                "allowed during the initial page load..."
            )
```

This blocks external container writes **only when `is_parallel_worker=True`** (i.e., during the initial parallel batch on worker threads).

### Compatibility Analysis

The two features **complement each other** rather than conflict:

| Scenario | Prototype Behavior | Parallel Restriction | Result |
|----------|-------------------|---------------------|--------|
| Non-parallel fragment → external container | Allowed (path policy removed) | Not applicable (`is_parallel_worker=False`) | **Works** |
| Parallel fragment → external container (initial batch) | Would allow | **Blocked** (`is_parallel_worker=True`) | **Blocked** (correct) |
| Parallel fragment → external container (sequential rerun) | Allowed | Not applicable (`is_parallel_worker=False`) | **Works** |

**Key insight:** The prototype provides the **mechanism** for external container writes to work correctly (frontend element-level clearing), while the parallel restriction provides the **guard** against the unsafe concurrent case.

### Discrepancy with Tech Spec

The parallel fragments tech spec (lines 996-1052) states:

> "During sequential fragment reruns (`is_parallel_worker` is False), the existing behavior is unchanged: non-widget elements are allowed in external containers, **widgets are blocked by `check_fragment_path_policy`**."

This implies the spec expected `check_fragment_path_policy` to remain as a general restriction for all fragments, with the parallel worker check being an **additional** restriction during parallel execution. However, the prototype removes `check_fragment_path_policy` entirely, enabling more functionality than the spec anticipated.

**This is not a conflict**, but rather the prototype enabling a broader use case that the tech spec conservatively excluded. The safety properties described in the tech spec are preserved because:
1. Parallel workers are still blocked from external writes during concurrent execution
2. Sequential reruns can safely write to external containers (the frontend handles clearing)

---

## 3. Safety Analysis

### Thread Safety for Parallel Fragments

If external container writes were allowed for parallel fragments during the initial batch, the following issues would arise:

1. **Cursor races:** External containers share a `RunningCursor` with the main thread or other workers. Multiple threads calling `get_locked_cursor()` would race on `_index`, causing undefined behavior.

2. **Non-deterministic ordering:** Even with serialized cursor access, the order of elements written by different workers depends on thread scheduling. The UI layout would vary between runs.

3. **Amplified accumulation:** The existing accumulation behavior (elements pile up until a full rerun) would be amplified by concurrent, interleaved writes.

The current restriction (`is_parallel_worker` check) correctly blocks these cases.

### Safety During Sequential Reruns

When a parallel fragment undergoes a sequential rerun (triggered by widget interaction), `is_parallel_worker=False`. At this point:
- Only one thread is executing (the script runner thread)
- No concurrent cursor access
- The frontend element-level clearing handles widget replacement correctly

**Conclusion:** The prototype's behavior during sequential reruns is thread-safe.

### Frontend Element-Level Clearing Guarantees

The prototype's frontend changes ensure:
- Elements with `fragmentId=X` are cleared when fragment X reruns (regardless of parent block)
- Elements without a `fragmentId` or belonging to other fragments are preserved
- Elements created in the current run are never cleared

This maintains correct behavior for:
- Multiple fragments writing to the same external container (each fragment's elements are independently managed)
- Nested fragments
- Mixed full-app and fragment reruns

---

## 4. Recommended Path Forward

### The Prototype Is Compatible — No Redesign Needed

The prototype (PR #13621) and parallel fragments (PRs #15214, #15251) are **compatible as-is**:

- **Parallel fragments restriction stays:** The `is_parallel_worker` check in `delta_generator.py` blocks external writes during unsafe concurrent execution.
- **Prototype mechanism works:** For all other cases (non-parallel fragments, sequential reruns of parallel fragments), the frontend element-level clearing handles widget replacement correctly.

### Required Updates to the Parallel Fragments Tech Spec

The tech spec should be updated to reflect the prototype's approach:

**Current text (tech-spec.md lines 1046-1052):**
> During sequential fragment reruns (`is_parallel_worker` is False), the existing behavior is unchanged: non-widget elements are allowed in external containers, widgets are blocked by `check_fragment_path_policy`.

**Suggested revision:**
> During sequential fragment reruns (`is_parallel_worker` is False), external container writes are allowed (both widgets and non-widget elements). The frontend's element-level fragment clearing handles widget replacement correctly, preventing duplication. This enables the pattern of writing to external containers from sequential fragment reruns (e.g., updating a sidebar status indicator after a user interaction).

### Merge Order Recommendation

1. **Merge parallel fragments PRs first** (PRs #15173, #15214, #15251, #15271) — These add the `is_parallel_worker` guard.
2. **Merge the prototype second** (PR #13621) — This removes the old restriction and adds the frontend clearing mechanism.

This order ensures the guard is in place before the restriction is lifted.

If the prototype merges first, there would be a window where parallel fragments (once shipped) could write to external containers during the initial batch, causing the thread-safety issues described above. The guard should be in place first.

---

## 5. Open Questions

### Q1: Should Non-Parallel Fragments Also Have a Warning?

The prototype enables **all** non-parallel fragments to write to external containers. While this is safe from a thread-safety perspective, it introduces behavioral complexity:

- Elements accumulate in external containers until a full-app rerun
- Order of elements in external containers may be surprising when multiple fragments write to the same container

**Options:**
- **A. Allow silently (current prototype):** Maximum flexibility, users discover behavior through use.
- **B. Emit a warning:** Log a deprecation-style warning when writing to external containers from fragments, educating users about accumulation behavior.
- **C. Require opt-in:** Add a parameter like `@st.fragment(allow_external_writes=True)` for explicit acknowledgment.

**Recommendation:** Start with Option A (the current prototype behavior). The frontend element-level clearing prevents the worst UX issue (widget duplication), and the remaining accumulation behavior is the same as today's non-widget elements in external containers.

### Q2: Should the `_is_inside_fragment_path` Check Be DRYed?

The parallel fragments restriction adds `_is_inside_fragment_path()` in `delta_generator.py`, but the same logic previously existed in `check_fragment_path_policy()` (which the prototype removes). Consider factoring this into a shared utility if both code paths need to coexist during the transition.

### Q3: Testing Coverage

The prototype adds E2E tests for non-parallel external container writes. When parallel fragments ships, additional tests should cover:

- Parallel fragment attempts to write to external container → error raised
- Parallel fragment reruns sequentially → external write succeeds
- Mixed parallel and non-parallel fragments writing to same external container

### Q4: Documentation Updates

The fragment documentation should clarify:
- When external container writes are allowed (non-parallel, or sequential reruns of parallel)
- When they are blocked (parallel fragments during initial batch)
- Accumulation behavior for non-widget elements

---

## Appendix: Code References

| Component | File | Key Lines |
|-----------|------|-----------|
| Prototype: Policy removal | `lib/streamlit/elements/lib/policies.py` | Removes `check_fragment_path_policy()` call |
| Prototype: Frontend clearing | `frontend/lib/src/render-tree/visitors/ClearStaleNodeVisitor.ts` | `visitElementNode()` element-level clearing |
| Parallel restriction | `lib/streamlit/delta_generator.py` | `_enqueue()` `is_parallel_worker` check |
| Parallel worker flag | `lib/streamlit/runtime/fragment.py` | `_run_parallel_fragment()` sets `is_parallel_worker=True` |
| Thread state | `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py` | `FragmentThreadState.is_parallel_worker` |

---

## Summary

**The prototype and parallel fragments are compatible.** The prototype provides the frontend mechanism for safe external container writes, while the parallel restriction guards against concurrent access during the initial parallel batch. No redesign is needed; the prototype can proceed with the recommended merge order and minor documentation updates.
