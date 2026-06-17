# Spec Alignment Audit: Outside Container Writes for Fragments

**Audit target:** the 5-PR implementation stack for "outside container writes."
**Spec audited against:** `specs/2026-06-03-outside-container-writes/tech-spec.md` as it appears
in **PR #15413** (`https://github.com/streamlit/streamlit/pull/15413`), branch
`cursor/outside-container-writes-tech-spec-2d3c`, 493 lines. This is the authoritative design
document.
**Branch under audit:** `cursor/outside-container-writes-enabled-07e6` (PR5 tip, cumulative of
all 5 PRs). Diffs taken as `origin/develop...HEAD`.
**Scope:** audit only — no source code was modified.

> **Correction note (spec source).** An earlier pass of this audit mistakenly used a shorter
> 331-line copy of the spec found on `origin/cursor/outside-container-writes-plan-b8a4`. That
> older copy **omits** the `st.sidebar`/`st.bottom` wrapping design, the "no DOM node"
> transparent-block rendering, the registry eviction lifecycle, and the testing plan. The
> authoritative spec in PR #15413 covers all of these. This report has been rewritten against
> the PR #15413 spec. Several items previously flagged as deviations/gaps (sidebar/bottom
> wrapping, no-DOM transparent block, the eviction mechanism) are in fact **exact matches** to
> the authoritative spec and are recorded as such below.

Line references prefixed `spec L…` are into the PR #15413 spec; code references are `file:line`
on the audited branch.

---

## A. Spec coverage matrix

Rows follow the authoritative spec's "Proposal" + "Behavior Decisions" structure, mapped to the
task's section numbering (1 Registry, 2 Detection, 3 Creation/retrieval, 4 Cursor reset,
5 `_enqueue`/`_block` integration, 6 Fragment-ID stamping, 7 Frontend, + re-emission).

| Spec section | Implemented? | Location in code | Notes |
|---|---|---|---|
| **1. Wrapper registry** (spec L205–254) | Yes | `fragment.py:231` (`_outside_wrappers: dict[tuple[str,str], OutsideContainerWrapper]`); accessors L365–406; protocol L172–206; dataclass `outside_container_wrapper.py:25` | On `MemoryFragmentStorage` per spec L210–211. Value bundles the wrapper DG + `creating_fragment_id` (+ `creation_delta_path`, `block_proto`) — matches spec L211–214. Key `(fragment_id, dg._id)` per spec L216. |
| **2. Detection** (spec L118–203) | Yes | `delta_generator.py:761` (`_needs_outside_wrapper`) | Logic mirrors the spec pseudocode exactly, including the top-level branch returning `dg._root_container in {SIDEBAR, BOTTOM}` (spec L132–140) and the fragment-scoped ancestor walk (spec L146–160, L192–203). |
| **3. Wrapper creation/retrieval** (spec L256–286) | Yes | `delta_generator.py:793` (`_get_or_create_outside_wrapper`) | Transparent block + `allow_empty=True`; cursor type inherited from parent (`LockedCursor` when `is_locked`); parent cursor advanced exactly once at creation; `creation_delta_path` + `block_proto` stored for re-emission; raises on standalone rerun with no slot. Matches spec. |
| **4. Cursor reset on rerun** (spec L316–353) | Yes | evict: `fragment.py:500` (`evict_outside_wrappers_created_by`); reset: `fragment.py:413` (`_reset_outside_wrappers`); `cursor.py:213` (`RunningCursor.reset`) | Eviction runs before reset (spec L318–327, L351). Reset re-emits every wrapper then zeros `_index`/`_transient_index`/`_transient_elements` (all three spec fields, L341–343), skipping locked cursors. Matches spec. |
| **5. Integration into `_enqueue`/`_block`** (spec L120, L260–263) | Yes | `_enqueue`: `delta_generator.py:532`; `_block`: `delta_generator.py:626` | Both call detect+redirect after resolving `dg = self._active_dg`. Matches spec. |
| **6. Fragment-ID stamping** (spec L419–430) | Yes (no change needed) | Existing `enqueue_message` stamping; no code change | Spec states stamping is thread-based and container-agnostic, so the wrapper doesn't alter it. Absence of a code change is correct. |
| **7. Frontend (Transparent block)** (spec L288–314) | Yes | `Block.proto:36,184–189`; `Block.tsx:290–298` | Proto `transparent = 17`, Next ID → 18; proto comment matches spec L300–305 verbatim. Frontend renders children directly via `ChildRenderer` with **no DOM node** — matches spec L309–314. |
| **Re-emission on rerun** (spec L329–353, L250–254) | Yes | `fragment.py:424–425`; ordering at `fragment.py:496–502` | Re-emits `add_block` for every wrapper (incl. locked) before children, refreshing `scriptRunId` so `ClearStaleNodeVisitor` does not GC the wrapper. Matches spec. |

