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
`ParallelFragmentCoordinator` class. A fresh coordinator is created in `ctx.reset()`
at the start of each script run (before `exec()`, so before any worker threads exist)
and stored on `ctx`. `reset()` is guarded to only run on the main script thread —
calling it from a worker thread raises `RuntimeError`:

```python
# In ctx.reset(), called once per script run on the main thread:
def reset(self, ...) -> None:
    # NEW: enforce that reset() is only called from the main script thread
    if threading.get_ident() != self._main_thread_ident:
        raise RuntimeError("reset() must only be called from the main script thread")
    ...
    # NEW: create a fresh coordinator (with thread pool) for this script run
    self.parallel_coordinator = ParallelFragmentCoordinator(
        yield_check=self._yield_check,
        max_workers=config.get_option("runner.parallelMaxWorkers"),
    )
```

The coordinator receives a `yield_check` callback from the `ScriptRunner` — this is a
reference to `_maybe_handle_execution_control_request()`, which checks for pending
RERUN/STOP requests and raises the appropriate exception.

**Thread pool scope and lifecycle:** The coordinator owns a `ThreadPoolExecutor` that
lives for the duration of a single script run. The pool is created in `ctx.reset()`
(via the coordinator constructor) and shut down in `drain()` or after `join()` completes.
No threads outlive the run — this matches the bounded lifecycle of parallel fragments
(spawned during `exec()`, joined before `scriptFinished`). Features with longer-lived
threads (e.g., a future `st.background_task()` that survives reruns) would need a
separate per-session pool with a different lifecycle.

The default `max_workers` follows Python's `ThreadPoolExecutor` default
(`min(32, os.cpu_count() + 4)`), which works well for the common case of 3-10
I/O-bound fragments. A Streamlit config option (`[runner] parallelMaxWorkers`) allows
overriding for constrained environments. When the number of parallel fragments exceeds
`max_workers`, excess fragments queue in the pool and execute as workers become available.

```python
class ParallelFragmentCoordinator:
    def __init__(
        self,
        yield_check: Callable[[], None],
        max_workers: int | None = None,
        poll_interval: float = 0.1,
    ) -> None:
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._outstanding = 0  # tracks in-flight work units (inc on submit, dec on completion)
        self._outstanding_lock = threading.Lock()
        self._stop_event = threading.Event()
        self._worker_exception: RerunException | StopException | None = None
        self._exception_lock = threading.Lock()
        self._yield_check = yield_check
        self._poll_interval = poll_interval

    def submit(
        self,
        fn: Callable[..., Any],
        *args: Any,
    ) -> None:
        """Submit a fragment to the thread pool. Can be called from any
        thread (main thread or worker threads for nested fragments)."""
        with self._outstanding_lock:
            self._outstanding += 1

        def tracked() -> None:
            # Wraps fn so the counter decrements when the work completes.
            # The decrement is in `finally` so it runs even if fn raises.
            # For nested fragments, fn's body calls submit() (incrementing
            # the counter) before returning, so a parent's decrement always
            # happens after its children's increments — the counter never
            # hits 0 prematurely.
            try:
                fn(*args)
            finally:
                with self._outstanding_lock:
                    self._outstanding -= 1

        self._executor.submit(tracked)

    def request_stop(self) -> None:
        """A worker called st.stop(). First writer wins."""
        with self._exception_lock:
            if self._worker_exception is None:
                self._worker_exception = StopException()
        self._stop_event.set()

    def request_rerun(self, exc: RerunException) -> None:
        """A worker called st.rerun(scope='app'). First writer wins."""
        with self._exception_lock:
            if self._worker_exception is None:
                self._worker_exception = exc
        self._stop_event.set()

    def should_stop(self) -> bool:
        """Check whether this thread should exit."""
        return self._stop_event.is_set()

    @property
    def worker_exception(self) -> RerunException | StopException | None:
        return self._worker_exception

    def join(self) -> None:
        """Happy-path join. Blocks until all submitted work completes,
        including work submitted by workers (nested parallel fragments).
        Responsive to external requests (via yield_check) and
        worker-initiated cancellation (via worker_exception)."""
        while True:
            with self._outstanding_lock:
                if self._outstanding == 0:
                    break
            self._yield_check()
            if self._worker_exception is not None:
                raise self._worker_exception
            time.sleep(self._poll_interval)
        if self._worker_exception is not None:
            raise self._worker_exception
        self._executor.shutdown(wait=False)

    def drain(self) -> None:
        """Cleanup join after cancellation. Signals workers to stop and
        shuts down the pool. Safe to call from except blocks."""
        self._stop_event.set()
        self._executor.shutdown(wait=True, cancel_futures=True)
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
    _dispatch_parallel_fragment(ctx, fragment_id, wrapped_fragment)
    return None
else:
    return wrapped_fragment()
```

