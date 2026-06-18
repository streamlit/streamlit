# Outside Container Writes — Cumulative Test Coverage Analysis

Branch: `cursor/outside-container-writes-enabled-07e6` (5-PR stack, cumulative)
Baseline: `develop` (merge-base `55998a51663d`)
Scope: PRs #15541, #15545, #15598, #15620, #15623

This report assesses test coverage for the "outside container writes" feature with
emphasis on **regression risk in shared code paths** — code that runs for *every*
element/block/fragment, not just the new feature.

---

## 1. Executive summary

Overall coverage of the **new feature mechanics** is good at the unit level: detection
(`_needs_outside_wrapper`), wrapper creation/redirection, the registry lifecycle, and
cursor reset are each directly exercised, and the new `_block` delta-path snapshot logic
has dedicated regression tests. The **highest residual risk is concentrated in shared hot
paths** that the stack rewired for all apps: `DeltaGenerator._block` now performs a
`get_script_run_ctx()` + `ThreadState.get()` on every block creation and was refactored to
a new `_enqueue_add_block` helper, and `wrapped_fragment` now scopes every fragment with
`delta_path=None` and runs evict/reset on every fragment rerun. These are covered
indirectly but have thin *targeted* regression coverage.

The biggest concrete gaps are: (1) **no test places an interactive widget in an outside
container and verifies that interacting with it triggers a fragment-only rerun** — the
headline behavior of PR #15623 and an explicit "Behavior Decisions" item in the spec;
(2) the spec's **explicit SIDEBAR/BOTTOM shrink→grow interleaving tests are missing** (the
e2e shrink/grow test uses a plain `st.container`, while the sidebar/bottom e2e tests use a
*constant* element count); and (3) the new e2e snapshot test
`test_outside_container_transparent_wrapper` has **no committed baseline image**, so it
cannot pass as written.

---

## 2. Changeset overview

| File | Category | Notes |
|------|----------|-------|
| `proto/streamlit/proto/Block.proto` | feature-only | New `Transparent` block (field 17). |
| `frontend/lib/src/components/core/Block/Block.tsx` | shared-path (render) | New early branch for `transparent` → `ChildRenderer`. Runs in block render for all blocks (one extra truthy check). |
| `lib/streamlit/cursor.py` | shared (additive) | New `RunningCursor.reset()`. Purely additive; only called by reset logic. |
| `lib/streamlit/runtime/outside_container_wrapper.py` | feature-only | New `OutsideContainerWrapper` dataclass. |
| `lib/streamlit/delta_generator.py` | **shared-path (HOT)** | `_enqueue` and `_block` rewired; new `_creating_fragment_id` on every DG; `_block` message build refactored. Highest-traffic change. |
| `lib/streamlit/runtime/fragment.py` | **shared-path** | `wrapped_fragment` scoping change (`delta_path=None`), evict+reset on every rerun, `FragmentStorage` protocol + registry, `_remove` signature change. |
| `lib/streamlit/runtime/scriptrunner/script_runner.py` | shared-path | `clear_outside_wrappers()` at start of every full run. |
| `lib/streamlit/elements/lib/policies.py` | **shared-path** | `check_fragment_path_policy` deleted; no longer called from `check_widget_policies` (runs for every widget). |
| `lib/streamlit/errors.py` | feature-only | `StreamlitFragmentWidgetsNotAllowedOutsideError` removed. |
| Tests (`delta_generator_test.py`, `fragment_test.py`, `cursor_test.py`, `element_policies_test.py`, `Block.test.tsx`, `st_fragment_basics*.py`) | tests | See §3–§5. |

---

## 3. Feature coverage assessment

### Covered (unit)
- **Detection** `_needs_outside_wrapper` — `NeedsOutsideWrapperTest` covers no-fragment-id,
  no-delta-path, SIDEBAR/BOTTOM true, MAIN/EVENT false, in-fragment-path false,
  already-inside-wrapper false (ancestor walk), outside-scope true, parallel-worker false.
  This matches the spec's detection logic closely.
- **Wrapper creation/redirection** `OutsideWrapperCreationTest` — transparent block then
  nested element at `[*outside_path, 0]`; single wrapper reuse; nested container → one
  wrapper; two fragments → distinct slots; standalone-rerun-without-prior-write raises;
  `st.empty()` → locked wrapper; bottom root → `creating_fragment_id is None`.
