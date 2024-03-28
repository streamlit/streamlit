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
from datetime import timedelta
from functools import wraps
from typing import Any, Callable, Protocol, TypeVar, overload

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.time_util import time_to_seconds

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


@overload
def fragment(
    func: F,
    *,
    run_every: int | float | timedelta | str | None = None,
) -> F:
    ...


# Support being able to pass parameters to this decorator (that is, being able to write
# `@fragment(run_every=5.0)`).
@overload
def fragment(
    func: None = None,
    *,
    run_every: int | float | timedelta | str | None = None,
) -> Callable[[F], F]:
    ...


@gather_metrics("experimental_fragment")
def fragment(
    func: F | None = None,
    *,
    run_every: int | float | timedelta | str | None = None,
) -> Callable[[F], F] | F:
    """Allow a function to be run independently of the full script.

    Functions decorated with ``@st.experimental_fragment`` are handled specially within
    an app: when a widget created within an invocation of the function (a fragment) is
    interacted with, then only that fragment is rerun rather than the full streamlit app.

    Parameters
    ----------
    run_every: int, float, timedelta, str, or None
        If set, fragments created from this function rerun periodically at the specified
        time interval.

    Example
    -------
    The following example demonstrates basic usage of ``@st.experimental_fragment``. In
    this app, clicking on the "rerun full script" button will increment both counters,
    but the "rerun fragment" button will only increment the counter within the fragment.

    ```python3
    import streamlit as st

    if "script_runs" not in st.session_state:
        st.session_state.script_runs = 0
        st.session_state.fragment_runs = 0

    @st.experimental_fragment
    def fragment():
        st.button("rerun fragment")
        st.write(f"fragment runs: {st.session_state.fragment_runs}")
        st.session_state.fragment_runs += 1

    fragment()

    st.button("rerun full script")
    st.write(f"full script runs: {st.session_state.script_runs}")
    st.session_state.script_runs += 1
    ```
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
            f"{non_optional_func.__module__}.{non_optional_func.__qualname__}{active_dg._get_delta_path_str()}".encode(
                "utf-8"
            )
        )
        fragment_id = h.hexdigest()

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
                with st.container():
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

        return wrapped_fragment()

    with contextlib.suppress(AttributeError):
        # Make this a well-behaved decorator by preserving important function
        # attributes.
        wrap.__dict__.update(non_optional_func.__dict__)
        wrap.__signature__ = inspect.signature(non_optional_func)  # type: ignore

    return wrap