**Additional authoritative-spec subsections:**

| Spec subsection | Implemented? | Location | Notes |
|---|---|---|---|
| Writes to root containers (spec L163–190) | Yes | `delta_generator.py:769–770`; tests `test_sidebar_root_returns_true`, `test_bottom_root_returns_true` | SIDEBAR/BOTTOM wrapped; MAIN/EVENT not. Stable `_id` keying means repeated direct writes reuse one wrapper. |
| EVENT root excluded (spec L384–389) | Yes | top-level branch excludes EVENT | unit `test_event_root_returns_false` |
| Registry lifecycle / eviction (spec L228–254) | Yes (with one mechanism deviation) | `_remove(evict_wrappers=…)` `fragment.py:253`; `evict_outside_wrappers_created_by` `fragment.py:398`; `clear_outside_wrappers` `fragment.py:407` | Per-fragment-rerun and per-removal eviction match; full-app flush uses a dedicated method instead of extending `clear()` (Deviation DEV-1). |
| Interaction with `parallel=True` (spec L355–361) | Yes | `delta_generator.py:512–530` (guard retained); `_needs_outside_wrapper` returns `False` for parallel workers (`delta_generator.py:769`) | Matches. |
| Dynamic container selection (spec L393–417) | Yes | raise path `delta_generator.py:805–813`; docstring `fragment.py:651–656` | Standalone rerun with no reserved slot raises `StreamlitAPIException`; placeholder workaround documented. |

---

## B. Edge case coverage

| Edge case (spec) | Handled? | How | Test coverage |
|---|---|---|---|
| **Multiple fragments → same container** (spec L365–367) | Yes | Each `(fragment_id, dg._id)` gets a distinct wrapper slot; each fragment resets only its own. | unit `test_two_fragments_get_distinct_wrappers`; e2e `test_two_fragments_write_into_same_outside_container` |
| **Nested containers** (spec L369–373) | Yes | `outer.container()` redirected through the wrapper; later writes recognized via the ancestor walk. | unit `test_nested_container_produces_single_wrapper`, `test_dg_already_inside_wrapper_returns_false`; e2e `test_fragment_nested_container_in_outside_container` |
| **`st.empty()` as outside container** (spec L375–382) | Yes | Wrapper inherits `LockedCursor(index=0)`; reset skipped for locked. | unit `test_empty_outside_container_produces_locked_wrapper`, `test_locked_cursor_reemitted_but_not_reset`; e2e `test_fragment_fills_empty_placeholder` |
| **`EVENT` root needs no wrapper** (spec L384–389) | Yes | Detection excludes EVENT root. | unit `test_event_root_returns_false` |
| **Full app rerun** (spec L232–235) | Yes | `clear_outside_wrappers()` wipes the registry before the script body re-executes. | unit `test_clear_outside_wrappers_drops_all_records`, `test_standalone_rerun_reuses_wrapper_after_full_run_clear` |
| **Fragment rerun recreates own containers** (spec L236–248) | Yes | `evict_outside_wrappers_created_by(fragment_id)` before reset; `creating_fragment_id` tracked per DG. | unit `test_parent_rerun_evicts_nested_wrapper_but_standalone_survives`, `test_evict_outside_wrappers_created_by_filters_on_creating_fragment` |
| **Fragment removed** (spec L238–244) | Yes | `_remove(evict_wrappers=True)` drops entries written by the removed fragment; routed via `clear_stale_descendants`/`delete`. | unit `test_remove_drops_removed_fragments_own_wrappers` |
| **Standalone rerun without prior write** (spec L279–281, L405–406) | Yes | Raises `StreamlitAPIException`. | unit `test_fragment_only_rerun_without_prior_write_raises` |
| **`parallel=True`** (spec L355–361) | Yes | Detection short-circuits; `_enqueue` guard still raises during initial load. | unit `test_parallel_worker_needs_no_wrapper`, `test_parallel_worker_writing_directly_to_sidebar_raises` |