- **`_block` delta path** `BlockCreationDeltaPathTest` — container at non-zero index and
  nested containers emit `add_block` at the correct (pre-advance) path.
- **Registry lifecycle** (`MemoryFragmentStorageTest`, `ResetOutsideWrappersTest`) —
  register/get/isolate-by-fragment; `clear()` *retains* wrappers; `clear_outside_wrappers()`
  drops all; `evict_outside_wrappers_created_by`; `_remove` evicts a removed fragment's own
  wrappers via `clear_stale_descendants`; reset re-emits + resets RunningCursor; LockedCursor
  re-emitted but not reset; eviction-before-reset ordering; parent-rerun-evicts/standalone-
  survives; re-emission carries `fragment_id` and restores scope.
- **`_creating_fragment_id` stamping** `ContainerCreatingFragmentIdTest` — main-script None,
  fragment-stamped, wrapper records the *creating* (not writing) fragment.

### Covered (e2e — `st_fragment_basics`)
- Interleaved header/fragment/footer in one `st.container` (count stable across reruns).
- Two fragments → same container, distinct wrappers; rerunning one leaves the other put.
- Sidebar (with-block + direct) and bottom direct writes with header/footer (constant count).
- `outside.empty()` placeholder pattern.
- Nested container inside an outside container.
- Shrink (5→2) then grow (2→5) in a plain `st.container` with footer (GC + no overwrite).
- Transparent wrapper visual snapshot (see gap below — no baseline committed).

### Covered (frontend)
- `Block.test.tsx`: transparent block renders children directly (no `stVerticalBlock` /
  layout wrapper / column / horizontal block); empty transparent renders nothing.

### Feature gaps (untested or thin)
1. **Interactive widget in an outside container + interaction → fragment-only rerun.**
   The entire point of PR #15623 (lifting `StreamlitFragmentWidgetsNotAllowedOutsideError`)
   and the "Widget interactions trigger the writing fragment's rerun" Behavior Decision is
   untested end-to-end. All e2e outside-writes are **markdown** (non-widget); the buttons
   that drive reruns live *inside* the fragment body, not in the outside container. There is
   no assertion that, e.g., `st.sidebar.button(...)` written from a fragment reruns only the
   fragment and not the full app, and no assertion that the widget's value/state survives.
2. **Spec testing-plan SIDEBAR shrink/grow and BOTTOM shrink/grow.** The spec explicitly
   asks for variable-count (3→5→2) tests on SIDEBAR and BOTTOM with a trailing footer. The
   only shrink/grow e2e test (`test_fragment_shrink_clears_stale_outside_elements`) uses a
   plain `st.container`. Sidebar/bottom roots reach `_needs_outside_wrapper` through a
   *different branch* (`dg._is_top_level`) and have stable `_id`s with different lifecycle
   handling, so the container shrink/grow test does not transitively cover them.
3. **Parent-fragment recreation, end-to-end.** The spec's "Parent-fragment recreation"
   scenario (parent `P` creates `c`; cross-scope `F` writes to `c`; rerun `P` rebuilds `c`)
   is covered only at the mocked unit level (`test_parent_rerun_evicts_nested_wrapper_but_
   standalone_survives`). No e2e/AppTest drives a real parent rerun and asserts exactly one
   wrapper survives keyed to the rebuilt container with no out-of-bounds delta path.
4. **`run_every` fragment that writes to an outside container.** Periodic reruns exercise the
   reset/re-emit path with no user interaction; untested.
5. **`st.form` inside a fragment writing to an outside container** (form submit semantics
   through a wrapper) — untested.
6. **EVENT root from a fragment** (`st.toast` / `st.dialog`) — `_needs_outside_wrapper`
   returns False by design, but there's no test confirming a fragment-emitted toast still
   fires and is not accidentally wrapped/suppressed (no-regression check for the exclusion).
7. **Dynamic container selection raise path, e2e.** Unit test covers the
   "could not reserve a stable position" raise; no e2e confirms the user-visible exception.

---

## 4. Shared-path regression risk assessment (most important)

### 4.1 `_block()` now fetches ctx + ThreadState on every block — **MEDIUM**
`lib/streamlit/delta_generator.py:621-629`

```621:629:lib/streamlit/delta_generator.py
        ctx = get_script_run_ctx()
        ts = ThreadState.get() if ctx else None
        if (
            ctx is not None
            and ts is not None
            and ts.fragment_id
            and _needs_outside_wrapper(dg, ts, ctx.fragment_storage)
        ):
            dg = _get_or_create_outside_wrapper(dg, ts, ctx)
```

