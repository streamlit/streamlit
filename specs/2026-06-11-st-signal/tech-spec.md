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
class _SignalRecord:
    initial: Any        # value or zero-arg callable, resolved lazily
    state: Any          # current value (initial resolved on first access)
    watchers: list[str] # fragment ids, in execution (call-time) order
```

Lifecycle bookkeeping lives on the run context, not the record: `st.signal` adds its key
to `ctx.signal_keys_declared_this_run`, and the end-of-full-run reconciliation calls
`SignalStorage.clear(keep_keys=...)` with that set.

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
- `ClientState.scope_token: string` — the frontend substitutes the element's
  `scopeToken` for its `fragmentId` when building widget props
  (`ElementNodeRenderer.tsx`), so the token rides the existing fragment-id plumbing;
  `App.tsx#sendRerunBackMsg` then splits prefixed tokens back out into
  `ClientState.scope_token` (and leaves `fragment_id` unset). This is what implements
  both suppressions in the product spec without special cases — `WidgetStateManager`
  itself is untouched.

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
5. The queue loop executes watchers in order through `order_fragment_ids`: serial watchers
   inline, `parallel=True` watchers dispatched non-blocking and joined at end of pass (below).
   Per-fragment cleanup as today.

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
execution time). A send to a signal already in the set from *within its own cascade* still updates the
state but queues nothing, and logs a warning.

#### Parallel watchers (non-blocking)

The queue loop (`_run_fragment_pass`) runs serial watchers inline and dispatches each
`parallel=True` watcher **fire-and-forget** to `ParallelFragmentCoordinator` via
`_run_watcher_worker` (the `parallel` flag comes from `FragmentStorage.is_parallel`). A
single barrier joins all outstanding parallel watchers at the **end of the pass** — exactly
the full-run model, not a per-batch join. So a parallel watcher overlaps the serial watchers
that follow it, and its `session_state` writes are **not** observable by any watcher in the
same pass (they reconcile on the next pass). The one ordering constraint is nesting: before
running a watcher whose ancestor is still in flight, the loop drains outstanding parallel work
(`has_ancestor_in`), because the ancestor creates the container the descendant nests into;
`order_fragment_ids` puts ancestors first, so this only affects nested watchers of the same
signal.

Only fragments queued **as watchers** are dispatched to workers. A fragment that is the
rerun's *direct target* — its own widget or `run_every` triggered the rerun — always runs
inline, even with `parallel=True`. `ScriptRequests` records such ids in
`RerunData.direct_fragment_ids` when it converts a single `fragment_id` into the queue, and
the loop checks that set before dispatching. This preserves the parallel-fragments contract
that a fragment's own reruns are sequential (interaction-gated `st.dialog`/`st.switch_page`
keep working).

Three runtime changes made this work:

- **`ctx.cursors` is ContextVar-backed** (`script_run_context.py`) so each worker's snapshot
  restore (`fragment.py` rerun branch) stays isolated to its copied context — the one piece of
  shared mutable position state the full-run path never touched. Two compatibility details:
  the getter persists a map on first access in an unseeded context, and
  `add_script_run_ctx` seeds an attached user thread with the parent's map (the same dict
  object), preserving the pre-ContextVar behavior where top-level writes from user threads
  continue the parent's delta positions.
- **`ParallelFragmentCoordinator` is reusable**: `join()` no longer shuts the executor down;
  a separate `close()` tears it down once per pass, so the nesting drain can join mid-pass and
  keep dispatching.
- **The `parallel` flag is persisted** in `FragmentStorage` (`is_parallel`, `has_ancestor_in`).

Cleanup (`clear_stale_descendants`) for dispatched watchers runs after the join using the
global `new_fragment_ids` snapshot, not the serial loop's registration-sequence window, which
races under concurrent registration. If the pass escapes (a serial watcher re-raising
Rerun/Stop, or an interrupt) while parallel watchers are in flight, `_run_fragment_pass`
drains the coordinator before the escape propagates — mirroring the full-run path — so
workers never outlive the pass. Mid-pass `send()` also filters watcher ids against
`FragmentStorage.contains` (mirroring the request-time filter in `_resolve_scope_token`), so
stale subscriptions never reach the pass loop's missing-fragment warning.

The in-pass scatter→gather case (a serial watcher reading a parallel fan-out's writes) is
intentionally unsupported; an explicit `st.wait()` barrier is the planned answer (product
spec, *Out of Scope*).

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
- Same, but `F` **is** a watcher → `F` runs once, in its execution-order slot.
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
  Mechanism: `register_widget` stores the function hash plus `callback_args`/`callback_kwargs`
  on the widget's `WidgetMetadata`; during the callback phase the ScriptRunner collects the
  changed widgets' overrides (`SessionState.collect_fragment_callback_overrides`), resolves
  the hash to its registered fragment ids, and stashes them in `ctx.fragment_arg_overrides`;
  `wrap()` calls `non_optional_func(*args, **kwargs)` with the override when present, else
  the captured call-site args. Riding `WidgetMetadata` (not `RerunData`) means the overrides
  survive request coalescing for free. The fragment function itself is **not** stored as the
  widget's callback (the stored callback is `None`) — only its hash — so nothing executes in
  the callback phase; the fragment runs in its container during the scoped pass.

### Implementation phases

1. **Core:** `Signal` + `SignalStorage`, `watch=` registration, `send()` from fragment
   bodies and callbacks (live-queue append), lifecycle reconciliation. Python unit tests.
   *(done)*
2. **Protocol:** `scope_token` on `Delta`/`ClientState`, frontend `WidgetStateManager`
   preference, server-side resolution, fragment-as-callback function index. E2E tests.
   *(done)*
3. **API refinements:** `st.signal(key, *, initial=None)` signature; signal-callback
   single-value `args` + `kwargs` rejection; fragment-callback `args`/`kwargs` forwarding
   (override plumbing above). *(done)*
4. **Non-blocking parallel watchers** in the queue loop (see *Parallel watchers* above).
   *(done)* — `parallel=True` watchers are dispatched fire-and-forget and joined at the end
   of the pass, matching the full-run model. Resolved the three blockers: ContextVar-backed
   `ctx.cursors`, a reusable coordinator (`join()`/`close()` split), and a persisted
   `parallel` flag in `FragmentStorage`.
5. **`st.wait()` (future):** an explicit barrier for in-pass scatter→gather (product spec,
   *Out of Scope*). Gated on root-causing where worker `session_state` writes are deferred.

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