---

## C. Deviations from the spec

After re-auditing against the PR #15413 spec, no behavioral deviations of consequence remain.
The following are mechanism/naming differences.

### DEV-1 — Full-app-rerun flush uses a dedicated method, not an extended `clear()`
- **Spec says** (L232–235): "**Full app rerun:** `clear()` empties the whole registry. The
  existing `MemoryFragmentStorage.clear()` clears only the fragment maps today, so it must be
  extended to also flush `_outside_wrappers` …" and (L242–244) frames `_remove` as "the single
  chokepoint for all removals."
- **What the code does:** `clear()` explicitly **opts out** of wrapper eviction —
  `_remove(fragment_id, evict_wrappers=False)` (`fragment.py:271`). The whole-registry flush is a
  separate method, `clear_outside_wrappers()` (`fragment.py:407`), invoked from
  `script_runner.py:783` immediately before `exec(code, …)` on a full run. Per-fragment removals
  (`clear_stale_descendants`, `delete`) still route through `_remove(evict_wrappers=True)`, which
  matches the spec's chokepoint intent for *those* paths.
- **Assessment:** Reasonable implementation choice; arguably more correct. `clear()` is invoked
  with `new_fragment_ids` and would only remove fragments *absent* from that set, so "extend
  `clear()` to flush" would not reliably empty the *whole* registry (retained fragments would
  keep wrappers). The dedicated method clears unconditionally at a precisely chosen point (start
  of the full run, before the script recreates containers), which the spec itself emphasizes is
  the correct timing. Intent preserved; mechanism differs.
- **Severity:** Minor (update spec to describe the dedicated method).
- **Coverage:** `test_clear_retains_outside_wrappers` (clear keeps wrappers),
  `test_clear_outside_wrappers_drops_all_records` (dedicated flush empties all).

### DEV-2 — Registry accessor naming / encapsulation
- **Spec says:** `outside_wrapper_values_for` (L154), `outside_wrappers_for` returning
  `(key, wrapper)` pairs (L334), `outside_wrapper_keys_created_by` (L325), and direct
  `del fragment_storage._outside_wrappers[key]` in `_evict_outside_wrappers` (L326).
- **What the code does:** `outside_wrappers_for(fragment_id) -> list[OutsideContainerWrapper]`
  (single accessor, returns values not pairs), plus encapsulated `register_outside_wrapper`,
  `get_outside_wrapper`, `evict_outside_wrappers_created_by`, `clear_outside_wrappers`
  (`fragment.py:365–407`). Eviction is a storage method rather than direct dict mutation by the
  caller.
- **Assessment:** Functionally equivalent and cleaner (storage owns its dict). No bug.
- **Severity:** Cosmetic.

### DEV-3 — Helper signatures and field-reset factoring
- **Spec says:** `enqueue_add_block(...)` (L337); `_needs_outside_wrapper(dg)` reading
  `ThreadState.get()` internally (L127); inline `wrapper._cursor._index = 0` etc. (L341–343).
- **What the code does:** module-private `_enqueue_add_block` (`delta_generator.py:758`);
  `_needs_outside_wrapper(dg, ts, fragment_storage)` with explicit params + an added
  `ts.is_parallel_worker` short-circuit (`delta_generator.py:769`); cursor reset factored into
  `RunningCursor.reset()` (`cursor.py:213`) and gated by `isinstance(..., RunningCursor)` rather
  than `is_locked`.
- **Assessment:** Equivalent; the `_` prefix and explicit params follow repo conventions. No bug.
- **Severity:** Cosmetic.

### DEV-4 — Re-emission metadata stored in the dataclass, not on the DG
- **Spec says** (L286): "Its creation delta path and block proto are stored **on the wrapper**
  for re-emission on rerun," and the reset pseudocode accesses `wrapper._creation_delta_path` /
  `wrapper._block_proto`.
- **What the code does:** stores `creation_delta_path` and `block_proto` as fields of the
  `OutsideContainerWrapper` dataclass (`outside_container_wrapper.py:43–46`) rather than as
  private attributes on the `DeltaGenerator`.
