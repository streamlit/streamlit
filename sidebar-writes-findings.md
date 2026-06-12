# Findings: enabling writes to the sidebar from inside a fragment

**Branch under test:** `cursor/fragment-external-container-writes-4f88` (PR #15398 —
"[feature] Allow fragments to write widgets to outside containers"), worked on via
`cursor/sidebar-fragment-write-patterns-68a3`.

## What was changed

The branch had a hard guard that raised `StreamlitAPIException` whenever a fragment wrote
**directly** to the sidebar root (`st.sidebar.write(...)` or `with st.sidebar:` opened inside the
fragment). To answer the actual question — *can we just enable sidebar writes from a fragment?* —
that guard was removed and nothing else was added:

```diff
# lib/streamlit/delta_generator.py (_enqueue)
-        ctx = get_script_run_ctx()
-        if ctx and ThreadState.get().fragment_id and _writes_directly_to_sidebar(dg):
-            raise StreamlitAPIException(
-                "Calling `st.sidebar` in a function wrapped with `st.fragment` is not "
-                "supported. ..."
-            )
-
+        ctx = get_script_run_ctx()
```

The now-unused `_writes_directly_to_sidebar()` helper was deleted, the unit test that asserted the
exception was flipped to assert success, and the `st.fragment` docstring was updated. No new
clearing/cursor logic was introduced.

## TL;DR — it works, with NO accumulation problem

With the restriction simply removed, **direct sidebar writes from a fragment work correctly and do
NOT exhibit the accumulation problem.** In fact they behave *better* than the captured-container
pattern the feature was originally built for:

- Delta paths for direct sidebar writes are **stable** across fragment reruns (no growth).
- Widget IDs are stable, so widget state is retained.
- Non-fragment sidebar content (before and after the fragment) is undisturbed.
- No `StreamlitAPIException`, no "Bad delta path index", no crash.

This is different from writing to a captured `st.container()` reference (in the sidebar *or* the
main body), where the backend delta path **does** keep growing and the feature relies on the
frontend `ClearStaleNodeVisitor` to hide the duplicates.

## Per-pattern results (after removing the restriction)

| # | Pattern | Before | After removal | Delta-path behavior across fragment reruns |
|---|---------|--------|---------------|--------------------------------------------|
| 1 | `with st.sidebar:` wrapping the fragment **call** | Works | Works (unchanged) | **Stable** — `[1,1,0..2]` every rerun |
| 2 | Sidebar `st.container()` captured by ref | Works | Works (unchanged) | **Accumulates** — `[1,1,0..2]` → `[1,1,3..5]` → `[1,1,6..8]` (frontend hides dupes) |
| 3 | `with st.sidebar:` opened **inside** the fragment | Raised | **Works** | **Stable** — `[1,0]`, `[1,1]` every rerun |
| 4 | Direct `st.sidebar.write(...)` in the fragment | Raised | **Works** | **Stable** — `[1,0]`, `[1,1]` every rerun |
| 5 (control) | Main-body `st.container()` captured by ref | Works | Works | **Accumulates** — `[0,1,0..2]` → `[0,1,3..5]` → … |
| 6 | Direct `st.sidebar.write(...)` **plus** non-fragment sidebar content before & after | Raised | **Works** | **Stable** — fragment resumes at `[1,2..4]` every rerun; outside content at `[1,0]`,`[1,1]`,`[1,5]` untouched |

## Delta-path evidence

Pattern 4 — direct `st.sidebar.write(...)` / `st.sidebar.button(...)` inside the fragment:

```
FULL RUN:          [1,0] markdown   [1,1] button id=$$ID-…-p4_btn
FRAGMENT RERUN #1: [1,0] markdown   [1,1] button id=$$ID-…-p4_btn
FRAGMENT RERUN #2: [1,0] markdown   [1,1] button id=$$ID-…-p4_btn   (identical)
FRAGMENT RERUN #3: [1,0] markdown   [1,1] button id=$$ID-…-p4_btn   (identical)
```

Pattern 6 — direct sidebar writes with non-fragment sidebar content surrounding the fragment:

```
FULL RUN:          [1,0] "header A"   [1,1] "header B"
                   [1,2] frag markdown   [1,3] frag button   [1,4] frag checkbox
                   [1,5] "footer"
FRAGMENT RERUN #1: [1,2] frag markdown   [1,3] frag button   [1,4] frag checkbox
FRAGMENT RERUN #2: [1,2] frag markdown   [1,3] frag button   [1,4] frag checkbox  (identical)
FRAGMENT RERUN #3: [1,2] frag markdown   [1,3] frag button   [1,4] frag checkbox  (identical)
```

