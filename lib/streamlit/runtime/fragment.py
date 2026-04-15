# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

import contextlib
import contextvars
import inspect
import threading
import time
from abc import abstractmethod
from collections.abc import Callable
from copy import deepcopy
from functools import wraps
from typing import TYPE_CHECKING, Any, Final, Protocol, TypeVar, overload

from streamlit.error_util import handle_uncaught_app_exception
from streamlit.errors import FragmentHandledException, FragmentStorageKeyError
from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.exceptions import (
    RerunException,
    StopException,
)
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    ScriptRunContext,
    add_script_run_ctx,
    get_script_run_ctx,
    is_parallel_worker,
    parallel_fragment_id,
)
from streamlit.time_util import time_to_seconds
from streamlit.type_util import get_object_name
from streamlit.util import calc_md5

if TYPE_CHECKING:
    from datetime import timedelta

_LOGGER: Final = get_logger(__name__)

F = TypeVar("F", bound=Callable[..., Any])
Fragment = Callable[[], Any]


class FragmentStorage(Protocol):
    """A key-value store for Fragments. Used to implement the @st.fragment decorator.

    We intentionally define this as its own protocol despite how generic it appears to
    be at first glance. The reason why is that, in any case where fragments aren't just
    stored as Python closures in memory, storing and retrieving Fragments will generally
    involve serializing and deserializing function bytecode, which is a tricky aspect
    to implementing FragmentStorages that won't generally appear with our other *Storage
    protocols.
    """

    # Weirdly, we have to define this above the `set` method, or mypy gets it confused
    # with the `set` type of `new_fragments_ids`.
    @abstractmethod
    def clear(
        self,
        new_fragment_ids: set[str] | None = None,  # ty: ignore[invalid-type-form]
    ) -> None:
        """Remove all fragments saved in this FragmentStorage unless listed in
        new_fragment_ids.
        """
        raise NotImplementedError

    @abstractmethod
    def get(self, key: str) -> Fragment:
        """Returns the stored fragment for the given key."""
        raise NotImplementedError

    @abstractmethod
    def set(self, key: str, value: Fragment) -> None:
        """Saves a fragment under the given key."""
        raise NotImplementedError

    @abstractmethod
    def delete(self, key: str) -> None:
        """Delete the fragment corresponding to the given key."""
        raise NotImplementedError

    @abstractmethod
    def contains(self, key: str) -> bool:
        """Return whether the given key is present in this FragmentStorage."""
        raise NotImplementedError


# NOTE: Ideally, we'd like to add a MemoryFragmentStorageStatProvider implementation to
# keep track of memory usage due to fragments, but doing something like this ends up
# being difficult in practice as the memory usage of a closure is hard to measure (the
# vendored implementation of pympler.asizeof that we use elsewhere is unable to measure
# the size of a function).
class MemoryFragmentStorage(FragmentStorage):
    """A simple, memory-backed implementation of FragmentStorage.

    MemoryFragmentStorage is just a wrapper around a plain Python dict that complies with
    the FragmentStorage protocol.
    """

    def __init__(self) -> None:
        self._fragments: dict[str, Fragment] = {}

    # Weirdly, we have to define this above the `set` method, or mypy gets it confused
    # with the `set` type of `new_fragments_ids`.
    def clear(self, new_fragment_ids: set[str] | None = None) -> None:  # ty: ignore[invalid-type-form]
        if new_fragment_ids is None:
            new_fragment_ids = set()

        fragment_ids = list(self._fragments.keys())

        for fid in fragment_ids:
            if fid not in new_fragment_ids:
                del self._fragments[fid]

    def get(self, key: str) -> Fragment:
        try:
            return self._fragments[key]
        except KeyError as e:
            raise FragmentStorageKeyError(str(e))

    def set(self, key: str, value: Fragment) -> None:
        self._fragments[key] = value

    def delete(self, key: str) -> None:
        try:
            del self._fragments[key]
        except KeyError as e:
            raise FragmentStorageKeyError(str(e))

    def contains(self, key: str) -> bool:
        return key in self._fragments


