# Spec Alignment Audit: Outside Container Writes for Fragments

**Audit target:** the 5-PR implementation stack for "outside container writes."
**Spec audited against:** `specs/2026-06-03-outside-container-writes/tech-spec.md`
(authored `sfc-gh-lwilby-1`, 2026-06-03), fetched from
`origin/cursor/outside-container-writes-plan-b8a4`.
**Branch under audit:** `cursor/outside-container-writes-enabled-07e6` (PR5 tip, cumulative
of all 5 PRs). Diffs taken as `origin/develop...HEAD`.
**Scope:** audit only — no source code was modified.

> **Note on the spec branch name.** The task instructions reference branch
> `cursor/outside-container-writes-tech-spec-2d3c`, which does not exist on the remote.
> The spec file was located on `cursor/outside-container-writes-plan-b8a4` at
> `specs/2026-06-03-outside-container-writes/tech-spec.md` and is the document used here.

> **Note on a stated premise in the task.** The task's section C asks to verify that the
> registry lives on `ScriptRunContext._fragment_outside_wrappers`. The spec does **not** say
> that. The spec (section "Wrapper registry", lines 138–153) places the registry on
> `MemoryFragmentStorage` as `_outside_wrappers: dict[tuple[str, str], DeltaGenerator]`. The
> implementation follows the **spec** (FragmentStorage), not the task's premise. Details in
> Deviation D1.

---

## A. Spec coverage matrix

Spec subsections under "Proposal" + "Behavior Decisions", mapped to the task's section
numbering (1 Registry, 2 Detection, 3 Creation/retrieval, 4 Cursor reset, 5 `_enqueue`/`_block`
integration, 6 Fragment-ID stamping, 7 Frontend, + re-emission).

| Spec section | Implemented? | Location in code | Notes |
|---|---|---|---|
| **1. Wrapper Registry** (spec L138–153) | Yes (with deviation) | `lib/streamlit/runtime/fragment.py:231` (`_outside_wrappers` dict), accessor methods L362–402; protocol L172–206 | Stored on `MemoryFragmentStorage` per spec. Value type is `OutsideContainerWrapper` dataclass, not bare `DeltaGenerator` (D1). Key is `(fragment_id, dg._id)` per spec. |
| **2. Detection** (spec L89–137) | Yes (with deviation) | `lib/streamlit/delta_generator.py:753` (`_needs_outside_wrapper`) | Logic mirrors spec's `_is_outside_container_write`, **except** top-level handling: spec returns `False` for all top-level DGs; impl returns `True` for top-level SIDEBAR/BOTTOM (D2). Ancestor-walk scoped to current fragment's wrappers — matches spec. |
| **3. Wrapper creation/retrieval** (spec L179–202) | Yes | `lib/streamlit/delta_generator.py:785` (`_get_or_create_outside_wrapper`) | Transparent block + `allow_empty=True`; LockedCursor inherited when parent `is_locked`; parent cursor advanced exactly once; stores `creation_delta_path` + `block_proto`; raises on standalone rerun with no slot. Matches spec. |
| **4. Cursor reset on rerun** (spec L204–230) | Yes | `lib/streamlit/runtime/fragment.py:413` (`_reset_outside_wrappers`); `lib/streamlit/cursor.py:213` (`RunningCursor.reset`) | Resets `_index`, `_transient_index`, `_transient_elements` (all three spec fields). Re-emits before reset; skips reset for LockedCursor. Matches spec. |
| **5. Integration into `_enqueue`/`_block`** (spec L89–136) | Yes | `_enqueue`: `delta_generator.py:532`; `_block`: `delta_generator.py:626` | Both call detection+redirect after resolving `dg = self._active_dg`. Matches spec. |
| **6. Fragment-ID stamping** (spec L292–300, "Widget interactions trigger the writing fragment's rerun") | Yes (unchanged by design) | No code change required; existing `enqueue_message` stamping | Spec states stamping is thread-based, not delta-path-based, so the wrapper does not alter it. No code change present, which is consistent with the spec. |
| **7. Frontend (Transparent block)** (spec L155–177) | Yes (with deviation) | `proto/streamlit/proto/Block.proto:36,189`; `frontend/lib/src/components/core/Block/Block.tsx:290` | Proto field `transparent = 17` per spec. Frontend renders children directly via `ChildRenderer` with **no wrapping div**; spec says "renders as an unstyled div" (D3). |
| **Re-emission on rerun** (spec L204–230, L150–153) | Yes | `fragment.py:424–425` (`_enqueue_add_block` per wrapper); ordering at `fragment.py:496–502` | Re-emits `add_block` for every wrapper (incl. LockedCursor) before children, refreshing `scriptRunId` so `ClearStaleNodeVisitor` does not GC the wrapper. Matches spec. |