On `develop`, `_block` did **not** call `get_script_run_ctx()` at all — it built the
`ForwardMsg` directly. Now every `st.container`, `st.columns`, `st.expander`, `st.form`,
`st.tabs`, `st.status`, `st.popover`, `st.chat_message`, `st.dialog` pays a ctx +
ThreadState lookup.
- **Failure mode:** For normal (non-fragment) blocks `ts.fragment_id` is falsy, so behavior
  is preserved; risk is (a) a latent ordering/state assumption now reading ThreadState
  earlier, and (b) per-block overhead in deeply nested layouts.
- **Existing coverage:** `BlockCreationDeltaPathTest` runs real `st.container()` chains
  through this code and asserts correct delta paths, which is a solid functional guard. No
  test asserts the *non-fragment* path leaves the registry untouched (i.e. that a plain
  `st.container()` never creates a wrapper), though this is implied.
- **Recommendation:** add a cheap assertion that a non-fragment block run produces an empty
  `outside_wrappers_for(...)` and identical delta paths to baseline (see §6).

### 4.2 `_block()` message build refactored to `_enqueue_add_block` + snapshot timing — **LOW**
`lib/streamlit/delta_generator.py:636,663-667`

The block's `delta_path` is snapshotted into `block_delta_path = list(parent_cursor.delta_path)`
*before* `get_locked_cursor()` advances the index, then emitted via `_enqueue_add_block`.
This preserves `develop`'s ordering (which also read `delta_path` before advancing), so the
wire output is unchanged.
- **Failure mode:** if the snapshot moved *after* `get_locked_cursor()`, every container
  would emit at the next sibling slot (off-by-one), corrupting the tree.
- **Coverage:** directly guarded by `BlockCreationDeltaPathTest.test_container_add_block_
  uses_correct_delta_path` and `test_nested_container_delta_paths`. Risk is low and
  well-covered.

### 4.3 `_enqueue()` — removed sidebar guard + new wrapper branch — **LOW**
`lib/streamlit/delta_generator.py:532-533`

The old `_writes_directly_to_sidebar` raise was removed; the new branch only runs when
`ts.fragment_id` is set. Normal `st.write`/widget enqueues outside fragments skip it
entirely.
- **Coverage:** the large existing `_enqueue` suite plus the rewritten
  `test_fragment_writing_directly_to_sidebar_is_redirected_to_wrapper` and
  `test_parallel_worker_writing_directly_to_sidebar_raises` cover both the removal and the
  new redirect. Low risk.

### 4.4 `wrapped_fragment` scopes every fragment with `delta_path=None` — **MEDIUM**
`lib/streamlit/runtime/fragment.py:538`

```538:538:lib/streamlit/runtime/fragment.py
            with ThreadState.scoped(fragment_id=fragment_id, delta_path=None):
```

Previously the scope was `ThreadState.scoped(fragment_id=fragment_id)` and `delta_path`
*inherited* from the parent scope. Now it is reset to `None` and re-established when the
fragment container is created. This runs for **every** fragment, not just outside-writers.
- **Failure modes:**
  - Elements written in a fragment *before* its container is established run with
    `delta_path=None`; `_needs_outside_wrapper` returns False in that window
    (`delta_generator.py:768` guard), so a genuine outside write during that brief window
    would silently bypass wrapping. Unlikely to be reachable in practice but untested.
  - Nested fragments: the inner fragment must not corrupt the outer's `delta_path`.
- **Coverage:** `test_nested_fragment_restores_outer_delta_path` confirms the outer's
  `delta_path` is restored after an inner fragment returns and that the inner actually
  mutates it. This is the key guard and it is present. The removed
  `element_policies_test` previously had a dedicated `delta_path is None` case; that
  protection now lives implicitly in `_needs_outside_wrapper`'s guard, which is covered by
  `NeedsOutsideWrapperTest.test_no_delta_path_returns_false`.

### 4.5 evict + reset run on **every** fragment rerun — **MEDIUM**
`lib/streamlit/runtime/fragment.py:510-511`

```510:511:lib/streamlit/runtime/fragment.py
                ctx.fragment_storage.evict_outside_wrappers_created_by(fragment_id)
                _reset_outside_wrappers(ctx.fragment_storage, fragment_id)
```

