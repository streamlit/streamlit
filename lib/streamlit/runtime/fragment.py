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
import inspect
import threading
from abc import abstractmethod
from collections.abc import Callable, Iterator
from copy import deepcopy
from functools import wraps
from typing import TYPE_CHECKING, Any, Final, NoReturn, Protocol, TypeVar, overload

from streamlit.error_util import handle_user_script_exception
from streamlit.errors import (
    FragmentHandledException,
    FragmentStorageKeyError,
    StreamlitAPIException,
)
from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.exceptions import (
    RerunException,
    StopException,
)
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    ScriptRunContext,
    ThreadState,
    get_script_run_ctx,
)
from streamlit.time_util import time_to_seconds
from streamlit.type_util import get_object_name
from streamlit.util import calc_hash

if TYPE_CHECKING:
    from datetime import timedelta

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.outside_container_wrapper import OutsideContainerWrapper

_LOGGER: Final = get_logger(__name__)


def _check_not_parallel_worker(api_name: str) -> None:
    """Raise StreamlitAPIException if called from a parallel fragment worker."""
    try:
        ts = ThreadState.get()
    except RuntimeError:
        return

    if ts.is_parallel_worker:
        raise StreamlitAPIException(
            f"`{api_name}` cannot be called from a parallel fragment during "
            f"the initial page load, because parallel fragments run "
            f"concurrently on separate threads where `{api_name}` is not "
            f"safe.\n\n"
            f"To fix this, gate the call behind a widget interaction "
            f"(e.g., `if st.button(...):`) so it runs during a sequential "
            f"fragment rerun instead."
        )


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

    @abstractmethod
    def clear(
        self,
        new_fragment_ids: frozenset[str] | None = None,
    ) -> None:
        """Remove all fragments saved in this FragmentStorage unless listed in
        new_fragment_ids.
        """
        raise NotImplementedError

    @abstractmethod
    def lookup(self, key: str) -> Fragment:
        """Look up a fragment to re-execute.

        Called during fragment reruns from the script thread.
        """
        raise NotImplementedError

    @abstractmethod
    def register(
        self,
        key: str,
        fragment: Fragment,
        *,
        parent_fragment_id: str | None = None,
    ) -> None:
        """Store a fragment definition.

        Called during script execution from the main thread or worker threads
        (nested fragments in parallel execution).

        parent_fragment_id
            The fragment id of the enclosing ``@st.fragment`` when this fragment is
            nested, or ``None`` for a top-level fragment.
        """
        raise NotImplementedError

    @abstractmethod
    def clear_stale_descendants(
        self,
        root_fragment_id: str,
        newly_registered_ids: frozenset[str],
    ) -> None:
        """Remove stored fragments that are strict descendants of ``root_fragment_id``
        but were not re-registered during the latest run of that root.

        Used after a fragment-only rerun so orphaned nested fragments (e.g. from a
        removed ``run_every`` child) do not keep stale closures in storage.
        """
        raise NotImplementedError

    @abstractmethod
    def registration_sequence(self) -> int:
        """Return a cursor for registrations written via ``register``."""
        raise NotImplementedError

    @abstractmethod
    def ids_registered_after(self, registration_sequence: int) -> frozenset[str]:
        """Return fragment ids whose current registration was written later."""
        raise NotImplementedError

    @abstractmethod
    def order_fragment_ids(self, fragment_ids: list[str]) -> list[str]:
        """Return a stable ordering that keeps queued ancestors before descendants."""
        raise NotImplementedError

    @abstractmethod
    def delete(self, key: str) -> None:
        """Delete the fragment corresponding to the given key.

        Implementations are not required to be thread-safe; callers should
        only invoke this from the script thread.
        """
        raise NotImplementedError

    @abstractmethod
    def contains(self, key: str) -> bool:
        """Return whether the given key is present in this FragmentStorage.

        May be called from non-script threads (e.g. the event loop). Implementations
        should be safe to call without external synchronization.
        """
        raise NotImplementedError

    @abstractmethod
    def register_outside_wrapper(
        self, fragment_id: str, container_id: str, wrapper: OutsideContainerWrapper
    ) -> None:
        """Store the implicit wrapper for a (fragment, outside container) pair."""
        raise NotImplementedError

    @abstractmethod
    def get_outside_wrapper(
        self, fragment_id: str, container_id: str
    ) -> OutsideContainerWrapper | None:
        """Return the cached wrapper for a (fragment, outside container) pair."""
        raise NotImplementedError

    @abstractmethod
    def outside_wrappers_for(self, fragment_id: str) -> list[OutsideContainerWrapper]:
        """Return all wrapper records belonging to the given fragment."""
        raise NotImplementedError

    @abstractmethod
    def evict_outside_wrappers_created_by(self, fragment_id: str) -> None:
        """Drop every wrapper whose outside container was created by the given
        fragment's scope. Called when that fragment reruns and is about to rebuild
        those containers.
        """
        raise NotImplementedError

    @abstractmethod
    def clear_outside_wrappers(self) -> None:
        """Drop every stored wrapper record.

        Called at the start of a full app run, before the main script recreates
        its outside containers as new DG objects. Wrappers must survive a full
        run so the fragment reruns that follow it can reuse them, so clearing
        happens before — not after — the script body executes.
        """
        raise NotImplementedError