Contrast with the captured-container patterns (#2 sidebar, #5 main body), which accumulate:

```
# Pattern 2 (sidebar st.container() by ref)
FULL RUN:          [1,1,0] button   [1,1,1] markdown   [1,1,2] checkbox
FRAGMENT RERUN #1: [1,1,3] button   [1,1,4] markdown   [1,1,5] checkbox
FRAGMENT RERUN #2: [1,1,6] button   [1,1,7] markdown   [1,1,8] checkbox
```

## Why direct sidebar writes do NOT accumulate

When a fragment reruns, the wrapper restores the cursor snapshot it captured at declaration time:

```393:394:lib/streamlit/runtime/fragment.py
                ctx.cursors = deepcopy(cursors_snapshot)
                context_dg_stack.set(deepcopy(dg_stack_snapshot))
```

- **Direct sidebar writes** go through the sidebar **root** DeltaGenerator, whose cursor lives in
  `ctx.cursors`. Restoring `ctx.cursors` from the snapshot resets that cursor to exactly where it
  was when the fragment was declared (e.g. index `2` in pattern 6, after the two outside headers).
  Every rerun therefore reuses the same indices → **stable paths, no accumulation**, and the writes
  land *after* the outside content without clobbering it.

- **Captured `st.container()` references** (patterns 2 and 5) hold their own cursor object directly
  on the container DeltaGenerator that the closure captured. That object is **not** part of
  `ctx.cursors`, so the snapshot/restore does not reset it; it keeps advancing each rerun →
  accumulation. This is identical for sidebar and main-body containers, which is why the feature
  needed the frontend `ClearStaleNodeVisitor` change to hide the duplicates.

So the sidebar root is actually the *easy* case: it self-heals through the existing cursor-snapshot
mechanism and needs no special handling.

## Does the sidebar share the outside-container cursor-accumulation problem?

**No — not for direct sidebar writes.** Removing the restriction yields stable delta paths with no
accumulation, because the sidebar root cursor is reset by the fragment's cursor snapshot. The only
accumulating case is the captured-`st.container()` pattern, and that behaves the same whether the
container is in the sidebar or the main body (it is not sidebar-specific, and it is already handled
by the frontend stale-clearing introduced by this PR).

### Known caveat (general, not accumulation)

Because direct sidebar writes reuse fixed indices, if the fragment emits a **different number** of
elements on a later rerun:
- Fewer elements → the leftover trailing elements carry the fragment's `fragmentId` and a stale
  `scriptRunId`, so the frontend `ClearStaleNodeVisitor` removes them (container-agnostic, 26 unit
  tests pass). Fine.
- More elements than originally → the extra writes can land on indices used by non-fragment content
  that was added *after* the fragment call (the footer in pattern 6), overwriting it. This is the
  same shared-container hazard that already applies to any external write and is not an
  accumulation/duplication bug. Documented as a caveat, not a blocker.

## Verification performed

- Backend reproduction harness (`work-tmp/sidebar_tests/harness.py`) drives a single
  `ScriptRunner` through a full run + N **fragment-scoped** reruns (AppTest only does full reruns,
  so it can't surface this) and prints each delta's `delta_path` and widget IDs. Apps: `p1`–`p6`.
- Python unit tests pass with the change:
  - `lib/tests/streamlit/delta_generator_test.py` (89 passed; the old "explodes" test rewritten to
    `test_enqueue_can_write_directly_to_sidebar_from_fragment`).
  - `lib/tests/streamlit/runtime/fragment_test.py` (583 passed, 1 skipped).
  - `lib/tests/streamlit/elements/element_policies_test.py` (18 passed).
- Frontend `ClearStaleNodeVisitor.test.ts` (26 passed) — confirms the stale-clearing logic that
  backs the captured-container case is container-agnostic.

## Recommendation

**The restriction can be removed.** Direct sidebar writes from a fragment work as-is with no
accumulation problem; the sidebar root self-heals via the existing cursor-snapshot reset. The
change in this branch is: delete the guard + unused helper, update the affected unit test, and
update the `st.fragment` docstring.

Follow-ups to harden before merge:
- Add e2e coverage mirroring `st_fragment_outside_container` for the sidebar: a fragment writing
  multiple elements + a widget via `st.sidebar.write/…` and via `with st.sidebar:`, asserting
  `to_have_count(1)` after several reruns, state retention, and that surrounding non-fragment
  sidebar content is preserved.
- Add a regression test for the variable-element-count case (count decreasing across reruns should
  not leave stale sidebar elements).

## Reproduction

```bash
# Backend env: uv sync --group dev, then generate python protobufs with protoc.
uv run python work-tmp/sidebar_tests/harness.py work-tmp/sidebar_tests/p4_direct_sidebar.py 3
uv run python work-tmp/sidebar_tests/harness.py work-tmp/sidebar_tests/p6_direct_sidebar_with_outside.py 3
uv run python work-tmp/sidebar_tests/harness.py work-tmp/sidebar_tests/p2_sidebar_container_ref.py 3   # accumulating contrast

uv run pytest lib/tests/streamlit/delta_generator_test.py lib/tests/streamlit/runtime/fragment_test.py -q
```