Every standalone fragment rerun (including normal fragments with zero outside writes) now
calls these two functions.
- **Failure mode:** for a normal fragment the registry slice is empty, so both are no-ops;
  a bug here (e.g. iterating a shared dict, or `_reset` re-emitting spurious blocks) would
  affect *all* fragment reruns.
- **Coverage:** `test_sets_dg_stack_and_cursor_to_snapshots_if_fragment_ids_this_run`
  exercises the snapshot-restore rerun branch (now also running evict+reset with an empty
  registry). `ResetOutsideWrappersTest` covers reset/evict directly. No test asserts that a
  **normal fragment rerun with an empty registry emits no extra `add_block`** (i.e. evict +
  reset are truly no-ops on the wire) — worth a targeted guard (see §6).

### 4.6 `MemoryFragmentStorage._remove` signature + `clear()` retaining wrappers — **MEDIUM**
`lib/streamlit/runtime/fragment.py:253-271`

`clear()` (end of full run) now calls `_remove(..., evict_wrappers=False)` so wrappers
*survive* into the following fragment reruns, while `clear_stale_descendants`/`delete` keep
the default `evict_wrappers=True`.
- **Failure mode:** if `clear()` evicted wrappers, the first standalone rerun after a full
  run would have no reserved slot and raise "could not reserve a stable position"; if
  `delete`/`clear_stale_descendants` *failed* to evict, a re-added fragment could reuse a
  stale wrapper (bad delta path).
- **Coverage:** `test_clear_retains_outside_wrappers`, `test_standalone_rerun_reuses_
  wrapper_after_full_run_clear` (the exact regression), and
  `test_remove_drops_removed_fragments_own_wrappers` (via `clear_stale_descendants`). **Gap:**
  no direct test that `storage.delete(fragment_id)` evicts that fragment's wrappers (the
  `delete` path routes through `_remove` with the default, but it isn't asserted).

### 4.7 `clear_outside_wrappers()` placement in `script_runner` — **LOW/MEDIUM**
`lib/streamlit/runtime/scriptrunner/script_runner.py:777-783`

Called in the `else` (full-app-run) branch of `if fragment_ids_this_run:`, i.e. at the
start of every full run, before the script body recreates outside containers.
- **Failure mode:** if this ran in the wrong branch (or after the body), wrappers from a
  prior run with stale `_id`s/advanced cursors (notably stable-`_id` roots `st.sidebar`,
  `st.bottom`, and main-script containers) would leak into the new run.
- **Coverage:** **only indirect.** No unit/integration test asserts that a full rerun
  *starts* by clearing wrappers (the behavior is asserted at the storage API level via
  `clear_outside_wrappers`, but not its invocation site in `script_runner`). Because
  `script_runner` is hard to unit test, an e2e full-app-rerun after fragment activity that
  asserts no stale wrappers/duplicate blocks would be the realistic guard. The existing
  `test_full_app_rerun` e2e does not touch outside containers.

### 4.8 `policies.check_fragment_path_policy` deleted — **LOW/MEDIUM**
`lib/streamlit/elements/lib/policies.py` (function removed; no longer called by
`check_widget_policies`)

`check_widget_policies` runs for **every widget**. Removing the call removes a per-widget
branch.
- **Failure mode:** the guard previously *raised* for widgets written outside a fragment's
  path; removing it is intentional (wrappers now handle it), but any code that relied on the
  raise is now silent. Normal widgets inside a fragment / outside any fragment were no-ops
  under the old guard, so they are unaffected.
- **Coverage:** `element_policies_test` was updated to drop the now-removed assertions and
  still asserts the remaining policies are called. Adequate. Residual risk is purely the
  semantic change (now-allowed widget writes), which shifts to the feature tests in §3.

### 4.9 `_creating_fragment_id` added to DeltaGenerator + copied on deepcopy/`_with_dg` — **LOW**
`delta_generator.py:326,419,663`. Set on every block; copied so `st.empty().container()`
style flows preserve it. Covered by `ContainerCreatingFragmentIdTest`. Low risk.

### 4.10 Frontend `Block.tsx` transparent branch — **LOW**
`frontend/lib/src/components/core/Block/Block.tsx` adds an early `if (node.deltaBlock.
transparent)` returning a bare `ChildRenderer`. Runs for every block (one extra property
check). Covered by `Block.test.tsx` (renders children directly; empty renders nothing).
**Gap:** no frontend test for a *nested block* (e.g. a column or container) inside a
transparent wrapper inheriting the parent's flex direction/width — only a text child is
tested.

