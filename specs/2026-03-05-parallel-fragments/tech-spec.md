---
author: sfc-gh-lwilby
created: 2026-03-13
---

# Parallel Fragments

## Summary

Add `parallel: bool = False` to `@st.fragment` so that fragment functions run in separate
threads during full app runs. Today, all fragments execute sequentially on the script runner
thread — each one blocks until it completes. With `parallel=True`, the fragment's call site
dispatches its work to a worker thread and returns immediately, allowing independent sections
to load data and render concurrently.

This spec covers the internal changes needed to support concurrent fragment execution.
See the [product spec](./product-spec.md) for user-facing API decisions and behavior.

## Problem

Streamlit's execution model assumes a single script thread. Fragments currently execute
inline on that thread — they share state freely and produce output in a deterministic
sequential order. Running fragments in parallel threads breaks these assumptions in three
areas:

1. **Shared mutable state.** The fragment execution path reads and writes fields on a shared
   `ScriptRunContext` instance (`current_fragment_id`, `widget_ids_this_run`, etc.), enqueues
   messages through a non-thread-safe `ForwardMsgQueue`, and advances position-tracking
   cursors that assume single-threaded access.

2. **Execution flow.** Control flow exceptions (`st.rerun()`, `st.stop()`) currently unwind
   the single script thread. With parallel threads, these exceptions are local to the thread
   that raises them — sibling threads need to be notified and cancelled. The `scriptFinished`
   lifecycle signal, which triggers frontend cleanup via `clearStaleNodes`, must be delayed
   until all threads complete.

3. **Frontend rendering.** Deltas from parallel threads arrive interleaved rather than in
   top-to-bottom script order. The frontend needs to handle content appearing
   non-sequentially, show appropriate loading states for not-yet-completed fragments, and
   ensure `clearStaleNodes` doesn't garbage-collect elements from still-running threads.

## Proposal

### Execution flow

Today, fragments execute inline on the script thread — each one blocks until it completes.
With `parallel=True`, the fragment is dispatched to a worker thread and the script thread
continues immediately.

**Proposed flow (parallel):**

1. Script thread hits `my_fragment()`, spawns a worker thread, and continues immediately.
2. The worker thread runs `wrapped_fragment()` concurrently with the rest of the script.
3. When `exec()` returns (the script has finished), the script thread waits at a join
   barrier for all worker threads to complete.
4. Once all workers are done, `scriptFinished` is sent to the frontend.

Thread lifecycle — registration, joining, and cancellation — is encapsulated in a new
`ParallelFragmentCoordinator` class. The coordinator is created per-run and stored on
`ctx`. It receives a `yield_check` callback from the `ScriptRunner` — this is a
reference to `_maybe_handle_execution_control_request()`, which checks for pending
RERUN/STOP requests and raises the appropriate exception:

```python
class ParallelFragmentCoordinator:
    def __init__(
        self,
        yield_check: Callable[[], None],
        poll_interval: float = 0.1,
    ) -> None:
        self._threads: list[threading.Thread] = []
        self._cancel_event = threading.Event()
        self._yield_check = yield_check
        self._poll_interval = poll_interval

    def register(self, thread: threading.Thread) -> None:
        self._threads.append(thread)

    def cancel(self) -> None:
        self._cancel_event.set()

    def is_cancelled(self) -> bool:
        return self._cancel_event.is_set()

    def join(self) -> None:
        while any(t.is_alive() for t in self._threads):
            self._yield_check()
            time.sleep(self._poll_interval)
        for thread in self._threads:
            thread.join()
```

Three places change:

**1. `fragment.py` — dispatch instead of inline execution**

In `wrap()`, a `parallel=True` fragment dispatches `wrapped_fragment` to a worker thread
instead of calling it directly:

```python
# Today (fragment.py L267-268):
return wrapped_fragment()

# Proposed:
if parallel:
    _dispatch_parallel_fragment(ctx, wrapped_fragment)
    return None
else:
    return wrapped_fragment()
```

`_dispatch_parallel_fragment` is a new helper in `fragment.py` that copies the current
context, spawns a thread, and registers it on `ctx` for the join barrier:

