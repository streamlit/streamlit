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
from typing import TYPE_CHECKING, Any, NoReturn, Protocol, TypeVar, overload

from streamlit.error_util import handle_user_script_exception
from streamlit.errors import FragmentHandledException, FragmentStorageKeyError
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.exceptions import (
    RerunException,
    StopException,
)
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.time_util import time_to_seconds
from streamlit.type_util import get_object_name
from streamlit.util import calc_hash

if TYPE_CHECKING:
    from datetime import timedelta


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

    def _remove(self, fragment_id: str) -> None:
        del self._fragments[fragment_id]
        self._parent_by_id.pop(fragment_id, None)
        self._registration_sequence_by_id.pop(fragment_id, None)

    def clear(self, new_fragment_ids: frozenset[str] | None = None) -> None:
        with self._lock:
            if new_fragment_ids is None:
                new_fragment_ids = frozenset()

            for fragment_id in list(self._fragments):
                if fragment_id not in new_fragment_ids:
                    self._remove(fragment_id)

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


def _fragment(
    func: F | None = None,
    *,
    run_every: int | float | timedelta | str | None = None,
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
            )

        return wrapper
    non_optional_func: F = func

    @wraps(non_optional_func)
    def wrap(*args: Any, **kwargs: Any) -> Any:
        from streamlit.delta_generator_singletons import context_dg_stack

        ctx = get_script_run_ctx()
        if ctx is None:
            return None

        parent_fragment_id_at_def = ctx.current_fragment_id

        cursors_snapshot = deepcopy(ctx.cursors)
        dg_stack_snapshot = deepcopy(context_dg_stack.get())
        fragment_id = calc_hash(
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
            ctx.new_fragment_ids.check_and_add(fragment_id)
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
                            handle_user_script_exception(e, ctx.on_script_error)
                            # Raise FragmentHandledException to signal that the error
                            # was already handled and flags should be set accordingly
                            raise FragmentHandledException(e)
                    return result
            finally:
                ctx.current_fragment_id = prev_fragment_id
                ctx.current_fragment_delta_path = []

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

        # Immediate execute the wrapped fragment since we are in a full app run
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
) -> F: ...


# Support being able to pass parameters to this decorator (that is, being able to write
# `@fragment(run_every=5.0)`).
@overload
def fragment(
    func: None = None,
    *,
    run_every: int | float | timedelta | str | None = None,
) -> Callable[[F], F]: ...


@gather_metrics("fragment")
def fragment(
    func: F | None = None,
    *,
    run_every: int | float | timedelta | str | None = None,
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
    return _fragment(func, run_every=run_every)
