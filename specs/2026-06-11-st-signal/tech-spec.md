---
author: kmcgrady
created: 2026-06-11
---

# `st.signal` — runtime design

## Summary

Technical design for `st.signal` (see [product-spec.md](./product-spec.md)). The core
observation: the ScriptRunner already executes an **ordered queue of fragments in a single
pass** (`RerunData.fragment_id_queue`); today that queue is only ever populated with one
widget-triggered fragment id. A signal is, at runtime, a named server-side mapping from a
key to (state value + an ordered list of watcher fragment ids). Firing a signal means
resolving that mapping into the existing queue. Most of this feature is registration,
resolution, and a small protocol extension — not new execution machinery.

## Problem

Three gaps prevent cross-fragment triggering today:

1. **The trigger path is widget → enclosing fragment only.** The frontend scopes a rerun
   request using the interacted element's `fragment_id`
   (`Delta.fragment_id`, `proto/streamlit/proto/Delta.proto:36`; passed through
   `WidgetStateManager` flush scheduling; sent as `ClientState.fragment_id`,
   `proto/streamlit/proto/ClientState.proto:35`). There is no way to express "this widget
   scopes to *those* fragments over there."
2. **No server-side grouping.** `FragmentStorage` maps fragment ids to stored functions but
   has no notion of named groups or subscriptions.
3. **No durable cross-fragment data channel with rerun semantics.** Watchers can share data
   via `session_state`, but nothing connects "this value changed" to "rerun these
   fragments."

## Proposal

### What already exists (and is reused unchanged)

| Requirement | Existing machinery |
|-------------|--------------------|
| Run an ordered list of fragments in one pass, nothing else | `RerunData.fragment_id_queue` (`lib/streamlit/runtime/scriptrunner_utils/script_requests.py:56`); execution loop in `code_to_exec` (`lib/streamlit/runtime/scriptrunner/script_runner.py:715`) |
| Per-watcher exception isolation (queue continues past a failing fragment) | `script_runner.py:747-760` — user exceptions are rendered in the fragment's container and swallowed |
| Skip watchers that are no longer registered | `FragmentStorageKeyError` → `continue` (`script_runner.py:721-745`) |
| Ancestor-before-descendant ordering for nested fragments, FIFO otherwise | `FragmentStorage.order_fragment_ids` (`lib/streamlit/runtime/fragment.py:278`) |
| Callbacks run before the queue executes (so `send()` in a callback can join the pass) | `on_script_will_rerun` is called at the top of `code_to_exec`, before the queue loop (`script_runner.py:708-716`) |
| Stable fragment identity across reruns | `fragment_id = calc_hash(module + qualname + delta_path)` (`fragment.py:370-372`) |
| Coalescing/dedup of fragment ids across queued rerun requests | `ScriptRequests` merge logic (`script_requests.py:197-238`) |
| Stable containers + element cleanup per watcher rerun | Existing fragment container snapshot/cleanup (`fragment.py:368-441`, `clear_stale_descendants`) |
| Lifecycle bookkeeping "what registered this full run" | `FragmentStorage.clear(new_fragment_ids=...)` at end of full runs (`script_runner.py:798-800`) |
| Parallel fragment dispatch | `ParallelFragmentCoordinator` (used by full runs today) |

### New runtime pieces

#### `SignalStorage` (per session)

A session-scoped store, sibling of `FragmentStorage`:

```python
@dataclass
class SignalRecord:
    state: Any                       # current value (initial resolved lazily)
    watchers: list[str]              # fragment ids, in registration (page) order
    declared_this_full_run: bool     # lifecycle reconciliation flag
```

- `st.signal(key, *, initial=...)` registers/looks up the record by `key`. A second
  `st.signal` call with the same key **in the same run** raises `StreamlitAPIException`
  (fail fast, principle #23). Re-declaration across runs is the normal case and preserves
  state.
- **Lifecycle:** at the end of every **full** run — and only full runs, since fragment-only
  passes don't re-execute the main script — records not re-declared are dropped (state
  reset), mirroring `FragmentStorage.clear`. This yields the MPA behavior in the product
  spec for free: main-script signals re-declare on every page; page-script signals don't.
- **Watcher registration:** in `_fragment`'s `wrap()` (`fragment.py:359`), when `watch=` is
  present, append the computed `fragment_id` to each signal's `watchers` at call time —
  the same moment the fragment registers in `FragmentStorage`. Full runs rebuild the lists
  from scratch; fragment-only passes re-register only the fragments that ran (same
  pattern as `new_fragment_ids`, `fragment.py:400`).

State lives in `SignalStorage`, not in user-visible `session_state` keys — it is
session-scoped like `session_state` but addressable only through the `Signal` object.