class ParallelFragmentCoordinator:
    """Manages parallel fragment thread lifecycle: registration, joining, cancellation.

    Created per full-app script run by ScriptRunner and stored on ScriptRunContext.
    The yield_check callback is ScriptRunner._maybe_handle_execution_control_request,
    which checks for pending RERUN/STOP requests and raises the appropriate exception.
    """

    def __init__(
        self,
        yield_check: Callable[[], None],
        poll_interval: float = 0.1,
    ) -> None:
        self._threads: list[threading.Thread] = []
        self._cancel_event = threading.Event()
        self._yield_check = yield_check
        self._poll_interval = poll_interval
        self._lock = threading.Lock()

    def register(self, thread: threading.Thread) -> None:
        with self._lock:
            self._threads.append(thread)

    def cancel(self) -> None:
        self._cancel_event.set()

    def is_cancelled(self) -> bool:
        return self._cancel_event.is_set()

    def join(self, *, check_requests: bool = True) -> None:
        """Block until all registered threads complete.

        When check_requests is True (the default), the yield_check callback is
        called on each poll interval — this allows the script runner to detect
        incoming RERUN/STOP requests and raise an exception to interrupt the wait.
        Set check_requests=False during cancellation cleanup to avoid re-raising.
        """
        while any(t.is_alive() for t in self._threads):
            if check_requests and not self._cancel_event.is_set():
                self._yield_check()
            time.sleep(self._poll_interval)
        for thread in self._threads:
            thread.join()


def _check_not_parallel_worker(api_name: str) -> None:
    """Raise StreamlitAPIException if called from a parallel fragment worker thread.

    Certain APIs (e.g. @st.dialog, st.switch_page) are unsafe during the parallel
    batch because they mutate shared state or assume single-threaded execution.
    They remain allowed during sequential fragment reruns even when the fragment
    was declared with ``parallel=True``.
    """
    if is_parallel_worker.get():
        from streamlit.errors import StreamlitAPIException

        raise StreamlitAPIException(
            f"`{api_name}` cannot be called from a parallel fragment during a "
            f"full app run. It is only allowed during sequential fragment reruns."
        )


def _dispatch_parallel_fragment(
    ctx: ScriptRunContext,
    fragment_id: str,
    user_func: Callable[..., Any],
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
    initialized_active_script_hash: str,
) -> None:
    """Pre-create the fragment container on the main thread, then dispatch
    the user function to a worker thread.

    The container Block must be created on the main thread to maintain
    delta_path ordering (the frontend validates that child indices are
    sequential). After the container exists, the context is copied so the
    worker thread inherits the correct DG stack / cursor position.
    """
    import streamlit as st
    from streamlit.delta_generator_singletons import context_dg_stack

    prev_fragment_id = ctx.current_fragment_id
    ctx.current_fragment_id = fragment_id
    ctx.new_fragment_ids.add(fragment_id)

    active_hash_context = (
        ctx.run_with_active_hash(initialized_active_script_hash)
        if initialized_active_script_hash != ctx.active_script_hash
        else contextlib.nullcontext()
    )

    with active_hash_context:
        with st.container():
            active_dg = context_dg_stack.get()[-1]
            fragment_delta_path = (
                active_dg._cursor.delta_path if active_dg._cursor else []
            )[:-1]

            # Set ContextVars before copying so the worker thread inherits them.
            parallel_fragment_id.set(fragment_id)
            is_parallel_worker.set(True)
            parent_context = contextvars.copy_context()
            parallel_fragment_id.set(None)
            is_parallel_worker.set(False)

            # Show a loading skeleton while the worker thread runs. The
            # skeleton is enqueued after the context copy, then the cursor is
            # reset to 0 so the worker's first element replaces the skeleton
            # at the same delta path. The cursor object is shared between the
            # main thread and the copied context (copy_context is shallow for
            # DG objects), so the reset must happen before the thread starts.
            active_dg._skeleton(height=200)
            if active_dg._cursor:
                active_dg._cursor._index = 0

    # Restore main thread state
    ctx.current_fragment_id = prev_fragment_id
    ctx.current_fragment_delta_path = []

    coordinator = ctx.parallel_coordinator
    if coordinator is None:
        raise RuntimeError("parallel_coordinator is not set on ScriptRunContext")

    thread = threading.Thread(
        target=_run_parallel_fragment,
        args=(
            coordinator,
            user_func,
            args,
            kwargs,
            fragment_id,
            parent_context,
            fragment_delta_path,
        ),
        name=f"parallel_fragment_{fragment_id[:8]}",
    )
    add_script_run_ctx(thread, ctx)
    coordinator.register(thread)
    thread.start()


