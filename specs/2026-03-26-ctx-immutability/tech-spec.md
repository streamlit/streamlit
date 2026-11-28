---
author: sfc-gh-lwilby
created: 2026-03-26
---

# ScriptRunContext field immutability (parallel fragments)

## Summary

`ScriptRunContext` is the per-run handle attached to the script thread (and, with
`@st.fragment(parallel=True)`, to worker threads via the same object reference). Many
fields use mutable container types (`set`, `list`, `dict`) even when a run only **replaces**
the container at `reset()` and then **reads** it during execution. This audit lists every
field, how it is written and read, and whether tightening types (for example `frozenset`,
`tuple`) would catch accidental concurrent mutation. Only two fields are strong
candidates for container immutability without behavioral change; the rest either accumulate
state during the run, are updated from multiple code paths mid-run, or require explicit
synchronization as part of parallel-fragments work.

## Problem

When the same `ScriptRunContext` instance is visible from more than one thread, any **in-place**
mutation of a shared `set`/`list`/`dict` is a potential data race. Fields that are **rebound**
once per run (new `set()` in `reset()`) but never mutated **through that attribute** are
still safe for membership tests **only if** no code retains and mutates the old container
or aliases the new one incorrectly. Using immutable collections for “fixed snapshot” data
makes violations obvious at development time (`AttributeError` on `.add`) instead of
manifesting as rare cross-thread corruption.

This spec does **not** claim that switching types fixes parallel fragments by itself; fields
that are intentionally updated during execution still need locks, thread-local storage, or
redesign (see [parallel fragments tech spec](../2026-03-05-parallel-fragments/tech-spec.md)).

## Proposal

### Field catalogue and classification

Legend:

- **Immutable candidate** — Value for the run is fixed at `reset()` / `__init__` and only
  read during execution; container type can be tightened.
- **Needs synchronization** — Written during execution in ways that conflict with shared
  multi-threaded access; parallel-fragments work item.
- **Leave as-is** — Intentionally mutable accumulator, updated mid-run from expected sites,
  or reference to a service object whose mutability is inherent.

| Field | Type (current) | Written when | Read / mutated during execution | Classification |
| ----- | -------------- | ------------ | --------------------------------- | -------------- |
| `session_id` | `str` | `__init__` | Read | Leave as-is (immutable `str` value) |
| `_enqueue` | `Callable[[ForwardMsg], None]` | `__init__` | Call from `enqueue()`; may run from non-script thread | Leave as-is (callback; thread-safety is queue/runner concern) |
| `query_string` | `str` | `reset()`; also `query_params.py` assigns `ctx.query_string` when the client sends `page_info_changed` | Reads for rerun payloads | Leave as-is (mutated mid-run) |
| `session_state` | `SafeSessionState` | `__init__` | All widget/state paths; lock inside `SafeSessionState` | Leave as-is |
| `uploaded_file_mgr` | `UploadedFileManager` | `__init__` | File widget paths | Leave as-is (service object) |
| `main_script_path` | `str` | `__init__` | Read | Leave as-is |
| `user_info` | `UserInfoType` (`dict`) | `__init__` (shared dict) | Read in `st.user`; **dict mutated** from websocket handlers when connection/auth updates | Leave as-is (inherent shared mutable map; deeper copy-on-write is separate work) |
| `fragment_storage` | `FragmentStorage` | `__init__` | `fragment.py` calls `.set()` when a fragment is registered | Needs synchronization for parallel fragments |
| `pages_manager` | `PagesManager` | `__init__` | `reset()` / `set_mpa_v2_page` / reads | Leave as-is (orchestration object; not a “snapshot” field) |
| `cached_message_hashes` | `set[str]` | `reset()` only | `enqueue()` — membership test only | **Immutable candidate** → `frozenset[str]` |
| `context_info` | `ContextInfo \| None` | `reset()` | Read-only field access in `runtime/context.py`, `script_runner` shutdown | Leave as-is (protobuf message objects are mutable in principle; no in-repo reassignment after `reset`) |
| `gather_usage_stats` | `bool` | `__init__` | Read in metrics | Leave as-is (already a value type) |
| `command_tracking_deactivated` | `bool` | `reset()`; metrics may toggle | Metrics read/write | Needs synchronization if multiple threads emit commands |
| `tracked_commands` | `list[Command]` | `reset()` | `metrics_util` appends | Needs synchronization |
| `tracked_commands_counter` | `Counter[str]` | `reset()` | `metrics_util` updates | Needs synchronization |
| `_has_script_started` | `bool` | `reset()`; `on_script_start()` | Internal | Needs synchronization if starts overlap |
| `widget_ids_this_run` | `set[str]` | `reset()` | `elements/lib/utils.py` `.add()`; reads in session state, components, `on_script_finished` | Needs synchronization |
| `widget_user_keys_this_run` | `set[str]` | `reset()` | `elements/lib/utils.py` `.add()` | Needs synchronization |
| `form_ids_this_run` | `set[str]` | `reset()` | `elements/form.py` `.add()`; reads in session state | Needs synchronization |
| `cursors` | `dict[int, RunningCursor]` | `reset()`; `fragment` may replace with `deepcopy` | `cursor.py` inserts; `exec_code` clears | Needs synchronization |
| `script_requests` | `ScriptRequests \| None` | `__init__` | `execution_control` calls `request_rerun` / `request_stop` | Needs synchronization (or confine calls to script thread) |
| `current_fragment_id` | `str \| None` | `reset()`; `fragment.wrapped_fragment` sets/restores | `enqueue_message` tags deltas | Needs synchronization or thread-local |
| `fragment_ids_this_run` | `list[str] \| None` | `reset()` only | Truthiness, `in`, ordered scan (`execution_control._new_fragment_id_queue`, `forward_msg_queue`, session state) — **no in-place mutation of `ctx.fragment_ids_this_run`** | **Immutable candidate** → `tuple[str, ...] \| None` |
| `new_fragment_ids` | `set[str]` | `reset()` | `fragment.py` `.add(fragment_id)` | Needs synchronization |
| `in_fragment_callback` | `bool` | Default; `session_state` toggles around callbacks | `delta_generator` reads | Needs synchronization |
| `_active_script_hash` | `str` | `reset()`, `run_with_active_hash`, `set_mpa_v2_page` | `active_script_hash` property; `enqueue` | Needs synchronization |
| `has_dialog_opened` | `bool` | `reset()`; `dialog.py` may set `True` | Dialog guard reads | Needs synchronization |
| `current_fragment_delta_path` | `list[int]` (see note) | `reset()` to `[]`; `fragment.py` sets and clears | `policies.py` reads for layout checks | Needs synchronization or thread-local; **should be declared on the dataclass** |