- **Assessment:** Reasonable — keeps wrapper-only bookkeeping out of `DeltaGenerator`. The spec
  (L211–214) already describes an `OutsideWrapper` bundle, so this is consistent with the spec's
  own registry design. No bug.
- **Severity:** Cosmetic.

---

## D. Gaps

### G1 — Testing plan: variable-element-count SIDEBAR/BOTTOM tests are missing
- **Spec says** (L432–449): add variable-element-count tests for the roots a fragment writes to
  directly — a fragment whose "direct-sidebar element count varies across reruns (e.g. 3 → 5 →
  2)", asserting **(a)** shrink (5 → 2) leaves no stale fragment elements and **(b)** growth
  (3 → 5) does not overwrite the trailing non-fragment footer. Mirror for BOTTOM. "These cases
  specifically guard the interleaving/overwrite failure mode."
- **What the code does:** the e2e tests `test_fragment_writes_into_sidebar` and
  `test_fragment_writes_into_bottom_container` use **fixed** element counts (the sidebar fragment
  always writes 2 markdowns, the bottom fragment always 1). They verify in-place update and that
  the header/footer keep their slots, but never grow or shrink the fragment's element count, so
  the specific shrink/growth invariant the spec singles out as the key regression guard is
  **not exercised**. The unit test `test_repeated_reruns_keep_delta_paths_stable`
  (`fragment_test.py:604`) checks cursor-reset stability but uses a constant count of 3 each run.
- **Assessment:** This is the most material gap: the implementation appears correct, but the
  explicit regression guard for the interleaving/overwrite failure mode (variable count not
  overwriting trailing neighbors) is untested at the e2e level for SIDEBAR/BOTTOM.
- **Severity:** Important (add the variable-count tests called for by the spec).

### G2 — `delta_path=None` scoping change is unspecified
`wrapped_fragment` now enters `ThreadState.scoped(fragment_id=fragment_id, delta_path=None)`
(`fragment.py:527–531`) so the fragment does not inherit the parent scope's delta path before its
own container is established — a correctness prerequisite for `_needs_outside_wrapper`, which
reads `ts.delta_path`. The spec never mentions this `ThreadState` lifecycle detail.
- **Severity:** Minor (supporting fix; spec could note it).

### G3 — `check_fragment_path_policy` is now dead code
The spec's premise (L15–21) is that the old widget restriction
(`StreamlitFragmentWidgetsNotAllowedOutsideError`) and the direct-sidebar `StreamlitAPIException`
are *lifted*. PR5 removes the `check_fragment_path_policy(dg)` call from `check_widget_policies`
(`policies.py:178`) and the `_writes_directly_to_sidebar` guard from `_enqueue`, which achieves
this. But `check_fragment_path_policy` itself still exists (`policies.py:131`) with no remaining
caller (only `element_policies_test.py` references it). The lifting is functionally complete; the
orphaned function/tests are leftover.
- **Severity:** Minor (cleanup; out of scope for an audit-only deliverable, flagged for a
  follow-up).

No spec-described behavior is missing from the implementation; G1 is a test-coverage gap, G2/G3
are minor.

---

## E. Test coverage assessment

The authoritative spec **does** include a "Testing plan" (L432–461). Assessment is against it
plus the design sections and edge cases.

**Spec testing-plan items vs. implementation:**

| Spec test-plan item (L432–461) | Covered? | Where |
|---|---|---|
| SIDEBAR, variable count 3→5→2: shrink leaves no stale; growth doesn't overwrite footer | **No** (fixed count only) | e2e `test_fragment_writes_into_sidebar` verifies in-place update + footer slot, but count is fixed — see G1 |
| BOTTOM, mirror of SIDEBAR shrink/growth | **No** (fixed count only) | e2e `test_fragment_writes_into_bottom_container` — see G1 |
| Parent-fragment recreation lifecycle (rebuild `c`, one wrapper for `(F,c)`, no stale node; then `F` standalone rerun reuses) | **Yes** | unit `test_parent_rerun_evicts_nested_wrapper_but_standalone_survives` |

**Design-section coverage (strong):**

