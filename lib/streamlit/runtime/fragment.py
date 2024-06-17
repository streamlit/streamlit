# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
import hashlib
import inspect
from abc import abstractmethod
from copy import deepcopy
from functools import wraps
from typing import TYPE_CHECKING, Any, Callable, Protocol, TypeVar, overload

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.scriptrunner.exec_code import exec_func_with_error_handling
from streamlit.time_util import time_to_seconds

if TYPE_CHECKING:
    from datetime import timedelta

F = TypeVar("F", bound=Callable[..., Any])
Fragment = Callable[[], Any]


class FragmentStorage(Protocol):
    """A key-value store for Fragments. Used to implement the @st.experimental_fragment
    decorator.

    We intentionally define this as its own protocol despite how generic it appears to
    be at first glance. The reason why is that, in any case where fragments aren't just
    stored as Python closures in memory, storing and retrieving Fragments will generally
    involve serializing and deserializing function bytecode, which is a tricky aspect
    to implementing FragmentStorages that won't generally appear with our other *Storage
    protocols.
    """

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
    def clear(self) -> None:
        """Remove all fragments saved in this FragmentStorage."""
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

    def __init__(self):
        self._fragments: dict[str, Fragment] = {}

    def get(self, key: str) -> Fragment:
        return self._fragments[key]

    def set(self, key: str, value: Fragment) -> None:
        self._fragments[key] = value

    def delete(self, key: str) -> None:
        del self._fragments[key]

    def clear(self) -> None:
        self._fragments.clear()


def _fragment(
    func: F | None = None, *, run_every: int | float | timedelta | str | None = None
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
    else:
        non_optional_func = func

    @wraps(non_optional_func)
    def wrap(*args, **kwargs):
        from streamlit.delta_generator import dg_stack

        ctx = get_script_run_ctx()
        if ctx is None:
            return

        cursors_snapshot = deepcopy(ctx.cursors)
        dg_stack_snapshot = deepcopy(dg_stack.get())
        active_dg = dg_stack_snapshot[-1]
        h = hashlib.new("md5")
        h.update(
            f"{non_optional_func.__module__}.{non_optional_func.__qualname__}{active_dg._get_delta_path_str()}".encode()
        )
        fragment_id = h.hexdigest()

        # We intentionally want to capture the active script hash here to ensure
        # that the fragment is associated with the correct script running.
        initialized_active_script_hash = ctx.active_script_hash

        def wrapped_fragment():
            import streamlit as st

            # NOTE: We need to call get_script_run_ctx here again and can't just use the
            # value of ctx from above captured by the closure because subsequent
            # fragment runs will generally run in a new script run, thus we'll have a
            # new ctx.
            ctx = get_script_run_ctx(suppress_warning=True)
            assert ctx is not None

            if ctx.fragment_ids_this_run:
                # This script run is a run of one or more fragments. We restore the
                # state of ctx.cursors and dg_stack to the snapshots we took when this
                # fragment was declared.
                ctx.cursors = deepcopy(cursors_snapshot)
                dg_stack.set(deepcopy(dg_stack_snapshot))
            else:
                # Otherwise, we must be in a full script run. We need to temporarily set
                # ctx.current_fragment_id so that elements corresponding to this
                # fragment get tagged with the appropriate ID. ctx.current_fragment_id
                # gets reset after the fragment function finishes running.
                ctx.current_fragment_id = fragment_id

            try:
                # Make sure we set the active script hash to the same value
                # for the fragment run as when defined upon initialization
                # This ensures that elements (especially widgets) are tied
                # to a consistent active script hash
                active_hash_context = (
                    ctx.pages_manager.run_with_active_hash(
                        initialized_active_script_hash
                    )
                    if initialized_active_script_hash != ctx.active_script_hash
                    else contextlib.nullcontext()
                )
                with active_hash_context:
                    with st.container():
                        ctx.current_fragment_delta_path = (
                            active_dg._cursor.delta_path if active_dg._cursor else []
                        )
                        result = non_optional_func(*args, **kwargs)
            finally:
                ctx.current_fragment_id = None

            return result

        ctx.fragment_storage.set(fragment_id, wrapped_fragment)

        if run_every:
            msg = ForwardMsg()
            msg.auto_rerun.interval = time_to_seconds(run_every)
            msg.auto_rerun.fragment_id = fragment_id
            ctx.enqueue(msg)

        # Wrap the fragment function in the same try-except block as in a normal
        # script_run so that for a main-app run (this execution) and a fragment-rerun
        # the same execution and error-handling logic is used. This makes errors in the
        # fragment appear in the fragment path also for the first execution here in
        # context of a full app run.
        result, _, _, _ = exec_func_with_error_handling(
            wrapped_fragment, ctx, reraise_rerun_exception=True
        )
        return result

    with contextlib.suppress(AttributeError):
        # Make this a well-behaved decorator by preserving important function
        # attributes.
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


@gather_metrics("experimental_fragment")
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
    directly. Any values from the fragment that need to be accessed from
    the wider app should generally be stored in Session State.

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
        - Fragments can't contain other fragments. Additionally, using
          fragments in widget callback functions is not supported.

        - Fragments can only contain widgets in their main body. Fragments
          can't render widgets to externally created containers.

    Parameters
    ----------
    func: callable
        The function to turn into a fragment.

    run_every: int, float, timedelta, str, or None
        The time interval between automatic fragment reruns. This can be one of
        the following:

            * ``None`` (default).
            * An ``int`` or ``float`` specifying the interval in seconds.
            * A string specifying the time in a format supported by `Pandas'
              Timedelta constructor <https://pandas.pydata.org/docs/reference/api/pandas.Timedelta.html>`_,
              e.g. ``"1d"``, ``"1.5 days"``, or ``"1h23s"``.
            * A ``timedelta`` object from `Python's built-in datetime library
              <https://docs.python.org/3/library/datetime.html#timedelta-objects>`_,
              e.g. ``timedelta(days=1)``.

        If ``run_every`` is ``None``, the fragment will only rerun from
        user-triggered events.

    Examples
    --------
    The following example demonstrates basic usage of
    ``@st.experimental_fragment``. As an anology, "inflating balloons" is a
    slow process that happens outside of the fragment. "Releasing balloons" is
    a quick process that happens inside of the fragment.

    >>> import streamlit as st
    >>> import time
    >>>
    >>> @st.experimental_fragment
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
    >>> @st.experimental_fragment
    >>> def fragment():
    >>>     st.session_state.fragment_runs += 1
    >>>     st.button("Rerun fragment")
    >>>     st.write(f"Fragment says it ran {st.session_state.fragment_runs} times.")
    >>>
    >>> st.session_state.app_runs += 1
    >>> fragment()
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
    >>> @st.experimental_fragment
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