**Note on `current_fragment_delta_path`:** It is assigned in `reset()` and in
`lib/streamlit/runtime/fragment.py` but is **not** listed in the `@dataclass` field list in
`script_run_context.py` (dynamic attribute). It should be added to the dataclass for clarity
and typing.

### Read-only properties (no change)

| Member | Notes |
| ------ | ----- |
| `page_script_hash` | `@property` → `pages_manager.current_page_script_hash` |
| `active_script_hash` | `@property` → `_active_script_hash` |
| `main_script_parent` | `@property` → `pages_manager.main_script_parent` |

### Related: not a `ScriptRunContext` field

| Name | Role |
| ---- | ---- |
| `in_cached_function` | Module-level `contextvars.ContextVar[bool]` — **not** shared across threads when contexts are copied per worker; already the right model. |

### Immutable candidates — concrete type changes

**1. `cached_message_hashes`**

- **Before:** `set[str]`, `reset()` does `self.cached_message_hashes = cached_message_hashes or set()`.
- **After:** `frozenset[str]`, `reset()` does
  `self.cached_message_hashes = frozenset(cached_message_hashes or ())`.
- **Call sites:** `msg.hash in self.cached_message_hashes` unchanged. `RerunData` and
  `st.rerun` today pass `ctx.cached_message_hashes` into new `RerunData`; either keep
  `RerunData.cached_message_hashes` as `set` and convert at `reset()`, or align `RerunData`
  to `frozenset` for consistency (follow-up PR).

**2. `fragment_ids_this_run`**

- **Before:** `list[str] | None`, stores reference from `rerun_data.fragment_id_queue`.
- **After:** `tuple[str, ...] | None`, `reset()` does
  `self.fragment_ids_this_run = tuple(fragment_ids_this_run) if fragment_ids_this_run else None`.
- **Call sites:** `bool(ctx.fragment_ids_this_run)`, `x in ctx.fragment_ids_this_run`,
  `dropwhile` over the sequence — all tuple-compatible. Ordering preserved.

## Migration

- **Reads:** `in` and iteration work for `frozenset` and `tuple` the same as `set` / `list`.
- **Writes:** Any test or internal code that **mutated** `ctx.cached_message_hashes` or
  `ctx.fragment_ids_this_run` in place would break (good). Grep shows no such mutations today.
- **Typing:** Narrow return types where `ScriptRunContext` is constructed from `RerunData`;
  mypy may need small updates where `set` was assumed.

## Alternatives Considered

- **`types.MappingProxyType` for shared dict snapshots** — Possible for `user_info` if we
  ever need a read-only view for the script thread; rejected here as out of scope (host
  mutates the dict for auth).
- **Making all “reset-only” fields `@property` backed by private attributes** — Possible but
  verbose; `frozenset`/`tuple` give most of the safety with less boilerplate.
- **Thread-local `ScriptRunContext` clones** — Architectural alternative to sharing one ctx;
  tracked in parallel fragments spec, not this audit.

## Out of scope

- Locks, `threading.local`, or `ContextVar` migration for per-fragment fields.
- `ForwardMsgQueue` and `_enqueue` concurrency guarantees.
- Broader `ScriptRunContext` split (runner-owned vs fragment-owned state).
- Changing `UserInfoType` or protobuf types to immutable counterparts.