`_dispatch_parallel_fragment` is a new helper in `fragment.py` that copies the current
context and submits the fragment to the coordinator's thread pool:

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
    coordinator = ctx.parallel_coordinator

    def worker() -> None:
        # Propagate ScriptRunContext to the pool thread (thread-local)
        add_script_run_ctx(threading.current_thread(), ctx)
        _run_parallel_fragment(
            coordinator, wrapped_fragment, fragment_id, parent_context,
        )

    coordinator.submit(worker)
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
It runs `wrapped_fragment` inside the copied context and handles control flow exceptions:

```python
def _run_parallel_fragment(
    coordinator: ParallelFragmentCoordinator,
    wrapped_fragment: Callable[[], Any],
    fragment_id: str,
    parent_context: contextvars.Context,
) -> None:
    def run_fragment() -> None:
        # Set per-thread state inside parent_context.run() so it's
        # scoped to this context copy, not the pool thread's default
        _thread_state.set(FragmentThreadState(
            fragment_id=fragment_id,
            is_parallel_worker=True,
        ))
        try:
            wrapped_fragment()
        except RerunException as e:
            # st.rerun(scope="app") — signal sibling threads to stop
            # and preserve the RerunException for the main thread.
            #
            # Note: st.rerun(scope="fragment") raises StreamlitAPIException
            # before reaching this point (the existing guard in
            # _new_fragment_id_queue rejects fragment-scoped reruns during
            # full-app runs, and parallel fragments only run in threads
            # during full-app runs). See "Prohibited / error cases" below.
            coordinator.request_rerun(e)
        except StopException:
            # st.stop() — signal sibling threads to stop
            coordinator.request_stop()
        except FragmentHandledException:
            pass  # error already rendered in the fragment's container
                  # by wrapped_fragment() — existing behavior
        except Exception as e:
            handle_uncaught_app_exception(e)

    parent_context.run(run_fragment)
```

**`st.rerun(scope="fragment")` during the initial full-app run:** The existing guard
in `_new_fragment_id_queue()` raises `StreamlitAPIException` when
`fragment_ids_this_run` is empty (which it is during full-app runs). This behavior
is preserved for parallel fragments — the guard fires before a `RerunException` is
ever raised, so `_run_parallel_fragment` never sees it. During fragment reruns,
parallel fragments run sequentially (see above), so the existing while loop in
`wrapped_fragment()` handles `st.rerun(scope="fragment")` as it does today.

**When an external full-app rerun arrives** (e.g., widget interaction while fragments
are still running):

This can happen at two points:

1. **While the main script is still executing.** The existing yield point mechanism
   fires at the next `st.*` call on the script thread, raises `RerunException`, and
   `exec()` exits. This falls into the `except` block below, which calls
   `coordinator.drain()` to signal workers to stop and wait for them to exit.

2. **During the join barrier** (script has finished, waiting for threads). The script
   thread isn't calling `st.*`, so `coordinator.join()` calls `self._yield_check()`
   on each poll interval. If a RERUN/STOP request has arrived, the yield check raises
   `RerunException` or `StopException`, breaking out of the join loop into the
   `except` block.

