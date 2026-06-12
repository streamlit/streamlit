# Findings: writing to the sidebar from a fragment

**Branch under test:** `cursor/fragment-external-container-writes-4f88` (PR #15398 —
"[feature] Allow fragments to write widgets to outside containers").
**Investigated on:** branch `cursor/sidebar-fragment-write-patterns-68a3` (identical tree to
the feature branch HEAD `f2a396807f`).

## TL;DR

The sidebar **shares the exact same mechanism** as any other outside container on this branch.
It is **not** a special-cased or broken path:

- The two "should work" patterns (fragment call wrapped in `with st.sidebar:`, and a sidebar
  `st.container()` captured by reference) behave **identically to their main-body equivalents**:
  no widget duplication, stable widget IDs (state retained), no "Bad delta path index" crash.
- The two "should raise" patterns (`with st.sidebar:` opened *inside* the fragment, and direct
  `st.sidebar.write(...)`) still raise the pre-existing `StreamlitAPIException` from the
  `_writes_directly_to_sidebar` guard — gracefully, with a stable delta path, no crash.
- The backend cursor for an outside container **does keep advancing across fragment reruns**
  (delta paths grow), but this is true for the sidebar and the main body in exactly the same way.
  Visual correctness is restored by the **frontend** `ClearStaleNodeVisitor`, which clears stale
  elements by `fragmentId` independently of which root container they live in.

**Recommendation: works as-is.** The wrapper / element-level-clearing mechanism already covers the
sidebar — no sidebar-specific fix is required. The only gap is *test coverage*: the new
`st_fragment_outside_container` e2e test only exercises main-body containers. Adding a sidebar
variant is recommended to lock in the behavior (details below).

## Per-pattern results

| # | Pattern | Result | Notes / failure mode |
|---|---------|--------|----------------------|
| 1 | `with st.sidebar:` wrapping the fragment call | **Works** | Fragment's own container lives in the sidebar; delta paths are **stable** across reruns (`[1,1,0..2]` every rerun). No duplication. |
| 2 | Sidebar `st.container()` created outside, written via captured ref | **Works** | Backend delta paths **accumulate** (`[1,1,0..2]` → `[1,1,3..5]` → `[1,1,6..8]`), but widget IDs are stable and the frontend clears the stale copies. Net visual result: no duplication, state retained. Identical to the main-body case (pattern 5 below). |
| 3 | `with st.sidebar:` opened **inside** the fragment body | **Raises** | `StreamlitAPIException`: *"Calling `st.sidebar` in a function wrapped with `st.fragment` is not supported. … call your fragment function inside a `with st.sidebar` context manager."* Rendered as an exception element at a **stable** path; no crash. |
| 4 | Direct `st.sidebar.write(...)` inside a fragment | **Raises** | Same `StreamlitAPIException` as #3 (same guard). Stable path, graceful. |
| 5 (control) | Main-body `st.container()` created outside, written via captured ref | **Works** | Backend paths accumulate (`[0,1,0..2]` → `[0,1,3..5]` → `[0,1,6..8]`); included as the non-sidebar baseline for comparison with #2. |

No "Bad delta path index" or similar error appeared in any pattern. Main-body content and sidebar
content created *outside* the fragment were never disturbed by the fragment reruns.

## How this was tested

AppTest always performs *full* reruns, so it cannot reproduce the cross-fragment-rerun cursor
behavior that this feature is about. Instead a small harness
(`work-tmp/sidebar_tests/harness.py`) reuses a **single** `ScriptRunner` (one
`fragment_storage`, one `ScriptRunContext`) and feeds it a full run followed by N
**fragment-scoped** reruns (`RerunData(fragment_id_queue=[...], is_fragment_scoped_rerun=True)`),
exactly like the real server does for a fragment-only rerun. For each run it records every delta
`ForwardMsg`'s `metadata.delta_path`, element type, and widget IDs.

Test apps live in `work-tmp/sidebar_tests/` (`p1_*`–`p5_*`). Each fragment contains a button +
markdown + checkbox and is rerun several times.

### Delta-path evidence

Pattern 2 — sidebar container by reference (`p2_sidebar_container_ref.py`):

