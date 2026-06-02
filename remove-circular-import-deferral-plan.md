# Remove Circular Import Deferral Plan

## Background

### The Import Cycle

The `parallel_coordinator.py` module has a circular import dependency with `script_run_context.py`:

1. **`parallel_coordinator.py` imports from `script_run_context.py`** (lines 37-41):
   - `SCRIPT_RUN_CONTEXT_ATTR_NAME` — used by `_scoped_ctx_attach()` helper
   - `ScriptRunContext` — TYPE_CHECKING only
   - `get_script_run_ctx` — called inside `submit()` to capture the caller's context

2. **`script_run_context.py` has a deferred import of `parallel_coordinator`** (lines 277-284):
   - Inside the `reset()` method, it imports `ParallelFragmentCoordinator` at runtime
   - This is required because importing at module level would create a circular import error

### Why This Exists

The coordinator needs access to `ScriptRunContext` to propagate the caller's context to worker threads. Currently, `submit()` calls `get_script_run_ctx()` internally to capture this context at submit time. However, `script_run_context.py` also needs to create a `ParallelFragmentCoordinator` instance in `reset()`, creating the cycle.

### Why Removing It Is Worthwhile

- **Code clarity**: Deferred imports inside function bodies are non-obvious and make dependency relationships harder to trace
- **Startup performance**: Module-level imports are resolved once at startup; deferred imports add overhead on every `reset()` call
- **Explicit dependencies**: Having the caller pass `ctx` makes the data flow explicit rather than relying on thread-local magic
- **Testability**: Tests can more easily control the `ctx` passed to workers without setting up thread-local state

## Current State

### Import Chain with File Paths and Line References

```
lib/streamlit/runtime/parallel_coordinator.py
├── Line 37-41: from streamlit.runtime.scriptrunner_utils.script_run_context import (
│       SCRIPT_RUN_CONTEXT_ATTR_NAME,
│       ScriptRunContext,        # TYPE_CHECKING only
│       get_script_run_ctx,
│   )
│
└── Line 122 (in submit()): ctx = get_script_run_ctx()

lib/streamlit/runtime/scriptrunner_utils/script_run_context.py
├── Line 53: from streamlit.runtime.parallel_coordinator import ParallelFragmentCoordinator  # TYPE_CHECKING
│
└── Lines 277-284 (in reset()):
        # Deferred to avoid circular import: parallel_coordinator imports
        # ScriptRunContext and get_script_run_ctx from this module.
        from streamlit import config
        from streamlit.runtime.parallel_coordinator import ParallelFragmentCoordinator

        self.parallel_coordinator = ParallelFragmentCoordinator(
            yield_check=yield_check,
            max_workers=config.get_option("runner.parallelMaxWorkers"),
        )
```

### Current `submit()` Signature (parallel_coordinator.py, lines 106-143)

```python
def submit(self, fn: Callable[..., Any], *args: Any) -> None:
    """Submit a worker function to the thread pool.

    Captures the caller's ``ScriptRunContext`` (thread attribute) and the
    caller's full ``contextvars.Context`` (which includes ``FragmentThreadState``)
    at submit time.  The worker runs inside ``copy_context().run(...)`` with a
    scoped ctx attach so ``get_script_run_ctx()`` and ``ThreadState.get()``
    return the parent's values for the duration of the call.
    ...
    """
    ctx = get_script_run_ctx()  # <-- Calls into script_run_context.py
    captured = contextvars.copy_context()
    ...
```

### Current Call Site (fragment.py, lines 697-713)

```python
def _dispatch_parallel_fragment(
    ctx: ScriptRunContext,
    fragment_id: str,
    wrapped_fragment: Callable[[], Any],
) -> None:
    ...
    coordinator = ctx.parallel_coordinator
    ...
    coordinator.submit(
        _run_parallel_fragment,
        fragment_id,
        wrapped_fragment,
        dg_stack_with_container,
    )
```