In both cases, worker threads must be stopped before the rerun can proceed. The
`except` block calls `drain()`, which sets the stop event and joins threads directly
— no yield check loop, so no risk of recursive exceptions:

```python
# In code_to_exec():
try:
    exec(code, module.__dict__)
    ctx.parallel_coordinator.join()
    self._fragment_storage.clear(new_fragment_ids=ctx.new_fragment_ids)  # existing
except (RerunException, StopException):
    ctx.parallel_coordinator.drain()  # signal workers to stop, wait without yield-checking
    raise  # propagate so _run_script's rerun loop can restart
```

**How sibling threads and the main thread observe the cancellation:**

Every `st.*` call goes through `_enqueue_forward_msg()` →
`_maybe_handle_execution_control_request()` in `script_runner.py`. This function acts
as a yield point — it checks for pending RERUN/STOP requests and raises the appropriate
exception. Today it guards with `_is_in_script_thread()` and returns early for
non-script threads. We extend it to check the coordinator's stop event for worker
threads, and the `worker_exception` for the main thread:

```python
def _maybe_handle_execution_control_request(self) -> None:
    if not self._is_in_script_thread():
        # Worker thread — check coordinator stop event
        ctx = get_script_run_ctx()
        if ctx and ctx.parallel_coordinator.should_stop():
            raise StopException()  # unwinds this thread's call stack
        return

    if not self._execing:
        return

    # NEW: check if a worker requested cancellation — propagate with
    # the correct exception type (StopException or RerunException)
    ctx = self._get_script_run_ctx()
    exc = ctx.parallel_coordinator.worker_exception
    if exc is not None:
        raise exc

    # ... existing request checking logic (unchanged) ...
```

For worker threads, the `StopException` propagates up into `_run_parallel_fragment`,
is caught in the `while` loop, and the thread exits. For the main script thread,
the worker's original exception (preserving `RerunException` vs `StopException`)
propagates up through `exec()` into the `except` block in `code_to_exec`,
which drains remaining threads and re-raises.