def _run_parallel_fragment(
    coordinator: ParallelFragmentCoordinator,
    user_func: Callable[..., Any],
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
    fragment_id: str,
    parent_context: contextvars.Context,
    fragment_delta_path: list[int],
) -> None:
    """Thread entry point for a parallel fragment.

    Runs the user function inside the copied context so each thread gets
    its own context_dg_stack and cursor state. Handles control-flow
    exceptions (RerunException, StopException) and cooperative cancellation.
    """

    def run_fragment() -> None:
        ctx = get_script_run_ctx(suppress_warning=True)
        if ctx is None:  # pragma: no cover - defensive
            return

        ctx.current_fragment_delta_path = fragment_delta_path

        while True:
            if coordinator.is_cancelled():
                break
            try:
                user_func(*args, **kwargs)
                break
            except RerunException as e:
                if e.rerun_data.fragment_id_queue:
                    continue
                coordinator.cancel()
                break
            except StopException:
                coordinator.cancel()
                break
            except FragmentHandledException:
                break
            except Exception:
                _LOGGER.exception("Parallel fragment %s failed", fragment_id[:8])
                break

    parent_context.run(run_fragment)


def _fragment(
    func: F | None = None,
    *,
    run_every: int | float | timedelta | str | None = None,
    additional_hash_info: str = "",
    parallel: bool = False,
) -> Callable[[F], F] | F:
    """Contains the actual fragment logic.

    This function should be used by our internal functions that use fragments
    under-the-hood, so that fragment metrics are not tracked for those elements
    (note that the @gather_metrics annotation is only on the publicly exposed function)
    """

    if func is None:
        # Support passing the params via function decorator
        def wrapper(f: F) -> F:
            return fragment(
                func=f,
                run_every=run_every,
                parallel=parallel,
            )

        return wrapper
    non_optional_func: F = func

    @wraps(non_optional_func)
    def wrap(*args: Any, **kwargs: Any) -> Any:
        from streamlit.delta_generator_singletons import context_dg_stack

        ctx = get_script_run_ctx()
        if ctx is None:
            return None

        cursors_snapshot = deepcopy(ctx.cursors)
        dg_stack_snapshot = deepcopy(context_dg_stack.get())
        fragment_id = calc_md5(
            f"{non_optional_func.__module__}.{get_object_name(non_optional_func)}{dg_stack_snapshot[-1]._get_delta_path_str()}{additional_hash_info}"
        )

        # We intentionally want to capture the active script hash here to ensure
        # that the fragment is associated with the correct script running.
        initialized_active_script_hash = ctx.active_script_hash

        def wrapped_fragment() -> Any:
            import streamlit as st

            # NOTE: We need to call get_script_run_ctx here again and can't just use the
            # value of ctx from above captured by the closure because subsequent
            # fragment runs will generally run in a new script run, thus we'll have a
            # new ctx.
            ctx = get_script_run_ctx(suppress_warning=True)
            if ctx is None:  # pragma: no cover - defensive
                raise RuntimeError("ctx is None. This should never happen.")

            if ctx.fragment_ids_this_run:
                # This script run is a run of one or more fragments. We restore the
                # state of ctx.cursors and dg_stack to the snapshots we took when this
                # fragment was declared.
                ctx.cursors = deepcopy(cursors_snapshot)
                context_dg_stack.set(deepcopy(dg_stack_snapshot))

            # Always add the fragment id to new_fragment_ids. For full app runs
            # we need to add them anyways and for fragment runs we add them
            # in case the to-be-executed fragment id was cleared from the storage
            # by the full app run.
            ctx.new_fragment_ids.add(fragment_id)
            # Set ctx.current_fragment_id so that elements corresponding to this
            # fragment get tagged with the appropriate ID. ctx.current_fragment_id gets
            # reset after the fragment function finishes running to either return to the
            # script (outside of any fragments) or to the outer fragment this one is
            # nested in.
            prev_fragment_id = ctx.current_fragment_id
            ctx.current_fragment_id = fragment_id

            try:
                # Make sure we set the active script hash to the same value
                # for the fragment run as when defined upon initialization
                # This ensures that elements (especially widgets) are tied
                # to a consistent active script hash
                active_hash_context = (
                    ctx.run_with_active_hash(initialized_active_script_hash)
                    if initialized_active_script_hash != ctx.active_script_hash
                    else contextlib.nullcontext()
                )
                result = None
                with active_hash_context:
                    with st.container():
                        try:
                            # use dg_stack instead of active_dg to have correct copy
                            # during execution (otherwise we can run into concurrency
                            # issues with multiple fragments). Use dg_stack because we
                            # just entered a container and [:-1] of the delta path
                            # because thats the prefix of the fragment,
                            # e.g. [0, 3, 0] -> [0, 3].
                            # All fragment elements start with [0, 3].
                            active_dg = context_dg_stack.get()[-1]
                            ctx.current_fragment_delta_path = (
                                active_dg._cursor.delta_path
                                if active_dg._cursor
                                else []
                            )[:-1]
                            result = non_optional_func(*args, **kwargs)
                        except (
                            RerunException,
                            StopException,
                        ):
                            # The wrapped_fragment function is executed
                            # inside of a exec_func_with_error_handling call, so
                            # there is a correct handler for these exceptions.
                            raise
                        except Exception as e:
                            # render error here so that the delta path is correct
                            # for full app runs, the error will be displayed by the
                            # main code handler
                            # if not is_full_app_run:
                            handle_uncaught_app_exception(e)
                            # raise here again in case we are in full app execution
                            # and some flags have to be set
                            raise FragmentHandledException(e)
                    return result
            finally:
                ctx.current_fragment_id = prev_fragment_id
                ctx.current_fragment_delta_path = []

        ctx.fragment_storage.set(fragment_id, wrapped_fragment)

        if run_every:
            msg = ForwardMsg()
            msg.auto_rerun.interval = time_to_seconds(run_every)
            msg.auto_rerun.fragment_id = fragment_id
            ctx.enqueue(msg)

        # For parallel fragments during a full app run, dispatch to a worker
        # thread instead of executing inline. Fragment reruns always run
        # sequentially through wrapped_fragment().
        if (
            parallel
            and not ctx.fragment_ids_this_run
            and ctx.parallel_coordinator is not None
        ):
            _dispatch_parallel_fragment(
                ctx=ctx,
                fragment_id=fragment_id,
                user_func=non_optional_func,
                args=args,
                kwargs=kwargs,
                initialized_active_script_hash=initialized_active_script_hash,
            )
            return None

        return wrapped_fragment()

    with contextlib.suppress(AttributeError, NameError):
        # Make this a well-behaved decorator by preserving important function
        # attributes.
        # NameError: Python 3.14 PEP 649 deferred annotation evaluation can raise
        # NameError for TYPE_CHECKING-only imports in inspect.signature()
        wrap.__dict__.update(non_optional_func.__dict__)
        wrap.__signature__ = inspect.signature(non_optional_func)  # type: ignore

    return wrap