# NOTE: Ideally, we'd like to add a MemoryFragmentStorageStatProvider implementation to
# keep track of memory usage due to fragments, but doing something like this ends up
# being difficult in practice as the memory usage of a closure is hard to measure (the
# vendored implementation of pympler.asizeof that we use elsewhere is unable to measure
# the size of a function).
class MemoryFragmentStorage(FragmentStorage):
    """A simple, memory-backed implementation of FragmentStorage.

    MemoryFragmentStorage is just a wrapper around a plain Python dict that complies with
    the FragmentStorage protocol. A single lock guards the fragment closures plus the
    ancestry and registration metadata that need to stay in sync with them.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._fragments: dict[str, Fragment] = {}
        # Enclosing fragment id for nested fragments; top-level fragments use None.
        self._parent_by_id: dict[str, str | None] = {}
        self._registration_sequence_by_id: dict[str, int] = {}
        self._registration_sequence = 0
        self._outside_wrappers: dict[tuple[str, str], OutsideContainerWrapper] = {}

    def _iter_ancestor_ids(self, fragment_id: str) -> Iterator[str]:
        """Yield ancestors from the immediate parent outward.

        Stops on missing parents or malformed cycles.
        """
        seen_ids = {fragment_id}
        current = fragment_id

        while True:
            parent_id = self._parent_by_id.get(current)
            if parent_id is None or parent_id in seen_ids:
                return

            yield parent_id
            seen_ids.add(parent_id)
            current = parent_id

    def _remove(self, fragment_id: str, *, evict_wrappers: bool = True) -> None:
        del self._fragments[fragment_id]
        self._parent_by_id.pop(fragment_id, None)
        self._registration_sequence_by_id.pop(fragment_id, None)
        if evict_wrappers:
            self._outside_wrappers = {
                key: wrapper
                for key, wrapper in self._outside_wrappers.items()
                if key[0] != fragment_id
            }

    def clear(self, new_fragment_ids: frozenset[str] | None = None) -> None:
        with self._lock:
            if new_fragment_ids is None:
                new_fragment_ids = frozenset()

            for fragment_id in list(self._fragments):
                if fragment_id not in new_fragment_ids:
                    self._remove(fragment_id, evict_wrappers=False)

    def lookup(self, key: str) -> Fragment:
        try:
            return self._fragments[key]
        except KeyError as e:
            raise FragmentStorageKeyError(str(e))

    def register(
        self,
        key: str,
        fragment: Fragment,
        *,
        parent_fragment_id: str | None = None,
    ) -> None:
        with self._lock:
            self._registration_sequence += 1
            self._fragments[key] = fragment
            self._parent_by_id[key] = parent_fragment_id
            self._registration_sequence_by_id[key] = self._registration_sequence

    def clear_stale_descendants(
        self,
        root_fragment_id: str,
        newly_registered_ids: frozenset[str],
    ) -> None:
        """Drop descendant fragments under ``root_fragment_id`` not seen this run."""

        with self._lock:
            to_remove = [
                fragment_id
                for fragment_id in self._fragments
                if fragment_id != root_fragment_id
                and fragment_id not in newly_registered_ids
                and root_fragment_id in self._iter_ancestor_ids(fragment_id)
            ]
            for fragment_id in to_remove:
                self._remove(fragment_id)

    def registration_sequence(self) -> int:
        with self._lock:
            return self._registration_sequence

    def ids_registered_after(self, registration_sequence: int) -> frozenset[str]:
        with self._lock:
            return frozenset(
                fragment_id
                for fragment_id, fragment_registration_sequence in (
                    self._registration_sequence_by_id.items()
                )
                if fragment_registration_sequence > registration_sequence
            )

    def order_fragment_ids(self, fragment_ids: list[str]) -> list[str]:
        """Run queued ancestors before descendants while preserving FIFO otherwise."""
        with self._lock:

            def has_queued_ancestor(
                fragment_id: str, queued_fragment_ids: set[str]
            ) -> bool:
                return any(
                    ancestor_id in queued_fragment_ids
                    for ancestor_id in self._iter_ancestor_ids(fragment_id)
                )

            remaining_fragment_ids = list(fragment_ids)
            ordered_fragment_ids = []

            while remaining_fragment_ids:
                queued_fragment_ids = set(remaining_fragment_ids)

                for index, fragment_id in enumerate(remaining_fragment_ids):
                    if not has_queued_ancestor(fragment_id, queued_fragment_ids):
                        ordered_fragment_ids.append(fragment_id)
                        del remaining_fragment_ids[index]
                        break
                else:
                    # Preserve the original order if the parent mapping is malformed.
                    ordered_fragment_ids.extend(remaining_fragment_ids)
                    break

            return ordered_fragment_ids

    def delete(self, key: str) -> None:
        with self._lock:
            try:
                self._remove(key)
            except KeyError as e:
                raise FragmentStorageKeyError(str(e))

    def contains(self, key: str) -> bool:
        with self._lock:
            return key in self._fragments

    def register_outside_wrapper(
        self, fragment_id: str, container_id: str, wrapper: OutsideContainerWrapper
    ) -> None:
        with self._lock:
            self._outside_wrappers[fragment_id, container_id] = wrapper

    def get_outside_wrapper(
        self, fragment_id: str, container_id: str
    ) -> OutsideContainerWrapper | None:
        with self._lock:
            return self._outside_wrappers.get((fragment_id, container_id))

    def outside_wrappers_for(self, fragment_id: str) -> list[OutsideContainerWrapper]:
        with self._lock:
            return [
                wrapper
                for (
                    stored_fragment_id,
                    _container_id,
                ), wrapper in self._outside_wrappers.items()
                if stored_fragment_id == fragment_id
            ]

    def evict_outside_wrappers_created_by(self, fragment_id: str) -> None:
        with self._lock:
            self._outside_wrappers = {
                key: wrapper
                for key, wrapper in self._outside_wrappers.items()
                if wrapper.creating_fragment_id != fragment_id
            }

    def clear_outside_wrappers(self) -> None:
        with self._lock:
            self._outside_wrappers.clear()

    def __deepcopy__(self, memo: dict[int, object]) -> NoReturn:
        raise TypeError(
            "MemoryFragmentStorage does not support deepcopy; "
            "it holds a threading.Lock and shared mutable state."
        )

    def __copy__(self) -> NoReturn:
        raise TypeError(
            "MemoryFragmentStorage does not support copy; "
            "it holds a threading.Lock and shared mutable state."
        )


def _reset_outside_wrappers(
    fragment_storage: FragmentStorage, fragment_id: str
) -> None:
    """Re-emit and reset every wrapper belonging to a fragment before it reruns.

    Re-emitting sends a fresh add_block delta so the frontend doesn't garbage-
    collect the wrapper as stale. Resetting the cursor returns its index to 0 so
    the fragment's children overwrite in place instead of accumulating.

    Each re-emitted delta carries ``fragment_id`` so the frontend's
    ``ClearStaleNodeVisitor`` can recognize the wrapper as fragment-owned and
    garbage-collect children that weren't re-emitted — otherwise a fragment
    that shrinks its element count leaves stale children behind.
    """
    from streamlit.cursor import RunningCursor
    from streamlit.delta_generator import _enqueue_add_block

    # See docstring — tag wrappers with fragment_id for stale-child GC.
    with ThreadState.scoped(fragment_id=fragment_id):
        for wrapper in fragment_storage.outside_wrappers_for(fragment_id):
            _enqueue_add_block(wrapper.creation_delta_path, wrapper.block_proto)

            wrapper_cursor = wrapper.delta_generator._cursor
            if not isinstance(wrapper_cursor, RunningCursor):
                # LockedCursor (st.empty wrappers) always points at index 0.
                continue
            wrapper_cursor.reset()


def _fragment(
    func: F | None = None,
    *,
    run_every: int | float | timedelta | str | None = None,
    parallel: bool = False,
    additional_hash_info: str = "",
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

        parent_fragment_id_at_def = ThreadState.get().fragment_id

        cursors_snapshot = deepcopy(ctx.cursors)
        dg_stack_snapshot = deepcopy(context_dg_stack.get())
        fragment_id = calc_hash(
            f"{non_optional_func.__module__}.{get_object_name(non_optional_func)}{dg_stack_snapshot[-1]._get_delta_path_str()}{additional_hash_info}"
        )

        # We intentionally want to capture the active script hash here to ensure
        # that the fragment is associated with the correct script running.
        initialized_active_script_hash = ThreadState.get().active_script_hash

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

                # Evict wrappers whose outside containers will be rebuilt by this
                # fragment, then re-emit and reset the surviving wrappers. Order
                # matters: eviction must happen first so we don't re-emit a wrapper
                # that's about to be replaced.
                ctx.fragment_storage.evict_outside_wrappers_created_by(fragment_id)
                _reset_outside_wrappers(ctx.fragment_storage, fragment_id)

            # Always add the fragment id to new_fragment_ids. For full app runs
            # we need to add them anyways and for fragment runs we add them
            # in case the to-be-executed fragment id was cleared from the storage
            # by the full app run.
            ctx.shared.new_fragment_ids.check_and_add(fragment_id)
            # Pin the active script hash to the value captured at fragment
            # definition (consistent widget IDs across reruns). Computed
            # above ThreadState.scoped() so the comparison isn't coupled
            # to scoped()'s field semantics.
            active_hash_context = (
                ctx.run_with_active_hash(initialized_active_script_hash)
                if initialized_active_script_hash
                != ThreadState.get().active_script_hash
                else contextlib.nullcontext()
            )

            ts = ThreadState.get()
            skip_container = ts.pre_allocated_container_fragment_id == fragment_id
            if skip_container:
                ThreadState.update(pre_allocated_container_fragment_id=None)

            # Set delta_path initial value to None. When the fragment container
            # is established below, this will be initialized with the fragment's
            # delta path. Without this, we would inherit the delta path from the
            # parent scope.
            with ThreadState.scoped(fragment_id=fragment_id, delta_path=None):
                result = None
                with active_hash_context:
                    container_ctx = (
                        contextlib.nullcontext() if skip_container else st.container()
                    )
                    with container_ctx:
                        try:
                            # use dg_stack instead of active_dg to have correct copy
                            # during execution (otherwise we can run into concurrency
                            # issues with multiple fragments). Use dg_stack because we
                            # just entered a container and [:-1] of the delta path
                            # because thats the prefix of the fragment,
                            # e.g. [0, 3, 0] -> [0, 3].
                            # All fragment elements start with [0, 3].
                            active_dg = context_dg_stack.get()[-1]
                            ThreadState.update(
                                delta_path=tuple(
                                    (
                                        active_dg._cursor.delta_path
                                        if active_dg._cursor
                                        else []
                                    )[:-1]
                                )
                            )
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
                            handle_user_script_exception(e, ctx.on_script_error)
                            # Raise FragmentHandledException to signal that the error
                            # was already handled and flags should be set accordingly
                            raise FragmentHandledException(e)
                    return result

        ctx.fragment_storage.register(
            fragment_id,
            wrapped_fragment,
            parent_fragment_id=parent_fragment_id_at_def,
        )

        if run_every:
            msg = ForwardMsg()
            msg.auto_rerun.interval = time_to_seconds(run_every)
            msg.auto_rerun.fragment_id = fragment_id
            ctx.enqueue(msg)

        if parallel and not ctx.fragment_ids_this_run:
            _dispatch_parallel_fragment(ctx, fragment_id, wrapped_fragment)
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
    during a fragment rerun.

    A fragment can also write elements and widgets into a container created
    outside of it, including directly to ``st.sidebar`` or ``st.bottom``. The
    fragment's writes to that outside container are cleared and redrawn in
    place on each fragment rerun, while content written to the same container
    outside of the fragment keeps its position and is unaffected. Interacting
    with a widget that a fragment rendered into an outside container reruns the
    writing fragment, not the full app.

    To populate an outside container from a fragment, the container must first
    receive at least one write during the initial full app run.

    Fragment code can interact with Session State, imported modules, and
    other Streamlit elements created outside the fragment. Note that these
    interactions are additive across multiple fragment reruns. You are
    responsible for handling any side effects of that behavior.

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
              e.g. ``"1D"``, ``"1.5 days"``, or ``"1h23s"``.
            - A ``timedelta`` object from `Python's built-in datetime library
              <https://docs.python.org/3/library/datetime.html#timedelta-objects>`_,
              e.g. ``timedelta(days=1)``.

        If ``run_every`` is ``None``, the fragment will only rerun from
        user-triggered events.

    parallel : bool
        Whether to execute the fragment in parallel during full app reruns.
        If ``True``, the fragment is dispatched to a thread pool and may execute
        concurrently with other parallel fragments and the rest of the app script.
        If ``False`` (default), the fragment executes inline on the main thread.

        Parallel fragments are useful for independent, slow operations that
        should not block overall app throughput. Full app reruns may overlap
        several parallel fragments with the main script; reruns confined to a
        single fragment (such as those triggered after widget interactions)
        remain sequential so state updates stay deterministic.

        During the initial parallel run, some Streamlit commands are
        restricted because they are not safe to call from concurrent
        threads. These include ``st.dialog``, ``st.switch_page``, and
        writing to containers created outside the fragment. These
        commands work normally during sequential fragment reruns
        (e.g., after a widget interaction).

        .. warning::

            Fragments dispatched in parallel can run concurrently. Avoid
            unsynchronized mutations of shared mutable resources across fragments
            unless you coordinate access explicitly.

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
    fragment update with each app or fragment rerun. In this app, clicking
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


def _prepare_dg_stack_for_worker(
    dg_stack: tuple[DeltaGenerator, ...],
) -> tuple[DeltaGenerator, ...]:
    """Deep-copy the DG stack for dispatch to a parallel worker thread.

    The deepcopy creates independent cursor state (separate _index, parent_path,
    etc.) so the worker doesn't race with the main thread. Each worker operates
    in its own cursor space within a pre-allocated container.
    """
    return deepcopy(dg_stack)


def _dispatch_parallel_fragment(
    ctx: ScriptRunContext,
    fragment_id: str,
    wrapped_fragment: Callable[[], Any],
) -> None:
    """Dispatch a parallel fragment to the coordinator's thread pool.

    Pre-allocates the fragment's container on the main thread (so the frontend
    sees the container delta immediately), then submits the fragment body to
    run on a worker thread.

    The coordinator's submit() handles context propagation: the caller passes
    ctx explicitly and submit() captures copy_context() at submit time, and the
    worker runs inside captured.run() with _scoped_ctx_attach().
    """
    import streamlit as st
    from streamlit.delta_generator_singletons import context_dg_stack

    coordinator = ctx.parallel_coordinator
    if coordinator is None:  # pragma: no cover - defensive
        _LOGGER.warning(
            "Parallel coordinator not available for fragment %s, skipping dispatch",
            fragment_id,
        )
        return

    with st.container():
        dg_stack_with_container = _prepare_dg_stack_for_worker(context_dg_stack.get())

    coordinator.submit(
        _run_parallel_fragment,
        ctx,
        fragment_id,
        wrapped_fragment,
        dg_stack_with_container,
    )


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
    ThreadState.update(
        pre_allocated_container_fragment_id=fragment_id,
        is_parallel_worker=True,
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
        # This exception indicates fragment-level handling already occurred.
        # Intentionally swallow it at the worker boundary.
        return
    except Exception:  # pragma: no cover - defensive
        _LOGGER.exception("Uncaught exception in parallel fragment worker")