**Additional spec subsections (not in the task's 1–7 list):**

| Spec subsection | Implemented? | Location | Notes |
|---|---|---|---|
| Proto: Transparent type (spec L155–177) | Yes | `Block.proto:36,184–189` | `Transparent transparent = 17;`, Next ID → 18. |
| Interaction with `parallel=True` (spec L232–238) | Yes | `delta_generator.py:512–530` (guard retained); `_needs_outside_wrapper` returns `False` for `ts.is_parallel_worker` (`delta_generator.py:769`) | Parallel guard preserved; wrappers never created on a parallel worker. |
| Full app rerun clears registry (spec L261–263) | Yes | `script_runner.py:783` (`clear_outside_wrappers()` before `exec`) | Cleared at start of the full-run branch, before the main script body runs. Matches spec's "clear before, not after." |
| Dynamic container selection (spec L267–290) | Yes | `_get_or_create_outside_wrapper` raise path `delta_generator.py:805–813` | Standalone rerun with no reserved slot raises `StreamlitAPIException`; placeholder/`empty()` workaround documented in the `st.fragment` docstring (`fragment.py:651–656`). |

---

## B. Edge case coverage

| Edge case (spec) | Handled? | How | Test coverage |
|---|---|---|---|
| **Multiple fragments → same container** (spec L242–244) | Yes | Each `(fragment_id, dg._id)` gets a distinct wrapper at its own slot; each fragment resets only its own wrappers via `outside_wrappers_for`. | unit: `delta_generator_test.py::test_two_fragments_get_distinct_wrappers`; e2e: `test_two_fragments_write_into_same_outside_container` |
| **Nested containers** (spec L246–250) | Yes | `outer.container()` is redirected through the wrapper; subsequent writes are recognized as already-inside via the ancestor walk in `_needs_outside_wrapper`. | unit: `test_nested_container_produces_single_wrapper`, `test_dg_already_inside_wrapper_returns_false`; e2e: `test_fragment_nested_container_in_outside_container` |
| **`st.empty()` as outside container** (spec L252–259) | Yes | Wrapper inherits `LockedCursor(index=0)` when parent `is_locked`; reset skipped for locked cursors. | unit: `test_empty_outside_container_produces_locked_wrapper`, `fragment_test.py::test_locked_cursor_reemitted_but_not_reset`; e2e: `test_fragment_fills_empty_placeholder` |
| **Full app rerun** (spec L261–263) | Yes | `clear_outside_wrappers()` wipes the registry before the script re-executes; wrappers recreated fresh. | unit: `fragment_test.py::test_clear_outside_wrappers_drops_all_records`, `test_standalone_rerun_reuses_wrapper_after_full_run_clear` |
| **`st.rerun()` / standalone rerun without prior write** (spec L198–202, L267–280) | Yes | Raises `StreamlitAPIException` when `ctx.fragment_ids_this_run` is set and no cached wrapper exists. | unit: `test_fragment_only_rerun_without_prior_write_raises` |
| **`parallel=True`** (spec L232–238) | Yes | Detection short-circuits for parallel workers; `_enqueue` guard still raises for outside writes during initial load. | unit: `test_parallel_worker_needs_no_wrapper`, `delta_generator_test.py::test_parallel_worker_writing_directly_to_sidebar_raises` |
| **Dynamic container selection** (spec L267–290) | Yes | Wrappers keyed by container identity; unused slots cleared by `ClearStaleNodeVisitor`, stay invisible via `allow_empty=True`. | unit: covered by raise test + `allow_empty` set in `_get_or_create_outside_wrapper`; e2e: empty-placeholder test |
| **Parent fragment rerun recreates the container** (spec L194–196, implied) | Yes (impl-added mechanism) | `evict_outside_wrappers_created_by(fragment_id)` runs before reset in `wrapped_fragment`; `creating_fragment_id` tracked on each DG. | unit: `fragment_test.py::test_parent_rerun_evicts_nested_wrapper_but_standalone_survives`, `test_evict_outside_wrappers_created_by_filters_on_creating_fragment` — see Gap G1 (spec under-specifies this). |

---

## C. Deviations from the spec

### D1 — Registry value type and storage location
- **Spec says** (L144–147): "On `MemoryFragmentStorage`: `_outside_wrappers: dict[tuple[str, str], DeltaGenerator]`" and (L186–189) "The creation delta path and block proto are stored **on the wrapper**." The reset pseudocode (L210–221) accesses `wrapper._creation_delta_path`, `wrapper._block_proto`, `wrapper._cursor` directly on the DG.
- **What the code does:** Registry lives on `MemoryFragmentStorage._outside_wrappers`
  (`fragment.py:231`) but the value type is a dedicated `OutsideContainerWrapper` dataclass
  (`lib/streamlit/runtime/outside_container_wrapper.py:25`) holding `delta_generator`,
  `creation_delta_path`, `block_proto`, and `creating_fragment_id` — rather than storing
  `creation_delta_path`/`block_proto` as private attributes on the `DeltaGenerator`.
- **Assessment:** Reasonable implementation choice. Keeping re-emission metadata in a small
  dataclass avoids polluting `DeltaGenerator` with wrapper-only private fields and is cleaner.
  The storage *location* (FragmentStorage) matches the spec. The task's premise that the spec
  uses `ScriptRunContext._fragment_outside_wrappers` is incorrect — neither spec nor code uses
  that; both use FragmentStorage. **No bug.**
- **Severity:** Cosmetic (spec text could be updated to mention the dataclass).

### D2 — Top-level SIDEBAR/BOTTOM containers ARE wrapped (spec says they must not be)
- **Spec says** (L101–106): "Root-container DGs (`st.sidebar`, `st._main`) have their cursors
  managed by `ctx.cursors`, which is already snapshot/restored by `wrapped_fragment()`. These
  **must not be wrapped** — doing so would conflict with the existing cursor restore
  mechanism. `if dg._is_top_level: return False`."
- **What the code does** (`delta_generator.py:769–770`):
  ```python
  if dg._is_top_level:
      return dg._root_container in {RootContainer.SIDEBAR, RootContainer.BOTTOM}
  ```
  i.e. top-level SIDEBAR and BOTTOM writes **are** redirected through a wrapper. This is the
  deliberate PR5 expansion: the old `_writes_directly_to_sidebar` guard (which raised for
  `st.sidebar` in a fragment) was removed (`delta_generator.py`, deleted L130–134 and the
  `_enqueue` raise), and the public docstring now advertises writing "directly to
  `st.sidebar` or `st.bottom`" (`fragment.py:646–651`).
- **Why it works despite the spec's concern:** The wrapper is created only when the
  container's creating scope runs (full app run), advancing the sidebar/bottom root cursor
  exactly once. On a standalone fragment rerun, the cached wrapper is returned directly
  (`_get_or_create_outside_wrapper` early return) and the root cursor is never touched, so the
  `ctx.cursors` snapshot/restore in `wrapped_fragment()` does not conflict. The spec's stated
  rationale for excluding top-level containers is therefore **outdated** for the final design.
- **Assessment:** Intentional scope expansion beyond the spec, validated by tests. The spec
  text directly contradicts the shipped behavior and should be updated. Functionally sound.
- **Severity:** Important (spec update needed; behavior is broader than the reviewed design).
- **Evidence of intent / coverage:** unit `test_sidebar_root_returns_true`,
  `test_bottom_root_returns_true`, `test_main_root_returns_false`, `test_event_root_returns_false`;
  e2e `test_fragment_writes_into_sidebar`, `test_fragment_writes_into_bottom_container`.

### D3 — Transparent block renders no DOM node (spec says "unstyled div")
- **Spec says** (L174–177): "The frontend renders a `Transparent` block as an **unstyled div**
  — identical to how it renders an untyped block today, but with an explicit type to match on."
- **What the code does** (`Block.tsx:290–298`): returns `<ChildRenderer .../>` directly when
  `node.deltaBlock.transparent` is set, emitting **no wrapper div at all** — children become
  direct flex items of the outside container. The proto comment was also revised to say
  "Renders as a plain unstyled grouping with **no DOM node of its own**" (`Block.proto:184–187`),
  which itself contradicts the spec's "div" wording.
- **Assessment:** Reasonable — arguably better — implementation choice. Rendering no DOM node
  is strictly more "layout-transparent" than an unstyled div and avoids an extra nesting level
  in flex/grid layouts. The "Cons: Extra DOM div per (fragment, container) pair" line in
  Alternatives (spec L307) no longer applies. Spec wording should be updated.
- **Severity:** Minor (spec/proto wording vs. behavior; visually verified by the snapshot test
  `test_outside_container_transparent_wrapper`).

### D4 — Helper named `_enqueue_add_block`, not `enqueue_add_block`
- **Spec says** (L214): `enqueue_add_block(wrapper._creation_delta_path, wrapper._block_proto)`.
- **What the code does:** module-private `_enqueue_add_block(delta_path, block_proto)`
  (`delta_generator.py:758`), imported lazily into `fragment.py`.
- **Assessment:** Naming detail; the `_` prefix is correct per the repo's Python guidelines for
  module-private symbols. **No bug.**
- **Severity:** Cosmetic.

### D5 — Detection signature differs from spec pseudocode
- **Spec says** (L96): `def _is_outside_container_write(dg)` reading `ThreadState.get()` and a
  module-level `fragment_storage` internally.
- **What the code does:** `_needs_outside_wrapper(dg, ts, fragment_storage)`
  (`delta_generator.py:753`) takes `ts` and `fragment_storage` as explicit parameters; the
  redirect guard is `if ts.fragment_id and _needs_outside_wrapper(...)`.
- **Assessment:** Functionally equivalent; explicit parameters are cleaner and testable. Also
  adds an explicit `ts.is_parallel_worker` short-circuit (spec relied on the separate
  `_enqueue` guard only). **No bug.**
- **Severity:** Cosmetic.

---

## D. Gaps

### G1 — Per-fragment wrapper eviction (`creating_fragment_id`) is unspecified
The spec describes only two registry lifecycle operations: `clear()` on full app rerun (whole
registry) and cursor reset on fragment rerun. It mentions in passing (L194–196) that a wrapper
is recreated "during a parent fragment rerun that recreates the container," but never describes
*how* the stale wrapper is removed. The implementation adds an entire mechanism the spec omits:
- `DeltaGenerator._creating_fragment_id` (`delta_generator.py:324`), propagated in `_block`
  (`delta_generator.py:660`) and `__deepcopy__`/`_with_*` paths (`delta_generator.py:419`);
- `OutsideContainerWrapper.creating_fragment_id`;
- `FragmentStorage.evict_outside_wrappers_created_by` + the `_remove(..., evict_wrappers=...)`
  bookkeeping (`fragment.py:250–280`);
- the eviction-before-reset ordering in `wrapped_fragment` (`fragment.py:496–502`).

This is a real functional addition (correctly handling nested-fragment lifecycles), not just
plumbing. **Gap: implementation has design surface with no spec coverage.** It is well tested
(`test_parent_rerun_evicts_nested_wrapper_but_standalone_survives`,
`test_remove_drops_removed_fragments_own_wrappers`, `test_clear_retains_outside_wrappers`).
**Recommendation:** add a spec subsection documenting eviction semantics. Severity: Important.

### G2 — `delta_path=None` scoping fix is unspecified
PR4 changed `wrapped_fragment` to enter `ThreadState.scoped(fragment_id=fragment_id,
delta_path=None)` (`fragment.py:527–531`) so the fragment doesn't inherit the parent scope's
delta path before its own container is established. The spec never mentions this. It is a
correctness prerequisite for detection (`_needs_outside_wrapper` relies on `ts.delta_path`).
**Gap:** spec under-specifies the `ThreadState` lifecycle. Severity: Minor (supporting fix).

### G3 — `check_fragment_path_policy` is now dead code
PR5 removed the only caller of `check_fragment_path_policy` from `check_widget_policies`
(`policies.py:178`). The function itself still exists (`policies.py:131`) and is referenced
only by `element_policies_test.py`. The spec implies the widget restriction is *lifted* (so a
fragment can render widgets to outside containers), which the removal accomplishes, but it
leaves an orphaned function. **Gap:** dead code not cleaned up. Severity: Minor (cleanup;
out of scope for an audit-only deliverable but worth flagging).

### G4 — No spec-side mention that detection also runs in `_block` for nested wrappers
The spec's section 5 says to add detection to both `_enqueue` and `_block`, which is done.
This is covered, noted here only for completeness — **no gap**.

---

## E. Test coverage assessment

The spec does not contain an explicit "Test Plan" section (no such heading exists in
`tech-spec.md`). Assessment is therefore against the design sections and edge cases.

**Unit tests** (`delta_generator_test.py`, `fragment_test.py`, `cursor_test.py`,
`element_policies_test.py`):

| Design area | Unit coverage |
|---|---|
| Detection (`_needs_outside_wrapper`) | `NeedsOutsideWrapperTest` (8 cases: no fragment id, no delta path, sidebar/bottom/main/event roots, inside-own-container, already-inside-wrapper, outside-scope) — thorough |
| Wrapper creation | `OutsideWrapperCreationTest` (transparent block emitted, single wrapper, nested→single, two fragments→distinct, raise on no-slot, locked for empty, bottom records no creating fragment, parallel needs none) — thorough |
| `creating_fragment_id` stamping | `ContainerCreatingFragmentIdTest` (main→None, stamped with fragment, wrapper records it) |
| Block delta-path correctness | `BlockCreationDeltaPathTest` (container/nested paths) — regression guard for the snapshot-before-advance change |
| Registry methods | `fragment_test.py` register/get/missing/isolation/clear-retains/clear-drops/evict/remove |
| Cursor reset + re-emission | `ResetOutsideWrappersTest` (re-emit+reset running cursor, locked re-emit-no-reset, repeated reruns keep paths stable, eviction-before-reset, parent vs standalone) |
| `RunningCursor.reset` | `cursor_test.py::test_reset_returns_to_initial_position` |
| Sidebar redirect + parallel raise | `delta_generator_test.py::test_fragment_writing_directly_to_sidebar_is_redirected_to_wrapper`, `test_parallel_worker_writing_directly_to_sidebar_raises` |
| Widget policy lift | `element_policies_test.py` updated to `assert_not_called()` |
| End-to-end write paths | `FragmentWritesToOutsidePathTest` (writes for all element types succeed; standalone rerun reuses wrapper after full-run clear) |

**E2E tests** (`st_fragment_basics.py` + `st_fragment_basics_test.py`):
interleaved main+fragment, two fragments→same container, sidebar (with-block + direct), bottom,
`empty()` placeholder, nested container, and a snapshot test
(`test_outside_container_transparent_wrapper`) verifying no extra border/padding.

**Coverage verdict:** Every spec design section and every spec edge case has at least one unit
test, and the user-facing scenarios each have an e2e test. The transparent-wrapper visual
contract (D3) is pinned by a snapshot test. Coverage is strong.

**Minor coverage observations:**
- The spec's "Widget interactions trigger the writing fragment's rerun" claim (fragment-scoped
  rerun, not full-app) is exercised implicitly by the e2e reruns (each clicks a button inside
  the fragment and asserts only the fragment content changed) but there is no explicit assertion
  that a *full app rerun did not occur* (e.g. that a main-script `uuid4()` outside the fragment
  is unchanged). The existing `expect_only_fragment_uuid_changed` helper covers this concept for
  the original in-body fragment, but not for the new outside-container scenarios specifically.