@overload
def fragment(
    func: F,
    *,
    run_every: int | float | timedelta | str | None = None,
    parallel: bool = False,
) -> F: ...


# Support being able to pass parameters to this decorator (that is, being able to write
# `@fragment(run_every=5.0)`).
@overload
def fragment(
    func: None = None,
    *,
    run_every: int | float | timedelta | str | None = None,
    parallel: bool = False,
) -> Callable[[F], F]: ...


@gather_metrics("fragment")
def fragment(
    func: F | None = None,
    *,
    run_every: int | float | timedelta | str | None = None,
    parallel: bool = False,
) -> Callable[[F], F] | F:
    """Decorator to turn a function into a fragment which can rerun independently\
    of the full app.

    When a user interacts with an input widget created inside a fragment,
    Streamlit only reruns the fragment instead of the full app. If
    ``run_every`` is set, Streamlit will also rerun the fragment at the
    specified interval while the session is active, even if the user is not
    interacting with your app.

    To trigger an app rerun from inside a fragment, call ``st.rerun()``
    directly. To trigger a fragment rerun from within itself, call
    ``st.rerun(scope="fragment")``. Any values from the fragment that need to
    be accessed from the wider app should generally be stored in Session State.

    When Streamlit element commands are called directly in a fragment, the
    elements are cleared and redrawn on each fragment rerun, just like all
    elements are redrawn on each app rerun. The rest of the app is persisted
    during a fragment rerun. When a fragment renders elements into externally
    created containers, the elements will not be cleared with each fragment
    rerun. Instead, elements will accumulate in those containers with each
    fragment rerun, until the next app rerun.

    Calling ``st.sidebar`` in a fragment is not supported. To write elements to
    the sidebar with a fragment, call your fragment function inside a
    ``with st.sidebar`` context manager.

    Fragment code can interact with Session State, imported modules, and
    other Streamlit elements created outside the fragment. Note that these
    interactions are additive across multiple fragment reruns. You are
    responsible for handling any side effects of that behavior.

    .. warning::

        - Fragments can only contain widgets in their main body. Fragments
          can't render widgets to externally created containers.

    Parameters
    ----------
    func: callable
        The function to turn into a fragment.

    run_every: int, float, timedelta, str, or None
        The time interval between automatic fragment reruns. This can be one of
        the following:

            - ``None`` (default).
            - An ``int`` or ``float`` specifying the interval in seconds.
            - A string specifying the time in a format supported by `Pandas'
              Timedelta constructor <https://pandas.pydata.org/docs/reference/api/pandas.Timedelta.html>`_,
              e.g. ``"1d"``, ``"1.5 days"``, or ``"1h23s"``.
            - A ``timedelta`` object from `Python's built-in datetime library
              <https://docs.python.org/3/library/datetime.html#timedelta-objects>`_,
              e.g. ``timedelta(days=1)``.

        If ``run_every`` is ``None``, the fragment will only rerun from
        user-triggered events.

    parallel : bool
        If ``True``, the fragment runs in a separate thread during full app
        runs, allowing independent fragments to load data and render
        concurrently. The fragment's return value is always ``None`` when
        running in parallel. Fragment reruns (from widget interactions or
        ``run_every``) always execute sequentially regardless of this setting.
        Defaults to ``False``.

    Examples
    --------
    The following example demonstrates basic usage of
    ``@st.fragment``. As an analogy, "inflating balloons" is a slow process that happens
    outside of the fragment. "Releasing balloons" is a quick process that happens inside
    of the fragment.

    >>> import streamlit as st
    >>> import time
    >>>
    >>> @st.fragment
    >>> def release_the_balloons():
    >>>     st.button("Release the balloons", help="Fragment rerun")
    >>>     st.balloons()
    >>>
    >>> with st.spinner("Inflating balloons..."):
    >>>     time.sleep(5)
    >>> release_the_balloons()
    >>> st.button("Inflate more balloons", help="Full rerun")

    .. output::
        https://doc-fragment-balloons.streamlit.app/
        height: 220px

    This next example demonstrates how elements both inside and outside of a
    fragement update with each app or fragment rerun. In this app, clicking
    "Rerun full app" will increment both counters and update all values
    displayed in the app. In contrast, clicking "Rerun fragment" will only
    increment the counter within the fragment. In this case, the ``st.write``
    command inside the fragment will update the app's frontend, but the two
    ``st.write`` commands outside the fragment will not update the frontend.

    >>> import streamlit as st
    >>>
    >>> if "app_runs" not in st.session_state:
    >>>     st.session_state.app_runs = 0
    >>>     st.session_state.fragment_runs = 0
    >>>
    >>> @st.fragment
    >>> def my_fragment():
    >>>     st.session_state.fragment_runs += 1
    >>>     st.button("Rerun fragment")
    >>>     st.write(f"Fragment says it ran {st.session_state.fragment_runs} times.")
    >>>
    >>> st.session_state.app_runs += 1
    >>> my_fragment()
    >>> st.button("Rerun full app")
    >>> st.write(f"Full app says it ran {st.session_state.app_runs} times.")
    >>> st.write(f"Full app sees that fragment ran {st.session_state.fragment_runs} times.")

    .. output::
        https://doc-fragment.streamlit.app/
        height: 400px

    You can also trigger an app rerun from inside a fragment by calling
    ``st.rerun``.

    >>> import streamlit as st
    >>>
    >>> if "clicks" not in st.session_state:
    >>>     st.session_state.clicks = 0
    >>>
    >>> @st.fragment
    >>> def count_to_five():
    >>>     if st.button("Plus one!"):
    >>>         st.session_state.clicks += 1
    >>>         if st.session_state.clicks % 5 == 0:
    >>>             st.rerun()
    >>>     return
    >>>
    >>> count_to_five()
    >>> st.header(f"Multiples of five clicks: {st.session_state.clicks // 5}")
    >>>
    >>> if st.button("Check click count"):
    >>>     st.toast(f"## Total clicks: {st.session_state.clicks}")

    .. output::
        https://doc-fragment-rerun.streamlit.app/
        height: 400px

    """
    return _fragment(func, run_every=run_every, parallel=parallel)