Note: `_dispatch_parallel_fragment` already has `ctx` as a parameter.

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `lib/streamlit/runtime/parallel_coordinator.py` | Modify | Change `submit()` to accept `ctx` parameter; remove `get_script_run_ctx` import |
| `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py` | Modify | Move `ParallelFragmentCoordinator` import to module level; remove deferred import |
| `lib/streamlit/runtime/fragment.py` | Modify | Update `coordinator.submit()` call to pass `ctx` |
| `lib/tests/streamlit/runtime/parallel_fragment_coordinator_test.py` | Modify | Update all `submit()` calls to pass `ctx` parameter |

## Detailed Changes

### 1. `lib/streamlit/runtime/parallel_coordinator.py`

#### Before (lines 37-41)
```python
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    SCRIPT_RUN_CONTEXT_ATTR_NAME,
    ScriptRunContext,
    get_script_run_ctx,
)
```

#### After
```python
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    SCRIPT_RUN_CONTEXT_ATTR_NAME,
    ScriptRunContext,
)
```

#### Before (lines 106-123)
```python
def submit(self, fn: Callable[..., Any], *args: Any) -> None:
    """Submit a worker function to the thread pool.

    Captures the caller's ``ScriptRunContext`` (thread attribute) and the
    caller's full ``contextvars.Context`` (which includes ``FragmentThreadState``)
    at submit time.  The worker runs inside ``copy_context().run(...)`` with a
    scoped ctx attach so ``get_script_run_ctx()`` and ``ThreadState.get()``
    return the parent's values for the duration of the call.  Worker-side
    ``ThreadState.update()`` writes stay local to the captured copy — they
    never leak back to the parent thread.

    Increments the outstanding counter before submitting so a nested
    submit() from inside a running worker is visible to join() before
    the parent's tracked() decrement runs. May be called from any
    thread (main thread or worker threads for nested fragments).
    """
    ctx = get_script_run_ctx()
    captured = contextvars.copy_context()
    ...
```

#### After
```python
def submit(
    self,
    fn: Callable[..., Any],
    ctx: ScriptRunContext | None,
    *args: Any,
) -> None:
    """Submit a worker function to the thread pool.

    Parameters
    ----------
    fn : Callable[..., Any]
        The worker function to execute in the thread pool.
    ctx : ScriptRunContext | None
        The ScriptRunContext to propagate to the worker thread. The caller
        must provide this explicitly (typically obtained via ``get_script_run_ctx()``
        at the call site). Passing the context explicitly breaks the import cycle
        between this module and ``script_run_context.py``.
    *args : Any
        Positional arguments forwarded to ``fn``.

    The caller's full ``contextvars.Context`` (which includes ``FragmentThreadState``)
    is captured at submit time.  The worker runs inside ``copy_context().run(...)``
    with a scoped ctx attach so ``get_script_run_ctx()`` and ``ThreadState.get()``
    return the parent's values for the duration of the call.  Worker-side
    ``ThreadState.update()`` writes stay local to the captured copy — they
    never leak back to the parent thread.

    Increments the outstanding counter before submitting so a nested
    submit() from inside a running worker is visible to join() before
    the parent's tracked() decrement runs. May be called from any
    thread (main thread or worker threads for nested fragments).
    """
    captured = contextvars.copy_context()
    ...
```

#### Update module docstring (lines 15-23)

The module docstring currently explains why the module was separated to break the import cycle. After this change, update it to reflect that the cycle is fully resolved:

##### Before
```python
"""ParallelFragmentCoordinator and supporting helpers.

Separated from ``fragment.py`` to break the import cycle with
``script_run_context.py``: the coordinator imports from
``script_run_context`` (for ``get_script_run_ctx`` and
``SCRIPT_RUN_CONTEXT_ATTR_NAME``), and ``script_run_context`` needs to
construct a coordinator in ``reset()``.  With the coordinator in its own
module, ``script_run_context`` can import it at module level.
"""
```

##### After
```python
"""ParallelFragmentCoordinator and supporting helpers.

Separated from ``fragment.py`` to keep the parallel fragment coordination
logic self-contained. The coordinator receives the caller's ``ScriptRunContext``
explicitly via ``submit()``, avoiding any import cycle with ``script_run_context.py``.
"""
```