#### Protocol extension: scope tokens

Two new fields, one concept — "this widget's interaction scopes to a server-resolved
group":

- `Delta.scope_token: string` — set on a widget's delta when its `on_*` callback is a
  `Signal` or a fragment function (detected via `isinstance` at element registration).
  Coexists with `Delta.fragment_id`, which keeps its cleanup role for widgets inside
  fragments.
- `ClientState.scope_token: string` — the frontend's `WidgetStateManager` prefers the
  element's `scopeToken` over its `fragmentId` when scheduling the flush, so the rerun
  request arrives scoped to the token instead of the enclosing fragment (or instead of a
  full rerun for top-level widgets). This is what implements both suppressions in the
  product spec without special cases.

Token values:

- Signal callback → `signal:<key>`.
- Fragment callback → `fragment_fn:<hash(module + qualname)>`. Resolved at request time to
  **all currently-registered instances** of that function, which requires `FragmentStorage`
  to additionally index fragment ids by function hash (a small secondary map maintained at
  `register`/`_remove`).

Server-side resolution at request-handling time (not browser-held fragment id lists) is
deliberate: watcher sets change as conditionals and layout change, and resolving at fire
time self-heals the same way the existing missing-fragment skip does.

#### Execution flow for a fire

1. User interacts with a widget whose element carries `scope_token`.
2. Frontend sends the rerun BackMsg with `ClientState.scope_token` + widget states.
3. Backend resolves the token via `SignalStorage` / the function-hash index into an ordered
   fragment id list → `RerunData.fragment_id_queue`. Unknown token (e.g. signal dropped by
   lifecycle) → fall back to a full rerun, matching today's stale-`fragment_id` behavior.
4. `ctx.reset`, `SCRIPT_STARTED`, callbacks run (`on_script_will_rerun`) — widget values
   land in `session_state` first, then `send()` calls in callbacks may append watchers to
   the live queue (below).
5. The queue loop executes watchers in order through `order_fragment_ids`, with parallel
   batching (below). Per-fragment cleanup as today.

#### `send()` semantics

`Signal.send(value)` sets `record.state = value` and then, depending on context:

| Context | Effect |
|---------|--------|
| Plain callback (callback phase of any pass) | Watchers appended to the current pass's queue. |
| Fragment body during a fragment pass | Watchers appended to the remainder of the queue (dedup against already-run and queued ids). |
| Main script / fragment body during a **full** run | State update only — everything renders anyway; top-down ordering applies (documented). |
| Parallel fragment worker thread | Raises `StreamlitAPIException` via the existing `_check_not_parallel_worker` guard (`fragment.py:56`). |

**Live queue mutation:** `fragment_ids_this_run` is currently an immutable snapshot
captured before `code_to_exec` (`script_runner.py:614-617`). It becomes an append-only
work queue on `ScriptRunContext` that the loop consumes iteratively; `send()` appends
resolved watcher ids (minus already-run ids) to it. Newly appended ids re-pass through
`order_fragment_ids` relative to the remaining queue.

*Alternative considered:* route mid-pass sends through the existing rerun-request
coalescing (a follow-up fragment-scoped `RerunException`/request). Rejected for the main
path: it produces a second visible render pass and double-runs shared watchers; the
machinery remains the fallback for sends that arrive too late in the pass to be appended.

**Once-per-pass + cycle guard:** the context tracks `signals_fired_this_pass: set[str]`.
Repeated sends to the same signal update state and re-dedup the queue (watchers run once,
with the final value — "last value wins" falls out of watchers reading `record.state` at
execution time). A send to a signal already in the set from *within its own cascade* is a
no-op with a logged warning.

#### Parallel watcher batching

The queue loop groups maximal runs of consecutive `parallel=True` watchers (the fragment's
`parallel` flag is known from its registration). A serial watcher executes inline as today;
a parallel batch is dispatched through `ParallelFragmentCoordinator` and **joined before
the next serial watcher starts**. Guarantees: ordering and globals-visibility hold across
batch boundaries only; within a batch, watchers must communicate via signal state /
`session_state` (single-op atomicity per the parallel fragments spec).

#### Typing

`Signal` is `Generic[T]`. `st.signal` overloads distinguish `initial: T` from
`initial: Callable[[], T]` so `T` never binds to the callable type. `send(value: T)` and
`value: T` give end-to-end checking; type tests live in
`lib/tests/streamlit/typing/signal_types.py` per repo convention. `Signal.__call__` accepts
an optional positional value so the object satisfies the widget callback protocols
(bare `on_click=sig` and `on_click=sig, args=(v,)`).

#### Suppression interactions worth unit-testing

- Widget with `scope_token` inside fragment `F`, `F` **not** a watcher → `F` does not rerun;
  its widget value is still applied to `session_state` (callback phase) and visible on
  `F`'s next natural rerun.