A thread blocked on a long I/O call (e.g., a slow database query) will not terminate
until the call returns and the thread reaches its next yield point. This is inherent to
Python threading and should be documented. Users can insert `st.yield_point()` calls
between blocking operations to improve cancellation responsiveness (see
[#14523](https://github.com/streamlit/streamlit/issues/14523)).

**Summary of cancellation scenarios:**

| Scenario | Trigger | Calling thread | Siblings + main thread | Outcome |
|----------|---------|---------------|----------------------|---------|
| Happy path | — | — | — | All threads complete → `join()` returns → `scriptFinished` |
| `st.rerun(scope="fragment")` | Thread A | `StreamlitAPIException` — same as sequential fragments during full-app runs | Unaffected | Error rendered in fragment container |
| `st.stop()` | Thread A | Caught → `request_stop()` → exits | See `should_stop()` at next yield point → `StopException` → exit | Main thread raises `StopException` → run ends |
| `st.rerun(scope="app")` | Thread A | Caught → `request_rerun(e)` → exits | See `should_stop()` at next yield point → `StopException` → exit | Main thread raises `RerunException` (with rerun data) → `_run_script` restarts |
| External rerun during `exec()` | Frontend | Main thread: `RerunException` at next `st.*` call → `except` block → `drain()` | See `should_stop()` at next yield point → exit | `_run_script` restarts |
| External rerun during `join()` | Frontend | `_yield_check()` raises `RerunException` → `except` block → `drain()` | See `should_stop()` at next yield point → exit | `_run_script` restarts |

### Content rendering

This section covers the full path from element creation to browser rendering:
cursor assignment, element registration, message delivery (cached message dedup,
queuing, yield point check), delta ordering, element cleanup, and loading UX.

#### Cursor API and thread-safe rendering

Streamlit's element tree assumes elements along the main trunk arrive in order.
Content from a parallel thread must be written to a branch — a container on the
main thread that the worker thread renders into.

Today, `RunningCursor` has a single method — `get_locked_cursor()` — that serves
two distinct purposes: reserving a slot for an element (returning a `LockedCursor`
the caller keeps) and advancing the parent cursor when a block is created (the
returned `LockedCursor` is discarded). With threading, this conflation becomes a
problem: `copy_context()` shallow-copies the `context_dg_stack` ContextVar binding,
so DG and cursor objects are shared by reference. Two threads calling
`get_locked_cursor()` on the same cursor would race on `_index`.

The design has three parts:

**1. Clarify the `RunningCursor` API.** Replace the single `get_locked_cursor()`
with two methods that match the two use cases, plus shared internal logic:

```python
class RunningCursor(Cursor):
    def __init__(self, ...):
        self._index = 0
        self._owner_ident: int | None = None  # claimed on first use
        self._owner_lock = threading.Lock()

    def _check_owner(self) -> None:
        with self._owner_lock:
            current_ident = threading.get_ident()
            if self._owner_ident is None:
                self._owner_ident = current_ident
            elif self._owner_ident != current_ident:
                raise RuntimeError(
                    "Cursor accessed from a thread that doesn't own it"
                )

    def _advance(self) -> None:
        self._index += 1
        self._transient_index = None
        self._transient_elements = SparseList[Element]()

    def lock_element(self, **props) -> LockedCursor:
        """Reserve the current position for an element and advance."""
        self._check_owner()
        locked = LockedCursor(
            root_container=self._root_container,
            parent_path=self._parent_path,
            index=self._index,
            **props,
        )
        self._advance()
        return locked

    def open_block(self) -> RunningCursor:
        """Create a child cursor for a new block and advance."""
        self._check_owner()
        child = RunningCursor(
            root_container=self._root_container,
            parent_path=(*self._parent_path, self._index),
        )
        self._advance()
        return child
```

`DeltaGenerator._enqueue()` calls `lock_element()` (elements); `DeltaGenerator._block()`
calls `open_block()` (containers). `get_locked_cursor()` is a purely internal API
(only called in `delta_generator.py`) so it can be replaced directly.

**2. Pre-create the container on the main thread.** In `wrap()`, the main thread
calls `st.container()` before dispatching. This calls `open_block()` on the main
thread's cursor, which advances it past the fragment's slot and creates a child
`RunningCursor` for the container. The container delta reaches the frontend
immediately. The child cursor starts with
`_owner_thread = None` — it hasn't been used yet.

The pre-creation step **must** use `st.container()` rather than a raw
`Block_pb2()` — the frontend's `addBlock` reconciliation resets a
`BlockNode`'s children when the incoming Block's `oneof type` changes,
so the main-thread delta and worker-thread delta must carry the same type.
To avoid a duplicate container delta, dispatch stores the fragment id in
`FragmentThreadState.pre_allocated_container_fragment_id` and the worker's
`wrapped_fragment` reads-and-clears it on entry, skipping its own
`st.container()` call. Nested `@st.fragment` calls see `None` and create
their containers normally.

**3. Lazy thread ownership.** When the worker thread runs and calls `lock_element()`
on the container's cursor for the first time, `_check_owner()` claims it — setting
`_owner_ident` to the worker thread's ID via `threading.get_ident()`. The
check-and-claim is wrapped in a `threading.Lock` to make it atomic, preventing a
TOCTOU race where two threads could both read `_owner_ident` as `None` and both
succeed. From that point, any other thread accessing that cursor gets an immediate
`RuntimeError`. This enforces the invariant without requiring explicit ownership
transfer: the main thread creates the cursor but never uses it; the worker thread
claims it on first use. Using `get_ident()` (an int) rather than `current_thread()`
(a Thread object) avoids the dictionary lookup overhead on every `st.*` call.

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
   and other `ScriptRunContext` fields should be made formally immutable.)

2. **`ScriptRunner._enqueue_forward_msg()`** — calls
   `_maybe_handle_execution_control_request()` (the yield point check — see
   [Cooperative cancellation](#4-cooperative-cancellation-for-ststop-and-strerun)), then
   passes the message to `ForwardMsgQueue`. For user code that doesn't call `st.*`
   commands in tight loops, `st.yield_point()` provides an explicit yield point without
   emitting a delta (see [#14523](https://github.com/streamlit/streamlit/issues/14523)).

**`ForwardMsgQueue` — already safe via event loop serialization:** The queue is
not internally thread-safe (`threading.Lock` was [removed in
PR #4568](https://github.com/streamlit/streamlit/pull/4568)), but all access
is serialized through `call_soon_threadsafe` onto the server's asyncio event loop thread.
No changes are needed for parallel fragments.

The enqueue path is the same for both the main script thread and parallel
fragment worker threads:

```
st.text("hello")                               (on script thread or worker thread)
  → ctx.enqueue(msg)                           script_run_context.py
    → ScriptRunner._enqueue_forward_msg(msg)   script_runner.py — yield point check
      → on_event.send(ENQUEUE_FORWARD_MSG)     blinker signal, fires synchronously
        → AppSession._on_scriptrunner_event    still on the calling thread
          → call_soon_threadsafe(callback)     schedules onto event loop, returns immediately
                                                ──→ event loop thread picks up callback
                                                    → _browser_queue.enqueue(msg)
```

The key hop is `call_soon_threadsafe`: it pushes a callback onto the event
loop's queue and returns immediately — the calling thread never blocks. The
server's asyncio event loop thread processes callbacks one at a time, so
`_browser_queue.enqueue()` is only ever called from a single thread.

```python
# AppSession._on_scriptrunner_event (called on the script/worker thread):
def _on_scriptrunner_event(self, sender, event, forward_msg=None, ...):
    """Called from the ScriptRunner's script thread.
    Forwards to the event loop thread."""
    self._event_loop.call_soon_threadsafe(
        lambda: self._handle_scriptrunner_event_on_event_loop(
            sender, event, forward_msg, ...
        )
    )

# _handle_scriptrunner_event_on_event_loop (called on the event loop thread):
def _handle_scriptrunner_event_on_event_loop(self, sender, event, ...):
    # ... (checks sender is current ScriptRunner) ...
    if event == ScriptRunnerEvent.ENQUEUE_FORWARD_MSG:
        self._enqueue_forward_msg(forward_msg)  # → _browser_queue.enqueue()
```

This pattern was introduced for fast reruns (where multiple ScriptRunners
may be active simultaneously, each on its own thread) and extends naturally
to parallel fragment threads: multiple worker threads calling `ctx.enqueue()`
each schedule an event loop callback, and the event loop processes them
sequentially. No lock is needed.

Adding a `threading.Lock` directly to the queue — so that worker threads
could bypass `call_soon_threadsafe` and enqueue deltas directly — is a
potential future optimization but is not required for correctness. The
bottleneck for parallel fragments is I/O and computation (HTTP requests,
database queries, data processing), not the delta delivery path. The event
loop serialization adds microseconds of overhead per `st.*` call, which is
negligible compared to the millisecond-to-second cost of actual fragment work.

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

    # 4. Per-thread fragment state — via ContextVar
    #    See _thread_state ContextVar below.

    def __post_init__(self):
        self._main_thread_ident = threading.get_ident()

    def reset(self, ...) -> None:
        """Re-initialize mutable state for a new script run.
        Must only be called from the main script thread."""
        if threading.get_ident() != self._main_thread_ident:
            raise RuntimeError(
                "reset() must only be called from the main script thread"
            )
        self.shared.reset(...)
        _thread_state.set(FragmentThreadState())
        self.parallel_coordinator = ParallelFragmentCoordinator(
            yield_check=self._yield_check,
            max_workers=config.get_option("runner.parallelMaxWorkers"),
        )

    def enqueue(self, msg: ForwardMsg) -> None:
        """Enqueue a ForwardMsg, substituting a cached ref if possible."""
        ...
        self._enqueue(msg_to_send)
```

Adding a new field forces an explicit decision: does it go on `FragmentThreadState`
(per-thread via `ContextVar`, no sync needed), `SharedRunState` (shared, sync built-in),
one of the externally thread-safe objects, or the immutable config? The following sections
describe each category.

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

**`PagesManager`** has no internal locking today. `st.navigation` performs a
compound write-then-read (`set_pages()` followed by `get_page_script()`),
and `st.switch_page` reads pages then writes the current page hash. With
concurrent callers these could interleave.

Add `threading.Lock` internally and refactor the API to eliminate exposed
get/set pairs that are unsafe to call independently under concurrency:

```python
class PagesManager:
    def __init__(self, ...):
        self._lock = threading.Lock()
        self._pages: dict[PageHash, PageInfo] | None = None
        self._current_page_script_hash: PageHash = ""
        # Move from class-level to instance attribute
        self._uses_pages_directory: bool = Path(...).exists()
        ...

    def set_pages_and_resolve(
        self,
        pages: dict[PageHash, PageInfo],
        fallback_page_hash: PageHash = "",
    ) -> PageInfo | None:
        """Atomically set the page registry and resolve the current page.
        Replaces the separate set_pages() + get_page_script() calls."""
        with self._lock:
            self._pages = pages
            return self._resolve_page_script(fallback_page_hash)

    def get_pages(self) -> dict[PageHash, PageInfo]:
        """Return a snapshot of the current page registry.
        Lock-protected for free-threaded Python (PEP 703) where
        iterating a dict during concurrent mutation is unsafe."""
        with self._lock:
            return dict(self._pages) if self._pages else {
                self.main_script_hash: { ... }
            }

    def set_current_page_script_hash(self, h: PageHash) -> None:
        """No lock needed — standalone write, not read by
        set_pages_and_resolve() or any compound operation."""
        self._current_page_script_hash = h

    def _resolve_page_script(self, fallback: PageHash) -> PageInfo | None:
        """Internal resolver — caller must hold self._lock."""
        ...  # existing get_page_script() logic

    # set_pages() removed from public API — only used via set_pages_and_resolve()
    # get_page_script() made private as _resolve_page_script()
```

Callers change as follows:

```python
# st.navigation (before):
ctx.pages_manager.set_pages(pagehash_to_pageinfo)
found_page = ctx.pages_manager.get_page_script(fallback_page_hash=...)

# st.navigation (after):
found_page = ctx.pages_manager.set_pages_and_resolve(
    pagehash_to_pageinfo, fallback_page_hash=...
)

# st.switch_page — get_pages() is a standalone read, no change needed:
all_app_pages = ctx.pages_manager.get_pages().values()
```

The class-level `uses_pages_directory` flag is moved to an instance
attribute (`self._uses_pages_directory`) since it is session-scoped state,
not process-wide.

**`FragmentStorage`** (`MemoryFragmentStorage`) wraps a plain `dict` with no
locking. Rename and lock-protect to clarify intent — these are independent
operations used in different phases, not a compound get/set pair:

```python
class MemoryFragmentStorage(FragmentStorage):
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._fragments: dict[str, Fragment] = {}

    def register(self, key: str, fragment: Fragment) -> None:
        """Store a fragment definition. Called during script execution
        from the main thread or worker threads (nested fragments).
        Lock-protected — concurrent registration is the only mutation
        that can overlap."""
        with self._lock:
            self._fragments[key] = fragment

    def lookup(self, key: str) -> Fragment:
        """Look up a fragment to re-execute. Called during fragment
        reruns, which are sequential — no concurrent writers."""
        return self._fragments[key]

    def clear(self, new_fragment_ids: set[str] | None = None) -> None:
        """Remove orphaned fragments. Lock-protected to guard against
        a register()/clear() race if ordering invariants change."""
        with self._lock:
            ...
```

`register()` and `clear()` share the lock to protect against concurrent
dict mutation. `lookup()` doesn't need a lock — the only possible race
would be a get/set pattern, which doesn't apply here since registration
and lookup are independent operations in separate phases.

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
        self._widget_ids: set[str] = set()
        self._widget_user_keys: set[str] = set()
        self._form_ids: set[str] = set()
        self._new_fragment_ids: set[str] = set()
        self._tracked_commands: list[Command] = []
        self._tracked_commands_counter: Counter[str] = Counter()

    def add_widget_id(self, widget_id: str) -> bool:
        """Atomically add widget ID. Returns True if the value was new."""
        with self._lock:
            is_new = widget_id not in self._widget_ids
            self._widget_ids.add(widget_id)
            return is_new
    # ... similar methods for other fields
```

The thread-safe shared sets spec defines the per-field wrapper APIs (`ThreadSafeStrSet`,
`ThreadSafeTelemetry`). `SharedRunState` is the container that composes them. This can
land with the thread-safe shared sets work.

#### `FragmentThreadState` — per-thread fragment state

Bundles per-thread fields into a dataclass, stored in a `ContextVar` so that each
thread gets automatic isolation via `copy_context()`:

```python
_thread_state: ContextVar[FragmentThreadState] = ContextVar(
    "thread_state", default=FragmentThreadState(),
)

@dataclass
class FragmentThreadState:
    """Per-thread state for a fragment execution."""
    fragment_id: str | None = None
    delta_path: tuple[int, ...] | None = None
    in_fragment_callback: bool = False
    active_script_hash: str = ""
    is_parallel_worker: bool = False
    # Signals ``wrapped_fragment`` to skip its own ``st.container()`` call
    # because the container was already pre-allocated on the main thread.
    # Read-and-cleared on entry so nested fragments are unaffected.
    pre_allocated_container_fragment_id: str | None = None
```

This uses the same `ContextVar` + `copy_context()` mechanism already used for
`context_dg_stack` and `in_cached_function`. When `_dispatch_parallel_fragment`
calls `contextvars.copy_context()`, the snapshot includes the current
`_thread_state` binding. The worker then sets a fresh instance via
`_thread_state.set(FragmentThreadState(...))` inside `parent_context.run()`,
which is scoped to that thread's context — the main thread's binding is unaffected.

`in_cached_function` remains a separate `ContextVar` (it's also used outside
fragments and predates this design).

Callers change from bare field access (e.g. `ctx.widget_ids_this_run.add()`,
`ctx.current_fragment_id`) to `ctx.shared.add_widget_id()` for shared state
and `_thread_state.get().fragment_id` for per-thread state.

### API restrictions during parallel execution

Most Streamlit APIs are safe during parallel execution either inherently (normal
element rendering via the cursor/delta pipeline) or through synchronization added in
this feature (shared sets, `ForwardMsgQueue`, `PagesManager`). Execution control
commands (`st.rerun`, `st.stop`) are handled by the cooperative cancellation mechanism
(see [Cooperative cancellation](#4-cooperative-cancellation-for-ststop-and-strerun)).

The APIs below require explicit restrictions because they have structural side effects
that are disruptive or nonsensical during concurrent execution and cannot be addressed
by locking alone. All follow the same pattern: **prohibited during the parallel batch**
(worker threads), **allowed during sequential fragment reruns** (single-threaded).

Detection uses the `is_parallel_worker` flag on `FragmentThreadState`, set in
`_run_parallel_fragment` when the worker's context is initialized:

```python
def _check_not_parallel_worker(api_name: str) -> None:
    if _thread_state.get().is_parallel_worker:
        raise StreamlitAPIException(
            f"{api_name} cannot be called from a parallel fragment."
        )
```

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

**Implementation:** add a parallel worker check to `_check_dialog_guard`
(`lib/streamlit/elements/lib/dialog.py`):

```python
def _check_dialog_guard(should_open: bool) -> None:
    ctx = get_script_run_ctx()
    if should_open and ctx:
        _check_not_parallel_worker("@st.dialog")
        # Existing one-dialog-per-rerun check (unchanged, only runs
        # during sequential execution so no synchronization needed)
        if ctx.has_dialog_opened:
            raise StreamlitAPIException(...)
        ctx.has_dialog_opened = True
```

#### Page navigation (`st.switch_page`)

`st.switch_page` mutates query params, requests a rerun with a new page hash, and
forces a yield point — effectively cancelling all parallel threads mid-execution to
navigate to a different page. During a parallel batch, this is disruptive: even a
single fragment navigating would abort all other fragments, and multiple fragments
navigating simultaneously would race on the destination page.

During a sequential fragment rerun, `st.switch_page` is a valid and common pattern
(e.g., a button in a dashboard card navigates to a detail page).

**Implementation:** add a parallel worker check at the top of `switch_page`
(`lib/streamlit/commands/execution_control.py`):

```python
def switch_page(page: str | Path | StreamlitPage, ...) -> NoReturn:
    ctx = get_script_run_ctx()
    if ctx:
        _check_not_parallel_worker("st.switch_page")
    # ... existing implementation
```

#### External container writes

Non-parallel fragments can write non-widget elements to containers outside the
fragment's delta path (e.g., a parent-scoped `st.container()` or `st.sidebar`
entered via `with`). These writes are allowed but accumulate across fragment reruns
until the next full app rerun — a documented caveat.

During parallel execution, external container writes introduce three problems that
cannot be solved by the existing cursor ownership model alone:

1. **Cursor races.** External containers share a `RunningCursor` with the main thread
   (or other workers). `_check_owner()` would crash with `RuntimeError` if a second
   thread touches the same cursor — a correct safety net, but the error message is
   opaque and unhelpful to users.

2. **Non-deterministic ordering.** Even if cursor access were serialized (e.g., via a
   per-cursor lock), the order of elements written by different workers depends on
   thread scheduling. The UI layout would vary between runs with identical inputs.

3. **Amplified accumulation.** The existing accumulation behavior (elements pile up
   until a full rerun) is already surprising for sequential fragments. With concurrent
   writers producing interleaved, duplicated content in unpredictable order, the
   external container becomes unusable.

**Implementation:** extend the existing `check_fragment_path_policy` pattern to block
all element writes (not just widgets) when the writer is a parallel worker. Add a
check in `_enqueue` (`lib/streamlit/delta_generator.py`) that compares the target
cursor's `delta_path` against `current_fragment_delta_path` when
`_thread_state.get().is_parallel_worker` is True:

```python
def _enqueue(self, ...):
    dg = self._active_dg

    ctx = get_script_run_ctx()

    # Existing sidebar guard (unchanged)
    if ctx and ctx.current_fragment_id and _writes_directly_to_sidebar(dg):
        raise StreamlitAPIException(...)

    # Block all external container writes from parallel workers
    if ctx and _thread_state.get().is_parallel_worker:
        fragment_path = ctx.current_fragment_delta_path
        cursor_path = dg._cursor.delta_path if dg._cursor else []
        if not _is_inside_fragment_path(cursor_path, fragment_path):
            raise StreamlitAPIException(
                "Writing to containers outside the fragment is not supported "
                "during parallel execution. Move the element inside the "
                "fragment body, or write to the external container during a "
                "sequential fragment rerun."
            )

    # ... rest of _enqueue
```

The `_is_inside_fragment_path` helper applies the same prefix-matching logic as
`check_fragment_path_policy`: the cursor's delta path must be at least as long as the
fragment path, and all indices must match at each position.

During sequential fragment reruns (`is_parallel_worker` is False), the existing
behavior is unchanged: non-widget elements are allowed in external containers, widgets
are blocked by `check_fragment_path_policy`.