---

## 5. Normal fragment coverage assessment

The pre-existing `FragmentTest` suite (`test_wrapped_fragment_calls_original_function`,
`test_resets_fragment_id_on_success/exception`, `test_nested_fragment_restores_outer_delta_
path`, `test_sets_dg_stack_and_cursor_to_snapshots_*`, `test_run_every_arg_handling`,
`test_fragment_raises_*`, `test_wrapped_fragment_skips_container_when_pre_allocated`,
`test_nested_sequential_fragment_creates_own_container`) all execute through the modified
`wrapped_fragment`, so the new scoping and evict/reset calls are exercised on the normal
fragment lifecycle. Fragment error handling (exceptions during execution) and rerun via
snapshot restore are covered.

Adequately covered through the modified code:
- Simple fragment rerun (snapshot/cursor restore) — yes.
- Nested fragments + delta_path restoration — yes (`test_nested_fragment_restores_outer_
  delta_path`, `test_nested_sequential_fragment_creates_own_container`).
- `run_every` argument handling — yes (but not *with* outside writes; see §3.4).
- Exception handling — yes.

Thin / missing for normal fragments:
- **No assertion that evict+reset are wire no-ops for a fragment with an empty registry**
  (i.e. a normal fragment rerun emits no spurious `add_block`). This is the cheapest guard
  against §4.5 regressions.
- **Fragment-with-widget state persistence across a *full* app rerun** (not a fragment
  rerun) running through the new `delta_path=None` scoping — relies on existing e2e
  (`test_full_app_rerun`) which uses markdown only, not widget state. Not a direct outside-
  writes concern but touches the modified scoping.
- **`st.form` inside a normal fragment** through the modified `_block` — not specifically
  re-verified.

---

## 6. Prioritized recommendations

Ordered by impact (regression-catching value × likelihood).

### P1 — Widget in an outside container triggers a fragment-only rerun (feature + headline behavior)
- **What:** In `st_fragment_basics.py`, have a fragment write a real widget into an outside
  container (e.g. `outside.button("x")` and `st.sidebar.button("y")`), plus a counter in
  the fragment body. In `st_fragment_basics_test.py`, click that outside widget and assert
  (a) only the fragment's content changed (a main-script `uuid4()` marker outside the
  fragment is unchanged → fragment-only rerun, not full app), and (b) `expect_no_exception`.
- **Why:** This is the core capability lifted by PR #15623 and the "Widget interactions
  trigger the writing fragment's rerun" Behavior Decision — currently *zero* tests place an
  interactive widget outside the fragment scope. A regression that reverts to a full-app
  rerun or re-raises the old `...WidgetsNotAllowedOutsideError` would not be caught.
- **Where:** e2e `e2e_playwright/st_fragment_basics{,_test}.py`. Optionally an AppTest unit
  test asserting the delta carries the fragment's `fragment_id`.
- **Sketch:**
  ```python
  click_button(app, "outside_widget_in_fragment")
  expect(_outside_fragment_markdown(app)).to_have_text(old_outside_text)  # full app NOT rerun
  expect(fragment_counter).to_have_text("count: 2")
  expect_no_exception(app)
  ```

### P2 — SIDEBAR and BOTTOM shrink→grow interleaving (spec testing plan)
- **What:** Add sidebar and bottom fragments whose direct-root element count varies
  (3→5→2) with a non-fragment header before and footer after, mirroring the existing
  `shrink_container` test but on `st.sidebar` and `st.bottom`.
- **Why:** The spec explicitly calls these out; sidebar/bottom hit the `dg._is_top_level`
  detection branch and stable-`_id` lifecycle, which the `st.container` shrink test does not
  cover. Catches overwrite-of-footer on growth and stale-children on shrink for roots.
- **Where:** e2e `st_fragment_basics{,_test}.py`.
- **Sketch:** drive shrink, assert root markdown count drops and footer keeps its slot;
  drive grow, assert count restored and footer still last; `expect_no_exception`.

### P3 — Commit the missing snapshot baseline for `test_outside_container_transparent_wrapper`
- **What:** `e2e_playwright/__snapshots__/linux/st_fragment_basics_test/` does not exist;
  the snapshot `st_fragment_basics-outside_container_transparent_wrapper[...]` has no
  baseline, so the test cannot pass.