```
FULL RUN:          [1,1,0] button id=$$ID-…-p2_btn   [1,1,1] markdown   [1,1,2] checkbox id=$$ID-…-p2_check
FRAGMENT RERUN #1: [1,1,3] button id=$$ID-…-p2_btn   [1,1,4] markdown   [1,1,5] checkbox id=$$ID-…-p2_check
FRAGMENT RERUN #2: [1,1,6] button id=$$ID-…-p2_btn   [1,1,7] markdown   [1,1,8] checkbox id=$$ID-…-p2_check
```

Pattern 5 — main-body container by reference (`p5_main_container_ref.py`), the control:

```
FULL RUN:          [0,1,0] button   [0,1,1] markdown   [0,1,2] checkbox
FRAGMENT RERUN #1: [0,1,3] button   [0,1,4] markdown   [0,1,5] checkbox
FRAGMENT RERUN #2: [0,1,6] button   [0,1,7] markdown   [0,1,8] checkbox
```

The accumulation pattern is **identical**; only the root container index differs (`1` = sidebar,
`0` = main). Crucially, the **widget IDs are stable** across reruns (they are derived from the
user `key`, not the delta path), which is why widget state is retained even though the path grows.

Pattern 1 — fragment call wrapped in `with st.sidebar:` (`p1_with_sidebar_wrap.py`) — paths are
stable, because the elements live in the fragment's *own* container, whose cursor is reset on each
rerun:

```
FULL RUN:          [1,1,0] button   [1,1,1] markdown   [1,1,2] checkbox
FRAGMENT RERUN #1: [1,1,0] button   [1,1,1] markdown   [1,1,2] checkbox   (identical)
FRAGMENT RERUN #2: [1,1,0] button   [1,1,1] markdown   [1,1,2] checkbox   (identical)
```

Patterns 3 & 4 emit a single exception element at a stable path on every run, e.g.:

```
[0,1,0] exception:streamlit.errors.StreamlitAPIException:'Calling `st.sidebar` in a function wrapped with `st.fragment…'
```

## Why it behaves this way (code walk-through)

1. **Cursor reset on fragment rerun.** When a fragment reruns, the wrapper restores the cursor
   snapshot it captured at declaration time:

```393:394:lib/streamlit/runtime/fragment.py
                ctx.cursors = deepcopy(cursors_snapshot)
                context_dg_stack.set(deepcopy(dg_stack_snapshot))
```

   This resets the cursor of the fragment's **own** container (pattern 1 → stable paths). It does
   **not** reset the cursor of a container object captured by reference outside the fragment, so
   writes to such a container advance its cursor on every rerun (patterns 2 and 5 → growing
   paths). This is the same for sidebar and main-body containers.

2. **`fragment_id` is stamped on every delta, regardless of container.** The element-level clear
   on the frontend depends on this, and it is set purely from thread state, so sidebar deltas are
   tagged just like main-body deltas:

```476:477:lib/streamlit/runtime/scriptrunner_utils/script_run_context.py
    if ts.fragment_id and msg.WhichOneof("type") == "delta":
        msg.delta.fragment_id = ts.fragment_id
```

3. **Frontend clears stale fragment elements by `fragmentId`, not by container.** The PR's core
   change makes `visitElementNode` clear any stale element whose `fragmentId` is running this batch,
   independent of parent-block context. The visitor recurses the whole tree (main + sidebar), so
   the accumulated sidebar copies from earlier reruns are removed:

```138:148:frontend/lib/src/render-tree/visitors/ClearStaleNodeVisitor.ts
      if (
        node.fragmentId &&
        node.scriptRunId !== this.currentScriptRunId &&
        (this.fragmentIdOfBlock ||
          this.fragmentIdsThisRun.includes(node.fragmentId))
      ) {
        return undefined
      }

      // Preserve in all other cases during fragment run
      return node
