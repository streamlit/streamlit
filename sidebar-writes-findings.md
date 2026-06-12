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

## The overwrite caveat across all four root containers

The overwrite caveat is not sidebar-specific: it applies to any **root container** a fragment can
write to **directly** that also holds **persistent positional** content interleaved with the
fragment. Streamlit has four root containers (`RootContainer`): `MAIN=0`, `SIDEBAR=1`, `EVENT=2`,
`BOTTOM=3`. Each was checked with a fragment that varies its element count (`n=3 → 1 → 5`) with a
non-fragment "footer" written after the fragment call (`work-tmp/sidebar_tests/driver_generic.py`,
apps `p7`–`p10`):

| Root | Fragment can write directly? | Accumulation? | Growth overwrites trailing neighbor? | Needs wrapper? |
|------|------------------------------|---------------|--------------------------------------|----------------|
| `MAIN` | **No** — body writes go to the fragment's own auto-container; no public handle to `_main_dg` | n/a | n/a | **No** |
| `SIDEBAR` | Yes (`st.sidebar.write`, `with st.sidebar:`) | No (cursor reset via `ctx.cursors`) | **Yes** (verified, `p6`/`p7`) | **Yes** |
| `BOTTOM` | Yes (`st.chat_input`, `with st.bottom:`) | No (cursor reset via `ctx.cursors`) | **Yes** (verified, `p8`) | **Yes** |
| `EVENT` | Yes (`st.toast`, dialogs) | No (cursor reset via `ctx.cursors`) | Mechanically yes at the delta level (`p10`), **but no user-visible loss** | **No** (see below) |

### BOTTOM (verified) — same problem as the sidebar

`st.chat_input()` routes to `bottom_dg._enqueue(...)` and `with st.bottom:` makes the bottom root
the active DG, so a fragment can write directly to it. With `n=3 → 5`:

```
FULL RUN (n=3):  [3,0] header   [3,1] item0   [3,2] item1   [3,3] item2   [3,4] FOOTER
RERUN  (n=5):    [3,1] item0  [3,2] item1  [3,3] item2  [3,4] item3  [3,5] item4
                                                         ↑ [3,4] overwrites the FOOTER
```

Identical mechanism and delta-level outcome as the sidebar (`[3,…]` = bottom root). **BOTTOM needs
the wrapper too.**

### EVENT (investigated) — same mechanism, but does NOT need the wrapper

`st.toast(...)` enqueues to the event root (`[2,…]`) with `has_one_shot_effect=True`; dialogs also
live in the event root. The cursor resets each rerun (no accumulation), and at the **delta level**
the growth collision is present — with a trailing main-script toast, `n=3 → 5` puts `frag toast 3`
on the main toast's slot `[2,3]`:

```
FULL RUN (n=3):  [2,0] frag0   [2,1] frag1   [2,2] frag2   [2,3] MAIN-SCRIPT toast
RERUN  (n=5):    [2,0] frag0  [2,1] frag1  [2,2] frag2  [2,3] frag3  [2,4] frag4
```

But this is **not a user-visible regression**, because EVENT content is not persistent positional
UI:

- Toasts are one-shot effects. `canReuseElementPayload` in `frontend/lib/src/render-tree/AppRoot.ts`
  explicitly refuses to reuse payloads when `hasOneShotEffect` is set, i.e. each delivery re-fires
  and the toast auto-dismisses; there is no stable node sitting at `[2,3]` to "lose".
- On a real fragment-only rerun the main script does not re-run, so the main toast is not
  re-emitted regardless of the collision — it already fired and dismissed during the full run.
- Dialogs in the event root are modal singletons opened on interaction (one at a time), so there is
  no variable-count interleaving to collide with.

So EVENT should **not** be wrapped — positional isolation is meaningless for transient/singleton
event content, and wrapping toasts in a block could interfere with one-shot rendering.

### Implication for the wrapper spec (PR #15413)

The spec excludes **all** top-level/root DGs from the wrapper (`if dg._is_top_level: return False`)
on the rationale that "root cursors are managed by `ctx.cursors`." That rationale only addresses
**accumulation**; it does not address the **interleaving/overwrite** problem the spec itself lists
as a core motivation ("Why simple cursor reset won't work" → *Interleaving* / *Non-contiguous
writes*). The exclusion should therefore be **root-container-aware** rather than a blanket
`_is_top_level` short-circuit:

- Keep excluding `MAIN` (a fragment cannot write to it directly) and `EVENT` (transient one-shot /
  singleton content, no positional isolation needed).
- **Wrap `SIDEBAR` and `BOTTOM`** so a fragment's direct writes are isolated in their own
  independently-resettable block, which prevents growth from clobbering interleaved non-fragment
  content while still advancing the root cursor only once (at wrapper creation). There is no real
  conflict with `ctx.cursors`: the root cursor and the wrapper's internal cursor are different
  cursors, and on a standalone rerun the cached wrapper is returned so the snapshot-restored root
  cursor is simply unused.

## Verification performed

- Backend reproduction harness (`work-tmp/sidebar_tests/harness.py`) drives a single
  `ScriptRunner` through a full run + N **fragment-scoped** reruns (AppTest only does full reruns,
  so it can't surface this) and prints each delta's `delta_path` and widget IDs. Apps: `p1`–`p6`.
- Variable-element-count driver (`work-tmp/sidebar_tests/driver_generic.py`) reproduces the
  overwrite collision for `SIDEBAR` (`p7`), `BOTTOM` (`p8`), and `EVENT` (`p9`, `p10`).
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

The **overwrite caveat** (growth clobbering interleaved non-fragment content) affects `SIDEBAR` and
`BOTTOM` and is best fixed by extending the wrapper mechanism (PR #15413) to those two roots — see
"Implication for the wrapper spec" above. It is a separate issue from accumulation and is not fixed
by simply removing the restriction.

Follow-ups to harden before merge:
- Add e2e coverage mirroring `st_fragment_outside_container` for the sidebar: a fragment writing
  multiple elements + a widget via `st.sidebar.write/…` and via `with st.sidebar:`, asserting
  `to_have_count(1)` after several reruns, state retention, and that surrounding non-fragment
  sidebar content is preserved.
- Add a regression test for the variable-element-count case (count decreasing across reruns should
  not leave stale sidebar elements; growth should not overwrite trailing content once the wrapper
  fix lands), and mirror it for `BOTTOM`.

## Reproduction

```bash
# Backend env: uv sync --group dev, then generate python protobufs with protoc.
uv run python work-tmp/sidebar_tests/harness.py work-tmp/sidebar_tests/p4_direct_sidebar.py 3
uv run python work-tmp/sidebar_tests/harness.py work-tmp/sidebar_tests/p6_direct_sidebar_with_outside.py 3
uv run python work-tmp/sidebar_tests/harness.py work-tmp/sidebar_tests/p2_sidebar_container_ref.py 3   # accumulating contrast

# Overwrite collision across root containers (n = 3 -> 1 -> 5):
uv run python work-tmp/sidebar_tests/driver_generic.py work-tmp/sidebar_tests/p7_variable_count.py 3 1 5          # SIDEBAR
uv run python work-tmp/sidebar_tests/driver_generic.py work-tmp/sidebar_tests/p8_bottom_variable.py 3 1 5         # BOTTOM
uv run python work-tmp/sidebar_tests/driver_generic.py work-tmp/sidebar_tests/p10_event_with_trailing.py 3 1 5    # EVENT (one-shot, no visible loss)

uv run pytest lib/tests/streamlit/delta_generator_test.py lib/tests/streamlit/runtime/fragment_test.py -q
```