- **Why:** A snapshot assertion with no baseline fails CI. Either commit generated baselines
  (light/dark × chromium/firefox/webkit) or convert the check to a non-snapshot structural
  assertion.
- **Where:** e2e snapshots dir / CI snapshot-generation step.

### P4 — Non-fragment block path is wrapper-free (shared-path guard for §4.1/§4.5)
- **What:** Unit test: run a normal `st.container()`/`st.columns()` with no active fragment
  and assert `fragment_storage.outside_wrappers_for(...)` stays empty and delta paths match
  baseline. Plus: drive a normal fragment rerun (empty registry) and assert no extra
  `add_block` messages are emitted by evict+reset.
- **Why:** Cheapest guard that the new ctx/ThreadState lookups and the per-rerun
  evict+reset in the hot path remain true no-ops for non-feature usage.
- **Where:** `lib/tests/streamlit/delta_generator_test.py`,
  `lib/tests/streamlit/runtime/fragment_test.py`.
- **Sketch:**
  ```python
  st.container().markdown("hi")
  assert ctx.fragment_storage.outside_wrappers_for("anything") == []
  # and: count delta messages before/after a no-outside-write fragment rerun are equal
  ```

### P5 — Full-app rerun clears wrappers (covers §4.7 invocation site)
- **What:** e2e: after interacting with an outside-writing fragment, trigger a full app
  rerun (press "r") and assert no duplicated wrapper content / stale elements and
  `expect_no_exception`. (Existing `test_full_app_rerun` uses markdown only and no outside
  container.)
- **Why:** `clear_outside_wrappers()`'s placement in `script_runner` is only covered at the
  storage-API level, never at the call site. A misplacement would leak stale wrappers across
  full runs (advanced cursor → bad delta path).
- **Where:** e2e `st_fragment_basics_test.py`.

### P6 — Parent-fragment recreation, end-to-end (spec testing plan)
- **What:** AppTest/e2e where parent `P` creates `c = st.container()`, cross-scope `F`
  writes to `c`; rerun `P` (rebuilds `c`), then rerun `F`. Assert exactly one wrapper for
  `(F, c)` keyed to the rebuilt container, no stray node, no out-of-bounds delta path; then
  `F` reuses its wrapper and resets content.
- **Why:** Currently only mocked-unit coverage; the real DG-rebuild + eviction interaction
  is the spec's named lifecycle case.
- **Where:** AppTest under `lib/tests` or e2e.

### P7 — `delete()` evicts the fragment's wrappers (close §4.6 gap)
- **What:** Unit test: register a wrapper for `frag`, call `storage.delete("frag")`, assert
  `outside_wrappers_for("frag") == []`.
- **Why:** The `delete` → `_remove(evict_wrappers=True)` path is relied upon but unasserted;
  a future change to `delete` could silently leak wrappers.
- **Where:** `lib/tests/streamlit/runtime/fragment_test.py`.

### P8 — Lower-priority feature gaps
- `run_every` fragment writing to an outside container (periodic reset/re-emit path).
- `st.form` inside a fragment writing to an outside container.
- No-regression check that a fragment-emitted `st.toast` (EVENT root) still fires and is not
  wrapped/suppressed.
- Frontend: a nested block (column/container) inside a transparent wrapper inherits parent
  flex direction/width (extend `Block.test.tsx`).
- e2e for the "could not reserve a stable position" raise on conditional first-write during
  a standalone rerun.

---

## Appendix — key code references

- Detection: `lib/streamlit/delta_generator.py:759` (`_needs_outside_wrapper`).
- Wrapper create/redirect: `lib/streamlit/delta_generator.py:791`
  (`_get_or_create_outside_wrapper`), call sites `:532`, `:629`.
- `_block` ctx lookup + message refactor: `:621-667`; emit helper `:751`.
- DG `_creating_fragment_id`: `:326`, `:419`, `:663`.
- Cursor reset: `lib/streamlit/cursor.py:213`.
- Fragment scoping change: `lib/streamlit/runtime/fragment.py:538`.
- Evict + reset per rerun: `:510-511`; `_reset_outside_wrappers` `:413`.
- Registry + `_remove`/`clear`: `:253-271`, `:388`, `:396`.
- Full-run clear site: `lib/streamlit/runtime/scriptrunner/script_runner.py:777-783`.
- Removed policy: `lib/streamlit/elements/lib/policies.py` (`check_fragment_path_policy`).
- Frontend transparent render: `frontend/lib/src/components/core/Block/Block.tsx:290`.