- No e2e test asserts the `StreamlitAPIException` user-facing message for a dynamic-selection
  violation; it is unit-tested only (`test_fragment_only_rerun_without_prior_write_raises`).

---

## F. Summary and recommendations

**Overall alignment: mostly aligned (strong).** All seven design areas, the re-emission
mechanism, and every edge case are implemented and tested. The implementation closely tracks
the spec's wrapper-registry architecture, detection logic, cursor-reset semantics, and proto
design. The deviations are largely deliberate improvements or scope expansions rather than
defects; there are no correctness bugs identified.

**Top 3 findings:**
1. **(D2, Important)** Top-level `st.sidebar`/`st.bottom` writes are now wrapped and supported,
   directly contradicting the spec's "top-level DGs must not be wrapped" rule (spec L101–106).
   This is an intentional PR5 expansion (sidebar guard removed, docstring updated) and works
   because the root cursor is advanced only at creation time, but the spec's rationale is now
   stale and must be corrected to match shipped behavior.
2. **(G1, Important)** The per-fragment eviction mechanism (`creating_fragment_id`,
   `evict_outside_wrappers_created_by`, eviction-before-reset ordering) is a substantive piece
   of the design with **no spec coverage**, despite being necessary for correct nested-fragment
   lifecycles.
3. **(D3, Minor)** The Transparent block renders **no DOM node**, not the "unstyled div" the
   spec describes — a better outcome, but the spec and the proto comment disagree with each
   other and with prose elsewhere in the spec.

**Recommended actions:**
- *Spec updates:* (a) rewrite the detection section to allow top-level SIDEBAR/BOTTOM and
  explain why the `ctx.cursors` conflict does not arise (D2); (b) add a subsection on
  per-fragment eviction and `creating_fragment_id` (G1); (c) correct the Transparent-block
  rendering description from "unstyled div" to "no DOM node / children rendered directly" and
  drop the now-moot "extra DOM div" con (D3); (d) document the `delta_path=None` scoping fix
  (G2); (e) note the registry value is an `OutsideContainerWrapper` dataclass (D1).
- *Code cleanup (separate PR, out of audit scope):* remove the now-dead
  `check_fragment_path_policy` function and its test references (G3).
- *Additional tests (nice-to-have):* an e2e assertion that an outside-container fragment rerun
  leaves a main-script-only marker unchanged (confirms fragment-scoped, not full-app, rerun);
  and an e2e assertion of the dynamic-selection `StreamlitAPIException` surfacing to the user.