- Same, but `F` **is** a watcher → `F` runs once, in its declared slot.
- Fragment-as-callback where the function is the widget's own enclosing fragment →
  degenerates to today's behavior (queue of one).
- Watcher list mutates mid-pass (a watcher body's conditional registers/unregisters a
  nested watcher) → resolution happened at fire time; nested-fragment cleanup
  (`clear_stale_descendants`) applies as today.
- `st.rerun(scope="app")` / `st.stop()` inside a watcher → existing semantics
  (`RerunException`/`StopException` re-raised by the queue loop, `script_runner.py:748-752`).

### Callback argument handling

Both kinds of scoped callback are detected in `register_widget` →
`_detect_scoped_callback` (`lib/streamlit/runtime/state/widgets.py`), before the rerun
scope is decided:

- **Signal callback** (`isinstance(cb, Signal)`): the `Signal` stays the stored callback —
  its `__call__(value=_UNCHANGED)` fires during the callback phase. `args` may be empty
  (bare fire) or a single positional `(value,)` → `send(value)`. **`kwargs` raise** a
  `StreamlitAPIException` at registration (`send` has nowhere to put them). More than one
  positional arg also raises. The `signal:<key>` token scopes the rerun as today.
- **Fragment callback** (`getattr(cb, "_st_fragment_function_hash", None)`): `args`/`kwargs`
  are **forwarded**, not banned. They are stashed alongside the `fragment_fn:<hash>` token
  and applied when the fragment reruns: the queue loop invokes the fragment with the
  callback's `(args, kwargs)` in place of its captured call-site arguments for that pass.
  Mechanism: `register_widget` records `(fragment_hash → args, kwargs)` for the pass; the
  resolver attaches them to the resolved fragment ids in `RerunData`; `wrap()` reads an
  override off `ctx` (keyed by `fragment_id`) and calls `non_optional_func(*args, **kwargs)`
  when present, else the captured args. No override → today's behavior (rerun with
  call-site args). The callback is no longer nulled for fragment functions; instead it is
  skipped in the callback phase (it must run in its container during the scoped pass, not
  in the callback phase).

### Implementation phases

1. **Core:** `Signal` + `SignalStorage`, `watch=` registration, `send()` from fragment
   bodies and callbacks (live-queue append), lifecycle reconciliation. Python unit tests.
   *(done)*
2. **Protocol:** `scope_token` on `Delta`/`ClientState`, frontend `WidgetStateManager`
   preference, server-side resolution, fragment-as-callback function index. E2E tests.
   *(done)*
3. **API refinements:** `st.signal(key, *, initial=None)` signature; signal-callback
   single-value `args` + `kwargs` rejection; fragment-callback `args`/`kwargs` forwarding
   (override plumbing above).
4. **Parallel watcher batching** in the queue loop — the deferred execution model from the
   product spec ("serial → joined parallel batch → serial"). The known blockers to resolve:
   (a) `ParallelFragmentCoordinator.join()` currently shuts its executor down (single-use
   per run) — needs a per-batch join or a reusable pool; (b) fragment-pass reruns reassign
   shared `ctx.cursors` (`fragment.py:393`), which concurrent watchers in a batch would
   race on — needs per-worker cursor isolation like the full-run path; (c) the `parallel`
   flag must be persisted in `FragmentStorage` (today it lives only in `wrap`'s closure) so
   the queue loop can group consecutive parallel watchers. Sequential execution remains
   correct in the meantime; batching is a pure latency optimization.

## Alternatives Considered

**Frontend-held fragment id lists** (widget proto carries the watcher fragment ids
directly, no server registry): rejected — watcher sets are dynamic (conditionals, layout
changes shift fragment ids), so browser-held lists go stale between renders; server-side
resolution at fire time self-heals.

**Modeling signals as session_state keys with subscriptions** (no new storage; subscribe
fragments to widget/state keys): rejected — entangles signal lifecycle with user-managed
`session_state` semantics (user `del`, widget cleanup), and provides no home for the
ordered watcher list. It also forecloses the explicit-only subscription rule, since
session_state reads are pervasive.

**Wrapper-function dependency groups** (a "meta-fragment" that calls the other fragment
functions): rejected — calling a fragment function executes it at the *current* cursor
position; in-place scattered updates require rerunning each fragment at its original call
site, which is exactly what the id queue does.

**`*args/**kwargs` signal payloads with merge-on-send**: rejected — not statically
typeable (`send(*args)` against a per-signal schema), and attribute-style access
(`sig.country`) collides with the `Signal` API namespace. Replace-on-send with one generic
value keeps `send` checkable and reserves attributes for future API surface.
