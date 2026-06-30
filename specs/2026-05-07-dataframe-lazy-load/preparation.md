# Lazy `st.dataframe` — Preparation / refactoring PRs

This document proposes refactors that can be **merged independently before** the
full lazy-loading PR. It is written after building the end-to-end prototype on
branch `lukasmasuch/cuzco` (draft PR #15756), so each suggestion reflects what
actually had to change and where the integration was awkward.

The goal of splitting is to shrink the lazy-loading PR into a small,
behavior-preserving core, and to land the higher-risk plumbing in isolated,
independently-reviewable, fully-tested chunks that are **dormant** (no
user-visible behavior change) until the final PR turns lazy mode on.

## How the prototype is structured (for reference)

The prototype adds, in one PR:

- **Proto**: `LazyDataframe` + `SortState` (`Dataframe.proto`), and
  `DataframeChunkRequestPayload` / `DataframeChunkResponsePayload` on the
  existing `BackendOperationRequest` / `BackendOperationResponse`.
- **Backend**: `lib/streamlit/dataframe/{source,adapters}.py` (source protocol +
  in-memory + native adapters), `runtime/dataframe_source_manager.py`,
  `runtime/dataframe_chunk_handler.py`, lifecycle wiring in `runtime.py` /
  `app_session.py` / `scriptrunner/script_runner.py`, and the `lazy` param +
  resolution in `elements/arrow.py`.
- **Frontend**: `LazyDataframeCache.ts`, `hooks/useLazyDataLoader.ts`,
  `hooks/useLazyColumnSort.ts`, `BackendOperationClient.requestDataframeChunk`,
  `useDataFrameCapabilities` lazy flags, and `DataFrame.tsx` integration.

Most of these pieces are decoupled enough to land separately.

## Already in place (no prep needed)

These were prerequisites the tech spec called out; they already exist on
`develop`, so the prototype builds on them directly:

- **Generic backend-operation transport** (PR #15147):
  `BackendOperationRequest`/`Response`, `BackendOperationDispatcher`,
  `DeferredFileHandler`, the `BackendOperationClient`, and
  `BackendOperationContext`. Lazy chunk loading just adds a new payload type to
  this — no new transport.
- **Component-owned Arrow/Quiver construction**: `DataFrame.tsx` already builds
  its own `new Quiver(element.arrowData)` (no Quiver construction in
  `render-tree/ElementNode.ts`). The lazy initial-chunk Quiver slots into the
  same `useMemo`.

---

## Recommended preparation PRs

Ordered roughly from smallest/lowest-risk to largest. Dependencies are noted.

### Prep 1 — Gate the dataframe search shortcut on `canSearch` (frontend)

**Problem found in prototype.** `DataFrame.tsx`'s `onKeyDown` toggled search on
`Ctrl/Cmd+F` **unconditionally**, while the toolbar Search button is already
gated on `capabilities.canSearch`. Lazy mode needs both gated, but the keyboard
shortcut gap is a pre-existing inconsistency.

**Scope.** Gate the `Ctrl/Cmd+F` handler on `canSearch`. Make
`useDataFrameCapabilities` the single source of truth for search/CSV/sort/
select-all gating (it mostly already is). Optionally also gate the
`selectAll` keybinding through a capability rather than the inline
`isLargeTable` check.

**Why it's safe to land alone.** For eager dataframes `canSearch` is already
`true` whenever search is usable, so gating the shortcut is behavior-preserving.
No proto, no backend.

**Files.** `frontend/lib/src/components/widgets/DataFrame/DataFrame.tsx`,
`hooks/useDataFrameCapabilities.ts` (+ test).

**Risk.** Very low. **Depends on.** Nothing.

### Prep 2 — Extract the sort header-indicator helper (frontend)

**Problem found in prototype.** `useColumnSort.ts` is client-side only (wraps
glide's `useColumnSort`, which builds a full sorted row map by calling
`getCellContent` across every row — unusable for lazy). The prototype added a
parallel `useLazyColumnSort` and **duplicated** the `updateSortingHeader`
(↑/↓ title) logic and the asc→desc→none toggle.

**Scope.** Extract `updateSortingHeader` and the direction-toggle logic from
`useColumnSort.ts` into a shared helper (e.g.
`components/widgets/DataFrame/columns/sortUtils.ts`). Keep `useColumnSort`
behavior identical; it just imports the shared helper. This gives the future
`useLazyColumnSort` a shared base instead of a copy.

**Why it's safe to land alone.** Pure refactor, behavior-preserving, covered by
existing `useColumnSort` tests.

**Files.** `frontend/lib/src/components/widgets/DataFrame/hooks/useColumnSort.ts`
+ new shared util (+ test).

**Risk.** Low. **Depends on.** Nothing.

### Prep 3 — Proto scaffolding for lazy dataframes (proto)

**Scope.** Add the additive proto messages and run `make protobuf`:

- `Dataframe.LazyDataframe` (optional `lazy_data` field) and `SortState` in
  `Dataframe.proto`.
- `DataframeChunkRequestPayload` in `BackMsg.proto`'s
  `BackendOperationRequest.payload` oneof (next free field number).
- `DataframeChunkResponsePayload` in `ForwardMsg.proto`'s
  `BackendOperationResponse.payload` oneof.

**Why it's safe to land alone.** Purely additive proto with no producers or
consumers yet. Unblocks Prep 4, 5, and 6 (they can reference the generated
types). Low value on its own, so it can also be folded into Prep 5.

**Files.** `proto/streamlit/proto/{Dataframe,BackMsg,ForwardMsg}.proto`.

**Risk.** Very low. **Depends on.** Nothing.

### Prep 4 — Internal `DataframeSource` protocol + in-memory sources (backend, dormant)

**Scope.** Land the `lib/streamlit/dataframe/` package as a standalone,
fully-unit-tested module **with no wiring into `st.dataframe`**:

- `DataframeSource` `Protocol`, `SortSpec`, and the threshold constants
  (`AUTO_LAZY_ROW_THRESHOLD = 150_000`, `FORCED_LAZY_MIN_ROWS = 1_000`,
  `DEFAULT_PAGE_SIZE`, `MAX_CHUNK_ROWS`).
- `InMemoryDataframeSource` (Arrow-table backed; server-side sort via
  `pyarrow.compute`; stable schema across chunks).
- The `resolve_lazy_source(...)` decision function (it depends only on
  `dataframe_util` detection helpers, not on proto).

**Why it's safe to land alone.** No public API change, no proto dependency, no
callers except its own unit tests. This is the single most reviewable backend
chunk and carries most of the resolution logic.

**Files.** `lib/streamlit/dataframe/{__init__,source}.py` +
`lib/tests/streamlit/dataframe/source_test.py`.

**Risk.** Low. **Depends on.** Nothing (Phase 2 `adapters.py` can come with the
final PR or its own follow-up).

### Prep 5 — Session source manager + chunk handler + lifecycle (backend, dormant)

**Scope.** Land the runtime/session plumbing, registered but **dormant** (no
source is ever created until `st.dataframe` produces one in the final PR):

- `runtime/dataframe_source_manager.py` (`DataframeSourceManager`:
  source-id/generation/session validation, `MAX_CHUNK_ROWS` cap,
  register/load/clear/prune).
- `runtime/dataframe_chunk_handler.py` (`DataframeChunkHandler`), registered on
  the dispatcher in `app_session._create_backend_operation_dispatcher`.
- Lifecycle hooks mirroring the media-file manager: `clear_session_refs` at
  full-rerun start and `remove_orphaned_sources` after script finish in
  `scriptrunner/script_runner.py`; `clear_all_for_session` on shutdown in
  `app_session.py`; the manager instance on `Runtime` in `runtime.py`.
- **Test-runtime wiring**: add `dataframe_source_mgr` to the mock `Runtime` in
  `testing/v1/app_test.py` and `tests/delta_generator_test_case.py` (the
  prototype needed this — `MagicMock(spec=Runtime)` otherwise returns a mock
  manager and breaks any test that renders a lazy dataframe).

**Why it's safe to land alone.** The handler is registered for the
`dataframe_chunk` payload, but nothing sends that payload yet, so the manager
stays empty and the lifecycle hooks are no-ops. Fully unit tested in isolation.

**Files.** `runtime/dataframe_source_manager.py`,
`runtime/dataframe_chunk_handler.py`, `runtime/runtime.py`,
`runtime/app_session.py`, `runtime/scriptrunner/script_runner.py`,
`testing/v1/app_test.py`, `tests/delta_generator_test_case.py` + manager/handler
tests.

**Risk.** Low–medium (touches the session/script lifecycle, but the additions
are dormant). **Depends on.** Prep 3 (proto) and Prep 4 (source protocol).

### Prep 6 — `BackendOperationClient.requestDataframeChunk` (frontend)

**Scope.** Add the typed `requestDataframeChunk(...)` method, the
`dataframeChunk` branch in `extractResponsePayload`, and widen the
`payloadField` union — mirroring the existing `requestDeferredFile`. No UI
change; unit tested against a mock send/response.

**Why it's safe to land alone.** Additive client method, no component consumes
it yet.

**Files.** `frontend/lib/src/BackendOperationClient.ts` (+ test).

**Risk.** Very low. **Depends on.** Prep 3 (generated proto types).

---

## Optional / larger prep (evaluate cost vs. benefit)

### Prep 7 — Cell-provider layering for `useDataLoader` (frontend) — OPTIONAL

The tech spec proposed splitting `useDataLoader` into base cell provider +
editing overlay + cell formatter + error boundary, so lazy loading replaces
only the base provider.

**The prototype intentionally did NOT do this.** Instead it adds a parallel
`useLazyDataLoader` and selects the active `getCellContent` by `isLazy` in
`DataFrame.tsx` (both hooks always run, per the Rules of Hooks). That approach
kept the high-traffic eager cell path untouched and is much lower risk.

**Recommendation.** Treat the full split as optional. It produces a cleaner
long-term seam but touches the core eager rendering path (higher regression
risk) for little reduction in the final lazy diff. If pursued, do it as its own
behavior-preserving PR with strong snapshot/behavioral coverage; otherwise the
parallel-hook approach in the prototype is fine to keep.

### Prep 8 — Row-count abstraction (frontend) — OPTIONAL / can fold into lazy PR

`DataFrame.tsx` derives `originalNumRows` from `data.dimensions.numDataRows`.
Lazy mode overrides it from `lazy_data.row_count`. This override is a 3-line
change and is hard to land meaningfully before the proto field exists, so it's
fine to keep in the final lazy PR rather than as standalone prep.

---

## Suggested sequencing

```
Prep 1 (search shortcut)        ─┐
Prep 2 (sort header helper)      ├─ independent, any order, frontend-only
Prep 6 (client method) ← Prep 3 ─┘

Prep 3 (proto) ─→ Prep 4 (source protocol) ─→ Prep 5 (manager + handler + lifecycle)
```

Preps 1, 2, 3, 4 have no inter-dependencies and can land in parallel. Prep 5
depends on 3 + 4; Prep 6 depends on 3.

## What remains in the final lazy-loading PR after the preps

With Preps 1–6 merged, the final PR shrinks to the wiring that actually turns
lazy mode on:

- `elements/arrow.py`: the `lazy` parameter, `resolve_lazy_source` call, and
  `lazy_data` marshalling (register source + serve the initial chunk).
- Phase 2 native adapters (`dataframe/adapters.py`) if not split into a
  follow-up.
- `useDataFrameCapabilities` lazy flags (`isLazy`, `lazySortable`) and the lazy
  gating branch — these only matter once lazy mode exists, so they belong here.
- `useLazyDataLoader` + `useLazyColumnSort` + `LazyDataframeCache` and their
  integration into `DataFrame.tsx` (the `isLazy` hook selection,
  `onVisibleRegionChanged` wiring, lazy row count, initial-chunk Quiver).
- E2E app + tests and the typing test for `lazy`.

This leaves the final PR as a focused, mostly-additive feature toggle on top of
already-reviewed, already-tested infrastructure.