### 2. `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py`

#### Before (lines 53, 277-284)

TYPE_CHECKING import:
```python
if TYPE_CHECKING:
    ...
    from streamlit.runtime.parallel_coordinator import ParallelFragmentCoordinator
```

Deferred import in `reset()`:
```python
def reset(self, ...) -> None:
    ...
    # Deferred to avoid circular import: parallel_coordinator imports
    # ScriptRunContext and get_script_run_ctx from this module.
    from streamlit import config
    from streamlit.runtime.parallel_coordinator import ParallelFragmentCoordinator

    self.parallel_coordinator = ParallelFragmentCoordinator(
        yield_check=yield_check,
        max_workers=config.get_option("runner.parallelMaxWorkers"),
    )
```

#### After

Move to module-level import (after line 41):
```python
from streamlit import config
from streamlit.runtime.parallel_coordinator import ParallelFragmentCoordinator
```

Remove TYPE_CHECKING import (it's now a real import):
```python
if TYPE_CHECKING:
    ...
    # Remove: from streamlit.runtime.parallel_coordinator import ParallelFragmentCoordinator
```

Update `reset()` method:
```python
def reset(self, ...) -> None:
    ...
    # No deferred import needed — parallel_coordinator no longer imports
    # get_script_run_ctx from this module.
    self.parallel_coordinator = ParallelFragmentCoordinator(
        yield_check=yield_check,
        max_workers=config.get_option("runner.parallelMaxWorkers"),
    )
```

### 3. `lib/streamlit/runtime/fragment.py`

#### Before (lines 708-713)
```python
coordinator.submit(
    _run_parallel_fragment,
    fragment_id,
    wrapped_fragment,
    dg_stack_with_container,
)
```

#### After
```python
coordinator.submit(
    _run_parallel_fragment,
    ctx,  # Pass ctx explicitly
    fragment_id,
    wrapped_fragment,
    dg_stack_with_container,
)
```

### 4. `lib/tests/streamlit/runtime/parallel_fragment_coordinator_test.py`

All test calls to `coordinator.submit()` need to pass a `ctx` parameter. Since most tests don't actually need a real `ScriptRunContext` for the worker function being tested, they can pass `None` or a `MagicMock()`.

#### Example: test_submit_counter_round_trip (lines 111-120)

##### Before
```python
def test_submit_counter_round_trip(coordinator):
    """submit() must restore _outstanding to zero even when the worker
    raises, otherwise join() would hang forever on a worker error."""

    def explodes() -> None:
        raise ValueError("boom")

    coordinator.submit(explodes)
    _wait_for_outstanding_zero(coordinator)
    assert coordinator._outstanding == 0
```

##### After
```python
def test_submit_counter_round_trip(coordinator):
    """submit() must restore _outstanding to zero even when the worker
    raises, otherwise join() would hang forever on a worker error."""

    def explodes() -> None:
        raise ValueError("boom")

    coordinator.submit(explodes, None)  # ctx=None for tests that don't need it
    _wait_for_outstanding_zero(coordinator)
    assert coordinator._outstanding == 0
```

#### Example: test_submit_passes_args (lines 123-136)

##### Before
```python
def test_submit_passes_args(coordinator):
    ...
    coordinator.submit(worker, 42, "hello")
```

##### After
```python
def test_submit_passes_args(coordinator):
    ...
    coordinator.submit(worker, None, 42, "hello")  # ctx=None
```

#### Example: test_submit_propagates_ctx_to_worker (lines 337-359)

This test explicitly sets up a mock ctx and verifies propagation. It should pass the ctx explicitly:

##### Before
```python
@pytest.mark.usefixtures("_attach_mock_ctx")
def test_submit_propagates_ctx_to_worker():
    """submit() captures the parent's ScriptRunContext at submit time
    and the worker sees it via get_script_run_ctx()."""
    mock_ctx = MagicMock()
    main_thread = threading.current_thread()
    setattr(main_thread, SCRIPT_RUN_CONTEXT_ATTR_NAME, mock_ctx)

    c = ParallelFragmentCoordinator(yield_check=lambda: None)
    holder: list[object] = []
    done = threading.Event()

    def worker() -> None:
        holder.append(get_script_run_ctx())
        done.set()

    try:
        c.submit(worker)
        assert done.wait(timeout=1.0)
        _wait_for_outstanding_zero(c)
        assert holder[0] is mock_ctx
    finally:
        c.drain()
```

##### After
```python
@pytest.mark.usefixtures("_attach_mock_ctx")
def test_submit_propagates_ctx_to_worker():
    """submit() propagates the provided ScriptRunContext to the worker
    and the worker sees it via get_script_run_ctx()."""
    mock_ctx = MagicMock()

    c = ParallelFragmentCoordinator(yield_check=lambda: None)
    holder: list[object] = []
    done = threading.Event()

    def worker() -> None:
        holder.append(get_script_run_ctx())
        done.set()

    try:
        c.submit(worker, mock_ctx)  # Pass ctx explicitly
        assert done.wait(timeout=1.0)
        _wait_for_outstanding_zero(c)
        assert holder[0] is mock_ctx
    finally:
        c.drain()
```

#### Summary of Test File Changes

| Test Function | Line | Change |
|---------------|------|--------|
| `test_submit_counter_round_trip` | 118 | `coordinator.submit(explodes)` → `coordinator.submit(explodes, None)` |
| `test_submit_passes_args` | 133 | `coordinator.submit(worker, 42, "hello")` → `coordinator.submit(worker, None, 42, "hello")` |
| `test_submit_after_shutdown_rolls_back_outstanding` | 146 | `c.submit(lambda: None)` → `c.submit(lambda: None, None)` |
| `test_nested_submit_counter` | 158, 160 | Add `None` ctx parameter |
| `test_join_waits_and_yields` | 190 | Add `None` ctx parameter |
| `test_join_raises_...` | 234 | Add `None` ctx parameter |
| `test_join_raises_stored_stop...` | 260 | Add `None` ctx parameter |
| `test_drain_silent_and_synchronous` | 318 | Add `None` ctx parameter |
| `test_submit_propagates_ctx_to_worker` | 354 | Pass `mock_ctx` explicitly |
| `test_submit_propagates_thread_state_to_worker` | 377 | Add `None` ctx parameter |
| `test_submit_isolates_worker_thread_state_writes` | 401 | Add `None` ctx parameter |
| `test_submit_clears_ctx_attribute_...` | 439, 445 | Pass `ctx_a`, `ctx_b` explicitly |
| `test_submit_clears_ctx_attribute_...` | 483, 488 | Pass contexts explicitly |

## Design Decisions

### Approach: Caller Passes `ctx` Explicitly

**Rationale**: The caller (`_dispatch_parallel_fragment`) already has `ctx` as a parameter. Passing it explicitly to `submit()`:
- Makes data flow visible in the code
- Removes the coordinator's dependency on `get_script_run_ctx()`
- Breaks the import cycle cleanly
- Allows tests to control `ctx` without thread-local setup

### Why Not Alternative Approaches

**Alternative 1: Move `get_script_run_ctx` to a separate utility module**

This would move `get_script_run_ctx` out of `script_run_context.py` into a new module that both `parallel_coordinator.py` and `script_run_context.py` could import.

*Rejected because*:
- Adds unnecessary indirection
- `get_script_run_ctx` is conceptually part of the `ScriptRunContext` module
- The explicit `ctx` parameter approach is cleaner and more testable

**Alternative 2: Keep deferred import but document it better**

*Rejected because*:
- Deferred imports are a code smell
- They add runtime overhead on every `reset()` call
- The underlying coupling remains hidden

### Parameter Position

The `ctx` parameter is placed after `fn` and before `*args`:

```python
def submit(self, fn: Callable[..., Any], ctx: ScriptRunContext | None, *args: Any) -> None:
```

This maintains the pattern where the worker function comes first, followed by its context/configuration, followed by variadic args to forward.

## Test Plan

### Specific Test Cases

1. **Unit Test: `test_no_circular_import_at_module_level`** (new test)
   - File: `lib/tests/streamlit/runtime/parallel_fragment_coordinator_test.py`
   - Verify that importing `parallel_coordinator` and `script_run_context` in either order succeeds without `ImportError`
   ```python
   def test_no_circular_import_at_module_level():
       """Importing parallel_coordinator and script_run_context must not
       raise ImportError regardless of import order."""
       import importlib
       import sys

       # Remove both modules if cached
       for mod in list(sys.modules):
           if "parallel_coordinator" in mod or "script_run_context" in mod:
               del sys.modules[mod]

       # Import in both orders
       from streamlit.runtime import parallel_coordinator
       from streamlit.runtime.scriptrunner_utils import script_run_context

       # Reimport in reverse order
       for mod in list(sys.modules):
           if "parallel_coordinator" in mod or "script_run_context" in mod:
               del sys.modules[mod]

       from streamlit.runtime.scriptrunner_utils import script_run_context
       from streamlit.runtime import parallel_coordinator
   ```

2. **Unit Test: `test_submit_propagates_explicit_ctx`** (update existing)
   - File: `lib/tests/streamlit/runtime/parallel_fragment_coordinator_test.py`
   - Verify that the `ctx` passed to `submit()` is the one seen by the worker via `get_script_run_ctx()`

3. **Unit Test: `test_submit_with_none_ctx`** (new test)
   - File: `lib/tests/streamlit/runtime/parallel_fragment_coordinator_test.py`
   - Verify that passing `ctx=None` works (worker sees `None` from `get_script_run_ctx()`)

4. **Integration Test: Existing parallel fragment tests**
   - File: `lib/tests/streamlit/runtime/fragment_test.py`
   - Existing tests that mock `coordinator.submit()` should continue to pass
   - The mock expectations may need updating if they inspect call arguments

5. **Integration Test: ScriptRunner tests**
   - File: `lib/tests/streamlit/runtime/scriptrunner/script_runner_test.py`
   - `test_parallel_coordinator_is_fresh_per_run` — verify coordinator creation in `reset()` works
   - `test_parallel_coordinator_join_called_after_exec` — verify join/drain behavior

### Running Tests

```bash
# Run coordinator unit tests
uv run pytest lib/tests/streamlit/runtime/parallel_fragment_coordinator_test.py -v

# Run fragment tests
uv run pytest lib/tests/streamlit/runtime/fragment_test.py -v

# Run script_run_context tests
uv run pytest lib/tests/streamlit/runtime/scriptrunner_utils/script_run_context_test.py -v

# Run script_runner tests
uv run pytest lib/tests/streamlit/runtime/scriptrunner/script_runner_test.py -v

# Run all checks
make check
```

## Scope Boundaries

### What This PR Does

- Changes `submit()` signature to accept `ctx` as an explicit parameter
- Removes `get_script_run_ctx` import from `parallel_coordinator.py`
- Moves `ParallelFragmentCoordinator` import in `script_run_context.py` from deferred (inside `reset()`) to module-level
- Updates the single production call site in `fragment.py`
- Updates all test call sites

### What This PR Does NOT Change

- **Other coordinator methods**: `join()`, `drain()`, `request_stop()`, `request_rerun()`, `should_stop()`, `notify_yield_waiters()` remain unchanged
- **`_scoped_ctx_attach` helper**: Still uses `SCRIPT_RUN_CONTEXT_ATTR_NAME` import (this is fine, no cycle)
- **ThreadState/FragmentThreadState propagation**: The `contextvars.copy_context()` mechanism is unchanged
- **Worker thread behavior**: Workers still see the propagated `ctx` via `get_script_run_ctx()`
- **ScriptRunner integration**: The way `script_runner.py` uses the coordinator remains the same
- **Public API**: No user-facing changes

## Open Questions

None identified. The tech spec clearly states that the coordinator should receive `ctx` from the caller rather than fetching it internally, and this plan implements that guidance directly.
