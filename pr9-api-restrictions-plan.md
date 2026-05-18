# PR 9: API Restrictions During Parallel Fragment Execution

## Background

PR 9 adds API restrictions that prevent worker threads from calling APIs that are unsafe or nonsensical during parallel fragment execution. This builds on:

- **PR 5b**: Introduced `FragmentThreadState` as a frozen dataclass stored in a module-level `ContextVar`, with `ThreadState` helper methods (`.get()`, `.update()`, `.scoped()`, `.initialize()`).
- **PR 7 (PR #15214)**: Added `parallel: bool = False` to `@st.fragment`, implemented `_dispatch_parallel_fragment()` for main-thread container pre-allocation, and `_run_parallel_fragment()` as the worker entry point running inside `copy_context()` boundaries.

The key insight is that `parallel=True` fragments run in two distinct execution contexts:
1. **Parallel batch** (worker threads during full-app run): Multiple threads run concurrently via `ParallelFragmentCoordinator`. Certain APIs are prohibited here.
2. **Sequential fragment reruns** (widget interaction triggers rerun): The same `parallel=True` fragment executes inline on the main script thread—restrictions do NOT apply.

The `is_parallel_worker` flag distinguishes these contexts: it's `True` only when code executes on a coordinator worker thread during a full-app run.

## Files Changed

| File | Summary |
|------|---------|
| `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py` | Add `is_parallel_worker: bool = False` field to `FragmentThreadState` dataclass |
| `lib/streamlit/runtime/fragment.py` | Add `_check_not_parallel_worker()` helper; set `is_parallel_worker=True` in `_run_parallel_fragment()` |
| `lib/streamlit/elements/dialog_decorator.py` | Add parallel worker guard in `_dialog_decorator()` |
| `lib/streamlit/commands/execution_control.py` | Add parallel worker guard in `switch_page()` |

## Detailed Changes

### 1. `lib/streamlit/runtime/scriptrunner_utils/script_run_context.py`

Add `is_parallel_worker` field to the `FragmentThreadState` dataclass:

```python
@dataclass(frozen=True)
class FragmentThreadState:
    """Per-thread state for a fragment execution.

    Frozen so that all mutations must go through ThreadState.update() or
    ThreadState.scoped(), which rebind the ContextVar and guarantee context
    isolation when using copy_context().
    """

    fragment_id: str | None = None
    delta_path: tuple[int, ...] | None = None
    in_fragment_callback: bool = False
    active_script_hash: str = ""
    pre_allocated_container_fragment_id: str | None = None
    # NEW: True when executing on a parallel fragment worker thread
    is_parallel_worker: bool = False
```

Also add it to `_FragmentThreadStateFields` TypedDict:

```python
class _FragmentThreadStateFields(TypedDict, total=False):
    """Keyword-arg shape for ``ThreadState.{initialize, update, scoped}``."""

    fragment_id: str | None
    delta_path: tuple[int, ...] | None
    in_fragment_callback: bool
    active_script_hash: str
    pre_allocated_container_fragment_id: str | None
    is_parallel_worker: bool  # NEW
```

### 2. `lib/streamlit/runtime/fragment.py`

#### 2a. Add the `_check_not_parallel_worker()` helper

Add near the top of the module (after imports, before `FragmentStorage`):

```python
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    # ... existing imports ...
    ThreadState,
)


def _check_not_parallel_worker(api_name: str) -> None:
    """Raise StreamlitAPIException if called from a parallel fragment worker.

    Used to guard APIs that are unsafe during parallel execution (e.g.,
    @st.dialog, st.switch_page). The check reads is_parallel_worker from
    the current thread's FragmentThreadState.

    During sequential fragment reruns (widget interactions), is_parallel_worker
    is False even for parallel=True fragments—they execute inline on the main
    thread in that case.
    """
    try:
        ts = ThreadState.get()
    except RuntimeError:
        # No FragmentThreadState initialized—not in a script run context.
        # Allow the call; downstream code will handle missing context.
        return

    if ts.is_parallel_worker:
        raise StreamlitAPIException(
            f"`{api_name}` cannot be called from a parallel fragment. "
            f"Parallel fragments run on worker threads during full app runs "
            f"where {api_name} is not supported. If you need to use {api_name}, "
            f"do so during a fragment rerun (e.g., in response to a button click) "
            f"or from non-parallel code."
        )
```

#### 2b. Set `is_parallel_worker=True` in `_run_parallel_fragment()`

Modify `_run_parallel_fragment()` to set the flag before calling `wrapped_fragment()`:

```python
def _run_parallel_fragment(
    fragment_id: str,
    wrapped_fragment: Callable[[], Any],
    dg_stack_snapshot: tuple[DeltaGenerator, ...],
) -> None:
    """Worker entry point for parallel fragment execution.

    Runs inside the coordinator's context propagation boundary (copy_context +
    _scoped_ctx_attach). Sets up the skip signal for container pre-allocation
    and handles control flow exceptions.
    """
    from streamlit.delta_generator_singletons import context_dg_stack

    ctx = get_script_run_ctx(suppress_warning=True)
    if ctx is None:  # pragma: no cover - defensive
        return

    context_dg_stack.set(dg_stack_snapshot)
    # Set both the skip signal AND mark this as a parallel worker
    ThreadState.update(
        pre_allocated_container_fragment_id=fragment_id,
        is_parallel_worker=True,  # NEW: enables API restriction checks
    )

    coordinator = ctx.parallel_coordinator
    if coordinator is None:  # pragma: no cover - defensive
        return

    try:
        wrapped_fragment()
    except RerunException as e:
        coordinator.request_rerun(e)
    except StopException:
        coordinator.request_stop()
    except FragmentHandledException:
        pass
    except Exception as e:  # pragma: no cover - defensive
        _LOGGER.exception("Uncaught exception in parallel fragment worker", exc_info=e)
```

### 3. `lib/streamlit/elements/dialog_decorator.py`

Add the parallel worker check at the start of `_dialog_decorator()`'s inner `wrap()` function:

```python
from streamlit.runtime.fragment import _check_not_parallel_worker


def _dialog_decorator(
    non_optional_func: F,
    title: str,
    *,
    width: DialogWidth = "small",
    dismissible: bool = True,
    icon: str | None = None,
    on_dismiss: Literal["ignore", "rerun"] | WidgetCallback = "ignore",
) -> F:
    if title is None or title == "":
        raise StreamlitAPIException(
            "A non-empty `title` argument has to be provided for dialogs, for example "
            '`@st.dialog("Example Title")`.'
        )

    @wraps(non_optional_func)
    def wrap(*args: Any, **kwargs: Any) -> None:
        # NEW: Block @st.dialog from parallel fragment workers
        _check_not_parallel_worker("@st.dialog")

        _assert_no_nested_dialogs()
        # ... rest of existing implementation unchanged ...
```

**Why here, not in `Dialog._create()` or `_assert_first_dialog_to_be_opened()`?**

The dialog decorator is the user-facing entry point for `@st.dialog`. Placing the check at the top of `wrap()` ensures:
1. The error is raised immediately when the decorated function is called.
2. The error message references `@st.dialog` (the API users see).
3. We don't pollute lower-level dialog machinery with parallel-specific concerns.

### 4. `lib/streamlit/commands/execution_control.py`

Add the parallel worker check near the top of `switch_page()`:

```python
from streamlit.runtime.fragment import _check_not_parallel_worker


@gather_metrics("switch_page")
def switch_page(
    page: str | Path | StreamlitPage,
    *,
    query_params: QueryParamsInput | None = None,
) -> NoReturn:
    """Programmatically switch the current page in a multipage app.
    ...
    """
    # NEW: Block st.switch_page from parallel fragment workers
    _check_not_parallel_worker("st.switch_page")

    ctx = get_script_run_ctx()

    if not ctx or not ctx.script_requests:
        # This should never be the case
        raise NoSessionContext()

    # ... rest of existing implementation unchanged ...
```

**Why at the very top?**

`st.switch_page` mutates query params and requests a full rerun—calling it from a parallel worker would race with other workers and abort the parallel batch mid-execution. The check should fire before any state mutation occurs.

## Restricted APIs Summary

| API | Guard Location | Error Message |
|-----|----------------|---------------|
| `@st.dialog` | `dialog_decorator.py:_dialog_decorator.wrap()` | "`@st.dialog` cannot be called from a parallel fragment..." |
| `st.switch_page` | `execution_control.py:switch_page()` | "`st.switch_page` cannot be called from a parallel fragment..." |

**Why these APIs?**

- **`@st.dialog`**: Dialogs require one-at-a-time UI coordination. Multiple parallel fragments opening dialogs simultaneously would race on `ctx.has_dialog_opened` and produce undefined frontend behavior.
- **`st.switch_page`**: Page navigation is a global app-level action that triggers a full rerun. Calling it from a worker would abort all sibling workers and race on the destination page.

## Sequential Rerun Exception

When a `parallel=True` fragment reruns due to widget interaction:

```python
# In fragment.py _fragment() -> wrap():
if parallel and not ctx.fragment_ids_this_run:
    _dispatch_parallel_fragment(ctx, fragment_id, wrapped_fragment)
    return None
return wrapped_fragment()  # <- Sequential path for reruns
```

The fragment executes via `wrapped_fragment()` directly on the main script thread—`_run_parallel_fragment()` is never called, so `is_parallel_worker` remains `False`. This is intentional: sequential reruns have the same safety guarantees as non-parallel fragments, so APIs like `@st.dialog` and `st.switch_page` are allowed.

**Example valid pattern:**

```python
@st.fragment(parallel=True)
def dashboard_card():
    if st.button("View Details"):
        # This runs during a fragment rerun (sequential), so it's allowed
        show_details_dialog()

@st.dialog("Details")
def show_details_dialog():
    st.write("Detail content here")
```

## Test Plan

### Unit Tests

Add tests to `lib/tests/streamlit/runtime/fragment_test.py`:

```python
class ParallelFragmentAPIRestrictionsTest(unittest.TestCase):
    """Tests for _check_not_parallel_worker() and related guards."""

    def test_check_not_parallel_worker_raises_when_flag_is_true(self):
        """_check_not_parallel_worker raises StreamlitAPIException when
        is_parallel_worker is True."""
        ThreadState.initialize(is_parallel_worker=True)
        with self.assertRaises(StreamlitAPIException) as cm:
            _check_not_parallel_worker("st.test_api")
        self.assertIn("st.test_api", str(cm.exception))
        self.assertIn("parallel fragment", str(cm.exception))

    def test_check_not_parallel_worker_allows_when_flag_is_false(self):
        """_check_not_parallel_worker does nothing when is_parallel_worker
        is False (the default)."""
        ThreadState.initialize(is_parallel_worker=False)
        # Should not raise
        _check_not_parallel_worker("st.test_api")

    def test_check_not_parallel_worker_allows_when_no_thread_state(self):
        """_check_not_parallel_worker allows calls when ThreadState is not
        initialized (e.g., bare script execution)."""
        # Reset any existing state by running in a fresh context
        # Should not raise
        _check_not_parallel_worker("st.test_api")

    def test_run_parallel_fragment_sets_is_parallel_worker(self):
        """_run_parallel_fragment sets is_parallel_worker=True before
        calling wrapped_fragment."""
        captured_state = []

        def capture_fragment():
            captured_state.append(ThreadState.get().is_parallel_worker)

        # Setup minimal context for the test
        # ... (would need mock ctx, coordinator, dg_stack)

        # Verify captured_state[0] is True
```

Add tests to `lib/tests/streamlit/elements/dialog_decorator_test.py`:

```python
def test_dialog_raises_from_parallel_worker(self):
    """@st.dialog raises StreamlitAPIException when called from a
    parallel fragment worker."""
    ThreadState.initialize(is_parallel_worker=True)

    @st.dialog("Test")
    def my_dialog():
        pass

    with self.assertRaises(StreamlitAPIException) as cm:
        my_dialog()
    self.assertIn("@st.dialog", str(cm.exception))
    self.assertIn("parallel fragment", str(cm.exception))
```

Add tests to `lib/tests/streamlit/commands/execution_control_test.py`:

```python
def test_switch_page_raises_from_parallel_worker(self):
    """st.switch_page raises StreamlitAPIException when called from a
    parallel fragment worker."""
    ThreadState.initialize(is_parallel_worker=True)

    with self.assertRaises(StreamlitAPIException) as cm:
        switch_page("pages/test.py")
    self.assertIn("st.switch_page", str(cm.exception))
    self.assertIn("parallel fragment", str(cm.exception))
```

### E2E Tests

Add to `e2e_playwright/st_fragment_parallel_test.py` (or create if needed):

```python
def test_parallel_fragment_allows_dialog_on_rerun(app: Page):
    """Verify that @st.dialog works during sequential reruns of a
    parallel=True fragment (button click triggers fragment rerun,
    which then opens dialog)."""
    # App script:
    # @st.fragment(parallel=True)
    # def my_fragment():
    #     if st.button("Open Dialog"):
    #         show_dialog()
    #
    # @st.dialog("Test Dialog")
    # def show_dialog():
    #     st.write("Dialog content")
    #
    # my_fragment()

    app.get_by_text("Open Dialog").click()
    expect(app.get_by_text("Dialog content")).to_be_visible()


def test_parallel_fragment_blocks_dialog_during_initial_run(app: Page):
    """Verify that @st.dialog raises during the parallel batch (would
    need to check error is rendered in the fragment container)."""
    # This test would verify the error appears in the UI
```

## Open Questions / Risks

1. **Future API candidates for restriction:**
   - `st.navigation` — currently not restricted, but concurrent calls could race on page registry mutations. The tech spec mentions adding a lock to `PagesManager`; if that's insufficient, consider restricting.
   - External container writes (`st.sidebar`, `with parent_container`) — the tech spec proposes blocking these, but that's a separate PR concern (external container writes restriction).

2. **Error message clarity:** The current message explains *what* is blocked and *why*, but doesn't suggest a workaround beyond "do it during a rerun." Consider adding a link to docs once parallel fragments are documented.

3. **Nested parallel fragments:** If a parallel fragment spawns another parallel fragment, both run with `is_parallel_worker=True`. The restrictions apply equally—this is correct behavior.

4. **`st.rerun(scope="fragment")` during parallel batch:** Already blocked by existing guard in `_new_fragment_id_queue()` (raises when `ctx.fragment_ids_this_run` is empty during full-app runs). No additional change needed for PR 9.

5. **Thread safety of `ThreadState.get()`:** `ThreadState.get()` reads from a `ContextVar`, which is inherently thread-safe. The `is_parallel_worker` field is set once in `_run_parallel_fragment()` and never modified afterward—no race conditions.