| Design area | Coverage |
|---|---|
| Detection `_needs_outside_wrapper` | `NeedsOutsideWrapperTest` (no fragment id, no delta path, sidebar/bottom/main/event roots, inside-own-container, already-inside-wrapper, outside-scope) |
| Wrapper creation | `OutsideWrapperCreationTest` (transparent block emitted, single wrapper, nested→single, two fragments→distinct, raise on no-slot, locked for empty, bottom records no creating fragment, parallel needs none) |
| `creating_fragment_id` stamping | `ContainerCreatingFragmentIdTest` |
| Block delta-path correctness | `BlockCreationDeltaPathTest` (snapshot-before-advance regression guard) |
| Registry + eviction lifecycle | `fragment_test.py`: register/get/missing/isolation, clear-retains vs clear-flush, evict-by-creating-fragment, remove-drops-own |
| Cursor reset + re-emission | `ResetOutsideWrappersTest` (re-emit+reset, locked re-emit-no-reset, repeated-reruns stable, eviction-before-reset, parent vs standalone) |
| `RunningCursor.reset` | `cursor_test.py::test_reset_returns_to_initial_position` |
| Widget-policy lift | `element_policies_test.py` (`assert_not_called`) |
| All element types write through | `FragmentWritesToOutsidePathTest::test_write_element_outside_container_succeeds_for_all` |
| Frontend transparent rendering | `Block.test.tsx` (+52 lines); e2e snapshot `test_outside_container_transparent_wrapper` (no border/padding) |

**Other coverage observations:**
- The dynamic-selection `StreamlitAPIException` is unit-tested
  (`test_fragment_only_rerun_without_prior_write_raises`) but has no e2e assertion of the
  user-facing message.
- The "widget interaction triggers the *writing fragment's* rerun, not a full app rerun" claim
  (spec L419–430) is exercised implicitly (e2e reruns click an in-fragment button and assert only
  fragment content changed) but there is no explicit assertion that a main-script-only marker
  outside the fragment stayed unchanged during these outside-container reruns.

---

## F. Summary and recommendations

**Overall alignment: strongly aligned.** Audited against the authoritative PR #15413 spec, the
implementation faithfully realizes every design section: the wrapper-registry architecture and
lifecycle, the `_needs_outside_wrapper` detection (including the explicit SIDEBAR/BOTTOM
root-wrapping branch and EVENT exclusion), wrapper creation with cursor-type inheritance, the
evict-then-reset rerun sequence, the `Transparent` proto block with no-DOM-node rendering, and the
`parallel=True` and dynamic-selection behaviors. No behavioral deviations of consequence were
found; the differences are mechanism/naming choices that preserve the spec's intent. The earlier
audit's "Important" deviations were artifacts of using a stale spec copy and do not hold against
the authoritative spec.

**Top 3 findings:**
1. **(G1, Important)** The spec's testing plan explicitly calls for variable-element-count
   (3 → 5 → 2) SIDEBAR and BOTTOM tests to guard the interleaving/overwrite failure mode; the
   shipped e2e tests use fixed counts, so this specific regression guard is untested.
2. **(DEV-1, Minor)** Full-app-rerun registry flush is implemented via a dedicated
   `clear_outside_wrappers()` called from `script_runner` (with `clear()` explicitly opting out),
   rather than the spec's "extend `clear()`" wording. Functionally correct and better-timed; the
   spec text should be updated to match.
3. **(G3, Minor)** `check_fragment_path_policy` is now dead code after its only caller was
   removed; the widget/sidebar restriction lift is otherwise complete.

**Recommended actions:**
- *Tests:* add the variable-element-count SIDEBAR/BOTTOM e2e tests from the spec's testing plan
  (shrink leaves no stale elements; growth does not overwrite the trailing footer) (G1); optional:
  an e2e assertion that an outside-container fragment rerun leaves a main-script-only marker
  unchanged, and one asserting the dynamic-selection exception surfaces (E).
- *Spec updates (minor):* describe the dedicated `clear_outside_wrappers()` flush and `clear()`'s
  opt-out (DEV-1); note the `delta_path=None` fragment-scope reset (G2); align accessor names with
  the implemented API (DEV-2); note re-emission metadata lives on the `OutsideContainerWrapper`
  dataclass (DEV-4).
- *Code cleanup (separate PR, out of audit scope):* remove the now-dead `check_fragment_path_policy`
  and its test references (G3).