```python
def _dispatch_parallel_fragment(
    ctx: ScriptRunContext,
    fragment_id: str,
    wrapped_fragment: Callable[[], Any],
) -> None:
    # Snapshots all ContextVar values at the call site, including:
    #   - context_dg_stack: the DeltaGenerator/cursor position stack
    #   - in_cached_function: guard preventing widgets inside @st.cache_*
    parent_context = contextvars.copy_context()
    thread = threading.Thread(
        target=_run_parallel_fragment,
        args=(wrapped_fragment, fragment_id, parent_context),
        name=f"parallel_fragment_{_short_id(fragment_id)}",
    )
    add_script_run_ctx(thread, ctx)
    ctx.parallel_coordinator.register(thread)
    thread.start()
```

`_run_parallel_fragment` is the thread entry point. It runs `wrapped_fragment` inside
the copied context (so each thread gets its own `context_dg_stack` and cursor state).
Exception handling within this function is covered in the control flow exceptions
section below.

The script thread does not block. The return value of a parallel fragment is always `None`
(the user function's return value is discarded — documented in the product spec).

**2. `script_runner.py` — join barrier before scriptFinished**

After `exec()` returns, the script runner must wait for all parallel fragment threads to
finish before calling `_on_script_finished`. Today, `scriptFinished` triggers
`clearStaleNodes` on the frontend, which would garbage-collect elements from still-running
threads if sent too early.

```python
# In code_to_exec(), after the exec() call (script_runner.py ~L689):
exec(code, module.__dict__)

# NEW: block until every parallel fragment thread has completed
ctx.parallel_coordinator.join()

self._fragment_storage.clear(new_fragment_ids=ctx.new_fragment_ids)
```

**3. Fragment reruns stay sequential (MVP)**

Fragment reruns — triggered by widget interaction or `run_every` — continue to run
sequentially on the script thread. The existing `fragment_id_queue` loop in `_run_script`
is unchanged:

```python
# script_runner.py ~L644-650 — no change for MVP
if rerun_data.fragment_id_queue:
    for fragment_id in rerun_data.fragment_id_queue:
        wrapped_fragment = self._fragment_storage.get(fragment_id)
        wrapped_fragment()  # still sequential
```

**4. Cooperative cancellation for `st.stop()` and `st.rerun()`**

**When `st.rerun()` or `st.stop()` is called from within a parallel fragment:**

The exception is caught in `_run_parallel_fragment`, which is the thread entry point.
It runs `wrapped_fragment` inside the copied context and handles three cases:

```python
def _run_parallel_fragment(
    coordinator: ParallelFragmentCoordinator,
    wrapped_fragment: Callable[[], Any],
    fragment_id: str,
    parent_context: contextvars.Context,
) -> None:
    def run_fragment() -> None:
        while True:
            try:
                wrapped_fragment()
                break
            except RerunException as e:
                if e.rerun_data.fragment_id_queue:
                    # st.rerun(scope="fragment") — re-execute in this thread,
                    # siblings are unaffected
                    continue
                else:
                    # st.rerun(scope="app") — signal sibling threads to cancel
                    # via the coordinator, then exit
                    coordinator.cancel()
                    break
            except StopException:
                # st.stop() — signal sibling threads to cancel, then exit
                coordinator.cancel()
                break
            except FragmentHandledException:
                break  # error already rendered in the fragment's container
                       # by wrapped_fragment() — existing behavior
            except Exception:
                _LOGGER.exception(
                    "Parallel fragment %s failed", _short_id(fragment_id)
                )
                break

    parent_context.run(run_fragment)
```

**When an external full-app rerun arrives** (e.g., widget interaction while fragments
are still running):

This can happen at two points:

1. **While the main script is still executing.** The existing yield point mechanism
   fires at the next `st.*` call on the script thread, raises `RerunException`, and
   `exec()` exits. This falls into the `except` block below, which calls
   `coordinator.cancel()` and then `coordinator.join()` to wait for the worker
   threads to observe the cancellation and terminate.

2. **During the join barrier** (script has finished, waiting for threads). The script
   thread isn't calling `st.*`, so `coordinator.join()` calls `self._yield_check()`
   on each poll interval. If a RERUN/STOP request has arrived, the yield check raises
   `RerunException` or `StopException`, breaking out of the join loop.

In both cases, worker threads must be cancelled before the rerun can proceed. This
is handled with a try/except in `code_to_exec`:

```python
# In code_to_exec():
try:
    exec(code, module.__dict__)
    ctx.parallel_coordinator.join()
    self._fragment_storage.clear(new_fragment_ids=ctx.new_fragment_ids)  # existing
except (RerunException, StopException):
    ctx.parallel_coordinator.cancel()
    ctx.parallel_coordinator.join()  # wait for threads to observe cancellation
    raise  # propagate so _run_script's rerun loop can restart
```

**How sibling threads and the main thread observe the cancellation:**

Every `st.*` call goes through `_enqueue_forward_msg()` →
`_maybe_handle_execution_control_request()` in `script_runner.py`. This function acts
as a yield point — it checks for pending RERUN/STOP requests and raises the appropriate
exception. Today it guards with `_is_in_script_thread()` and returns early for
non-script threads. We extend it to also check the coordinator's cancel event for
worker threads:

```python
def _maybe_handle_execution_control_request(self) -> None:
    if not self._is_in_script_thread():
        # Worker thread — check coordinator cancel event
        ctx = get_script_run_ctx()
        if ctx and ctx.parallel_coordinator.is_cancelled():
            raise StopException()  # unwinds this thread's call stack
        return

    if not self._execing:
        return

    # NEW: also check cancel event on the script thread — a parallel
    # fragment may have called st.stop() or st.rerun(scope="app")
    ctx = self._get_script_run_ctx()
    if ctx.parallel_coordinator.is_cancelled():
        raise StopException()

    # ... existing request checking logic (unchanged) ...
```

For worker threads, the `StopException` propagates up into `_run_parallel_fragment`,
is caught in the `while` loop, and the thread exits. For the main script thread,
it propagates up through `exec()` into the `except` block in `code_to_exec`,
which cancels remaining threads and re-raises.

A thread blocked on a long I/O call (e.g., a slow database query) will not terminate
until the call returns and the thread reaches its next yield point. This is inherent to
Python threading and should be documented. Users can insert `st.yield_point()` calls
between blocking operations to improve cancellation responsiveness (see
[#14523](https://github.com/streamlit/streamlit/issues/14523)).

**Summary of cancellation scenarios:**

| Scenario | Trigger | Calling thread | Siblings + main thread | Outcome |
|----------|---------|---------------|----------------------|---------|
| Happy path | — | — | — | All threads complete → `join()` returns → `scriptFinished` |
| `st.rerun(scope="fragment")` | Thread A | Caught → `continue` → re-executes `wrapped_fragment()` in same thread | Unaffected | Thread A reruns locally |
| `st.stop()` | Thread A | Caught → `coordinator.cancel()` → exits | See `is_cancelled()` at next yield point → `StopException` → exit | Run ends |
| `st.rerun(scope="app")` | Thread A | Caught → `coordinator.cancel()` → exits | Same as `st.stop()` | `_run_script` restarts |
| External rerun during `exec()` | Frontend | Main thread: `RerunException` at next `st.*` call → `except` block → `cancel()` + `join()` | See `is_cancelled()` at next yield point → exit | `_run_script` restarts |
| External rerun during `join()` | Frontend | `_yield_check()` raises `RerunException` → `except` block → `cancel()` + `join()` | See `is_cancelled()` at next yield point → exit | `_run_script` restarts |

### Content rendering

This section covers the full path from element creation to browser rendering:
cursor assignment, element registration, message delivery (cached message dedup,
queuing, yield point check), delta ordering, element cleanup, and loading UX.

#### Cursor ownership and thread-safe rendering

Streamlit's element tree assumes elements along the main trunk arrive in order.
Content from a parallel thread must be written to a branch — a container on the
main thread that the worker thread renders into.

Today, `RunningCursor` has no concept of thread ownership. `copy_context()` shallow-
copies the `context_dg_stack` ContextVar binding, but the DG and cursor objects inside
are shared by reference. Two threads incrementing the same cursor can produce
`delta_path` collisions.

The fix has two parts:

**1. Pre-create the container on the main thread.** In `wrap()`, the main thread
calls `st.container()` before dispatching. This advances the main thread's cursor
(so subsequent elements don't collide), creates the container delta on the frontend
immediately (enabling the loading skeleton), and gives the worker thread its own
container with an independent `RunningCursor`.

**2. Enforce cursor ownership.** Add thread ownership to `RunningCursor` so that
only the thread that created a cursor can increment it:

```python
class RunningCursor:
    def __init__(self, ...):
        self._index = 0
        self._owner_thread = threading.current_thread()

    def get_locked_cursor(self, ...):
        if threading.current_thread() != self._owner_thread:
            raise RuntimeError(
                "Cursor accessed from a thread that doesn't own it"
            )
        index = self._index
        self._index += 1
        return LockedCursor(index=index, ...)
```

This enforces the invariant: a worker thread must write into a branched container,
never directly onto the main thread's cursor. If future code accidentally shares a
cursor across threads, the error surfaces immediately.

#### Element registration

When an `st.*` call creates a widget or form, it registers the element's identity on
`ScriptRunContext` before building the delta message. These registrations serve as
cross-thread duplicate detection — for example, two fragments must not define widgets
with the same user key.

| Field | Type | Purpose |
|-------|------|---------|
| `widget_ids_this_run` | `set[str]` | Every widget adds its computed ID; checked for duplicate detection |
| `widget_user_keys_this_run` | `set[str]` | Every widget with `key=` adds; checked for duplicate user keys |
| `form_ids_this_run` | `set[str]` | Every `st.form()` adds; checked for duplicate form IDs |

With parallel threads, these sets are read AND written concurrently — Thread A checks
for a duplicate while Thread B simultaneously adds a new ID. This is a data race
without synchronization, and is not safe even under CPython's GIL (which does not
guarantee atomicity for compound check-then-add operations and is absent in
free-threaded Python, PEP 703).

The approach is per-field `threading.Lock` wrapping. This is simple, correct, handles
the cross-thread read requirement (duplicate detection must see IDs from *all*
threads), and has negligible overhead (O(1) operations behind an uncontended lock at
expected thread counts). A separate spec covers the implementation details — see the
thread-safe `ScriptRunContext` shared sets task.

#### Message delivery pipeline

When an `st.*` call produces a delta, it flows through two stages before reaching the
frontend:

1. **`ScriptRunContext.enqueue()`** — hashes the message, checks `cached_message_hashes`
   (a `set[str]` on `ctx`) to see if the client already has it cached. If so, sends a
   lightweight reference instead of the full message. This set is written once at
   `ctx.reset()` and only read during execution, so it is safe for concurrent access
   without synchronization. (A separate spec will assess whether `cached_message_hashes`
   and other `ScriptRunContext` fields should be made formally immutable — see the
   `ScriptRunContext` immutability assessment task.)

2. **`ScriptRunner._enqueue_forward_msg()`** — calls
   `_maybe_handle_execution_control_request()` (the yield point check — see
   [Cooperative cancellation](#4-cooperative-cancellation-for-ststop-and-strerun)), then
   passes the message to `ForwardMsgQueue`. For user code that doesn't call `st.*`
   commands in tight loops, `st.yield_point()` provides an explicit yield point without
   emitting a delta (see [#14523](https://github.com/streamlit/streamlit/issues/14523)).

**`ForwardMsgQueue` thread safety:** The queue is not thread-safe today. Add
`threading.Lock` around `enqueue()`, `clear()`, and `flush()` so that deltas from
multiple threads can be enqueued concurrently without corrupting the internal list or
index map.

#### Delta ordering

Each delta carries an absolute `delta_path`, so interleaved arrival order doesn't
matter — the frontend places elements by path, not by arrival time.

#### Element cleanup

`scriptFinished` triggers `clearStaleNodes` on the frontend, which garbage-collects
elements that were not re-rendered. The join barrier (Execution flow §2) delays
`scriptFinished` until all threads complete, so the cleanup pass never removes elements
from still-running threads.

After the join, `fragment_storage.clear(new_fragment_ids=ctx.new_fragment_ids)` prunes
fragment definitions that were not re-registered during this run. Both fields involved
need thread-safe access:

| Field | Type | Concern |
|-------|------|---------|
| `new_fragment_ids` | `set[str]` | Written by any thread executing `@st.fragment`; read after join for cleanup. Needs same per-field lock as the widget sets above. |
| `fragment_storage` | `FragmentStorage` | Written concurrently when `@st.fragment` definitions register the wrapped function; read after join for `clear()`. `MemoryFragmentStorage` needs a `threading.Lock` around its internal dict — same per-field lock approach as the shared sets. Covered in the thread-safe `ScriptRunContext` shared sets spec. |

#### Loading skeleton

*TODO: needs prototyping and testing before specifying.*

### Other shared mutable state

`ScriptRunContext` currently mixes per-thread, shared-mutable, shared-immutable, and
externally-managed fields on one flat dataclass. The distinction between what's isolated
per-thread and what's shared across threads is implicit — you have to know. This is
fragile: adding a new field requires understanding the concurrency model to choose the
right category, and nothing prevents accidental unsynchronized access to shared state.

**Proposed design:** restructure `ScriptRunContext` into four explicit categories, each
with its own abstraction:

```python
@dataclass
class ScriptRunContext:
    # 1. Immutable config (enforce via immutability assessment)
    session_id: str
    main_script_path: str
    user_info: UserInfoType
    gather_usage_stats: bool

    # 2. Shared, externally thread-safe objects
    session_state: SafeSessionState
    pages_manager: PagesManager       # with lock added
    fragment_storage: FragmentStorage  # with lock added

    # 3. Shared mutable run state — new abstraction
    shared: SharedRunState

    # 4. Per-thread fragment state — new abstraction
    thread_state: FragmentThreadState
```

Adding a new field forces an explicit decision: does it go on `FragmentThreadState`
(per-thread, no sync needed), `SharedRunState` (shared, sync built-in), one of the
externally thread-safe objects, or the immutable config? The following sections describe
each category.

#### Immutable config

`session_id`, `main_script_path`, `user_info`, `gather_usage_stats` — set at
construction, never mutated during execution. Currently immutable by convention only,
not enforced. The `ScriptRunContext` immutability assessment should enforce this (e.g.,
`@property` with read-only access, `types.MappingProxyType` for `user_info`).

#### Externally thread-safe objects

These are shared across threads but manage their own locking.

**`SafeSessionState`** wraps all access with an `RLock`. Per-operation atomicity is
guaranteed — no thread will see a torn read or corrupt the internal data structures.
However, the lock is **released between operations**, which means compound sequences
like read-modify-write are not atomic:

```python
@st.fragment(parallel=True)
def increment():
    # Thread A reads counter=5, releases lock
    val = st.session_state["counter"]
    # Thread B reads counter=5, releases lock
    st.session_state["counter"] = val + 1
    # Both threads write 6 — lost update
```

**MVP approach: document the limitation.** Most parallel fragment use cases are
independent — each fragment loads its own data and renders its own UI. Cross-fragment
shared state writes are uncommon. The product spec scopes cross-fragment communication
as out of scope for the MVP. Users who need multi-operation atomicity can implement
their own lock:

```python
if "lock" not in st.session_state:
    st.session_state["lock"] = threading.Lock()

@st.fragment(parallel=True)
def increment():
    with st.session_state["lock"]:
        st.session_state["counter"] = st.session_state.get("counter", 0) + 1
```

The initialization is safe because it runs on the main script thread before parallel
fragments are dispatched. **Future enhancement:** an atomic update helper or scoped
lock API could make this more ergonomic (to be filed after parallel fragments ships).

**`PagesManager`** has no internal locking today. `st.navigation` calls `set_pages()`
then `get_page_script()` — with concurrent callers, Thread A's read can see Thread B's
page set. `st.switch_page` reads `get_pages()` and mutates
`set_current_page_script_hash()` via `ctx.set_mpa_v2_page()`. There is no "called
once" enforcement on `st.navigation` today; repeated calls silently overwrite even in
synchronous execution. Add `threading.Lock` wrapping `set_pages()`, `get_pages()`,
`get_page_script()`, and `set_current_page_script_hash()` — the same pattern as
`SafeSessionState`. The class-level `uses_pages_directory` flag should also be moved
to an instance attribute (it is currently process-wide, not session-scoped).

**`FragmentStorage`** is written to when `@st.fragment` definitions execute and read
after join for `clear()`. Add a lock to its internal dict — addressed in the feature
PR alongside the coordinator integration.

#### `SharedRunState` — shared mutable run state

Bundles the shared mutable fields that are read and written by any thread during
execution. Encapsulates its own locking — callers use methods like
`ctx.shared.add_widget_id(id)` instead of bare `ctx.widget_ids_this_run.add(id)`,
making unsynchronized access impossible by construction.

```python
class SharedRunState:
    """Thread-safe shared state for a script run.
    Single instance shared across main thread and all worker threads."""
    def __init__(self):
        self._lock = threading.Lock()
        self.widget_ids: set[str] = set()
        self.widget_user_keys: set[str] = set()
        self.form_ids: set[str] = set()
        self.new_fragment_ids: set[str] = set()
        self.tracked_commands: list[Command] = []
        self.tracked_commands_counter: Counter[str] = Counter()

    def add_widget_id(self, widget_id: str) -> bool:
        """Add widget ID. Returns True if already present (duplicate)."""
        with self._lock:
            was_present = widget_id in self.widget_ids
            self.widget_ids.add(widget_id)
            return was_present
    # ... similar methods for other fields
```

The thread-safe shared sets spec defines the per-field wrapper APIs (`ThreadSafeStrSet`,
`ThreadSafeTelemetry`). `SharedRunState` is the container that composes them. This can
land with the thread-safe shared sets work.

#### `FragmentThreadState` — per-thread fragment state

Bundles per-thread fields into a dataclass created fresh per worker thread by
`_dispatch_parallel_fragment`. On the main thread, a single instance is reused.
Replaces the implicit `copy_context()` isolation with explicit per-thread object
creation.

```python
@dataclass
class FragmentThreadState:
    """Per-thread state for a fragment execution."""
    fragment_id: str | None = None
    delta_path: tuple[int, ...] | None = None
    in_fragment_callback: bool = False
    active_script_hash: str = ""
```

`in_cached_function` remains a `ContextVar` (it's also used outside fragments). The
other per-thread fields move here, making `_dispatch_parallel_fragment` explicit:
create a `FragmentThreadState`, pass it to the worker thread, done — no reliance on
`copy_context()` correctly copying the right fields. This can land with the parallel
fragment coordinator integration.

**Migration path:** callers that access `ctx.widget_ids_this_run` change to
`ctx.shared.add_widget_id()`. Callers that access `ctx.current_fragment_id` change to
`ctx.thread_state.fragment_id`. The restructuring can happen incrementally —
`SharedRunState` and `FragmentThreadState` can land in separate PRs.

### API restrictions during parallel execution

Most Streamlit APIs are safe during parallel execution either inherently (normal
element rendering via the cursor/delta pipeline) or through synchronization added in
this feature (shared sets, `ForwardMsgQueue`, `PagesManager`). Execution control
commands (`st.rerun`, `st.stop`) are handled by the cooperative cancellation mechanism
(see [Cooperative cancellation](#4-cooperative-cancellation-for-ststop-and-strerun)).

The APIs below require explicit restrictions because they have structural side effects
that are disruptive or nonsensical during concurrent execution and cannot be addressed
by locking alone. All follow the same pattern: **prohibited during the parallel batch**
(worker threads), **allowed during sequential fragment reruns** (single-threaded). The
implementation can use the same detection mechanism — checking whether the current
thread is a parallel fragment worker (e.g., via
`ctx.parallel_coordinator.is_active()` combined with
`threading.current_thread() != main_thread`, or via a per-thread flag set by
`_dispatch_parallel_fragment`).

#### Dialogs (`@st.dialog`)

Dialogs require special handling because they need the one-dialog-at-a-time invariant
but should not be blanket-prohibited for all fragments declared with `parallel=True`.

**Two execution contexts for parallel fragments:**

1. **Initial parallel run** — the fragment body runs concurrently with other parallel
   fragments on worker threads during the initial script execution. Multiple threads are
   active; `ctx.parallel_coordinator` is active.
2. **Fragment rerun** — a UI interaction (button click, row selection, etc.) triggers a
   rerun of a single fragment. This runs sequentially on the script thread via the
   existing `fragment_id_queue` loop. No concurrency.

Per [reviewer feedback](https://github.com/streamlit/streamlit/pull/14277#discussion_r2917217279),
opening a dialog from a fragment rerun is a common and valid pattern (e.g., a button
in a dashboard card opens a detail dialog). Blocking this would be overly restrictive.

**Implementation:** the dialog guard in `_check_dialog_guard`
(`lib/streamlit/elements/lib/dialog.py`) should raise `StreamlitAPIException` during
the parallel batch. During sequential fragment reruns, the existing
`has_dialog_opened` check (one dialog per rerun) still applies unchanged. No
synchronization is needed on `has_dialog_opened` itself — it is only read/written
during sequential execution.

#### Page navigation (`st.switch_page`)

`st.switch_page` mutates query params, requests a rerun with a new page hash, and
forces a yield point — effectively cancelling all parallel threads mid-execution to
navigate to a different page. During a parallel batch, this is disruptive: even a
single fragment navigating would abort all other fragments, and multiple fragments
navigating simultaneously would race on the destination page.

During a sequential fragment rerun, `st.switch_page` is a valid and common pattern
(e.g., a button in a dashboard card navigates to a detail page).

**Implementation:** add a parallel-batch check in `switch_page`
(`lib/streamlit/commands/execution_control.py`). No existing guard exists today — the
function has no fragment awareness. The check should raise `StreamlitAPIException`
during the parallel batch.