```

   The 26 unit tests in `ClearStaleNodeVisitor.test.ts` pass on this branch and confirm the
   container-agnostic clearing logic.

4. **The sidebar guard is unchanged and still active.** Patterns 3 & 4 trip the long-standing
   `_writes_directly_to_sidebar` check (added in #8408, *before* this PR), which fires for any
   element whose active DeltaGenerator is the sidebar root with no intervening container:

```499:504:lib/streamlit/delta_generator.py
        if ctx and ThreadState.get().fragment_id and _writes_directly_to_sidebar(dg):
            raise StreamlitAPIException(
                "Calling `st.sidebar` in a function wrapped with `st.fragment` is not "
                "supported. To write elements to the sidebar with a fragment, call your "
                "fragment function inside a `with st.sidebar` context manager."
            )
```

```720:723:lib/streamlit/delta_generator.py
def _writes_directly_to_sidebar(dg: DeltaGenerator) -> bool:
    in_sidebar = any(a._root_container == RootContainer.SIDEBAR for a in dg._ancestors)
    has_container = bool(list(dg._ancestor_block_types))
    return in_sidebar and not has_container
```

   Pattern 2 passes this guard because the captured `st.container()` is an intervening block
   (`has_container` is true), so `_writes_directly_to_sidebar` returns `False`.

## Does the sidebar share the outside-container cursor-accumulation problem?

**Yes — and that is by design on this branch.** Backend cursor accumulation for outside containers
is *not* prevented for either the sidebar or the main body; both grow their delta-path index on
every fragment rerun. The branch's strategy is to tolerate that on the backend and **compensate on
the frontend** by clearing stale fragment-owned elements via `ClearStaleNodeVisitor`. Because that
clearing keys off `fragmentId` (set on all deltas) and traverses the whole render tree, the sidebar
is covered by the same fix automatically. The user-visible result for the sidebar matches the main
body: no duplication, retained widget state, no crash.

One shared, pre-existing caveat worth noting (not sidebar-specific): the backend delta-path index
for an outside container grows unbounded for as long as the session lives and the fragment keeps
rerunning without a full app rerun. A full app rerun recreates the container and resets the index.
This is inherent to the captured-reference pattern (#2 and #5) and is independent of the sidebar.

## Recommendation

- **No product change needed for the sidebar.** The supported patterns (1 and 2) work, and the
  unsupported patterns (3 and 4) still raise a clear, actionable `StreamlitAPIException` with a
  stable delta path (no crash). The wrapper/element-clearing mechanism already extends to the
  sidebar.
- **Add e2e coverage.** The new `e2e_playwright/st_fragment_outside_container.py` test only
  exercises main-body containers. Mirror it for the sidebar to prevent regressions: a fragment
  writing multiple elements + a widget into (a) a `with st.sidebar:`-wrapped fragment call and
  (b) a sidebar `st.container()` captured by reference, asserting `to_have_count(1)` for each
  widget after several reruns and that state is retained. Also add a negative case asserting the
  `StreamlitAPIException` for direct `st.sidebar.write(...)` inside a fragment.

## Reproduction

```bash
# Backend dev env: uv sync --group dev, then generate python protobufs with protoc.
# Drive real fragment-scoped reruns and print delta paths for each pattern:
uv run python work-tmp/sidebar_tests/harness.py work-tmp/sidebar_tests/p1_with_sidebar_wrap.py 3
uv run python work-tmp/sidebar_tests/harness.py work-tmp/sidebar_tests/p2_sidebar_container_ref.py 3
uv run python work-tmp/sidebar_tests/harness.py work-tmp/sidebar_tests/p3_with_sidebar_inside.py 2
uv run python work-tmp/sidebar_tests/harness.py work-tmp/sidebar_tests/p4_direct_sidebar.py 2
uv run python work-tmp/sidebar_tests/harness.py work-tmp/sidebar_tests/p5_main_container_ref.py 3   # control

# Frontend clearing logic (container-agnostic), 26 tests pass:
cd frontend && yarn workspace @streamlit/lib test --run src/render-tree/visitors/ClearStaleNodeVisitor.test.ts
```

> Note: a full browser-level Playwright e2e was not run here (the cloud env had no pre-built
> frontend/browser harness); the visual no-duplication outcome is established via the delta-path
> evidence above plus the container-agnostic frontend clearing logic and its passing unit tests.
> The recommended sidebar e2e variant should be added to confirm end-to-end in a browser.
