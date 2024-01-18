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

import hashlib
import pickle
from functools import wraps
from typing import (
    Any,
    Callable,
    Iterator,
    MutableMapping,
    Optional,
    TypeVar,
    Union,
    overload,
)

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.scriptrunner.script_run_context import dg_stack
from streamlit.runtime.state.session_state_proxy import get_session_state

F = TypeVar("F", bound=Callable[..., Any])
WrappedPartial = Callable[[], Any]


@overload
def partial(
    func: F,
    *,
    run_every: Optional[float] = None,
) -> F:
    ...


@overload
def partial(
    func: None = None,
    *,
    run_every: Optional[float] = None,
) -> Callable[[F], F]:
    ...


def partial(
    func: Optional[F] = None,
    *,
    run_every: Optional[float] = None,
) -> Union[Callable[[F], F], F]:
    if func is None:
        # Support passing the params via function decorator
        def wrapper(f: F) -> F:
            return partial(
                func=f,
                run_every=run_every,
            )

        return wrapper
    else:
        # To make mypy type narrow Optional[F] -> F
        non_optional_func = func

    @wraps(non_optional_func)
    def wrap(*args, **kwargs):
        import streamlit as st

        ctx = get_script_run_ctx()
        if ctx is None:
            return

        # HACK: FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME
        # The serialization/deserialization of the dg_stack here is essentially just
        # being used to reset the stack before each partial rerun. This is necessary
        # because dg_stack is mutated as the script runs, but we need to save its state
        # at this point so that we can rewrite a specific part of the app in a partial
        # rerun. We'll eventually want to make changes to the DeltaGenerator class
        # itself to support this in a less hacky way.
        if not len(dg_stack.get()):
            with st.container():
                _dg_stack = pickle.dumps(dg_stack.get())
                active_dg = dg_stack.get()[-1]
        else:
            _dg_stack = pickle.dumps(dg_stack.get())
            active_dg = dg_stack.get()[-1]

        # TODO(lukasmasuch): Research more on what to include in the hash:
        h = hashlib.new("md5")
        h.update(
            f"{non_optional_func.__module__}.{non_optional_func.__qualname__} {active_dg._get_delta_path_str()}".encode(
                "utf-8"
            )
        )
        partial_id = h.hexdigest()

        def wrapped_partial():
            from streamlit.runtime.scriptrunner import get_script_run_ctx
            from streamlit.runtime.scriptrunner.script_run_context import dg_stack

            ctx = get_script_run_ctx(suppress_warning=True)
            assert ctx is not None

            # HACK: See the corresponding comment above for an explanation of what's
            # going on here.
            dg_stack.set(pickle.loads(_dg_stack)[:])

            # Set dg stack to outside state
            ctx.current_partial_id = partial_id

            result = non_optional_func(*args, **kwargs)

            # TODO: always reset to None -> otherwise problems with exceptions
            ctx.current_partial_id = None
            return result

        save_partial(partial_id, wrapped_partial)

        if run_every:
            msg = ForwardMsg()
            msg.auto_rerun.interval = run_every
            msg.auto_rerun.partial_id = partial_id
            ctx.enqueue(msg)
        return wrapped_partial()

    return wrap


def load_partial(partial_id: str) -> WrappedPartial | None:
    partial_storage = PartialsStorage()
    if partial_id not in partial_storage:
        return None

    return partial_storage[partial_id]


def save_partial(partial_id: str, partial_function: WrappedPartial) -> None:
    partial_storage = PartialsStorage()
    partial_storage[partial_id] = partial_function


class PartialsStorage(MutableMapping[str, WrappedPartial]):
    """A storage for partials that is backed by the session state."""

    def _get_partials_state(self) -> MutableMapping[str, WrappedPartial]:
        # TODO(lukasmasuch): This is just a super hacky solution for storing partials
        # We should create a dedicated partials storage outside of the session state.
        session_state = get_session_state()
        if "_st_partials" not in session_state:
            session_state["_st_partials"] = {}
        return session_state["_st_partials"]  # type: ignore

    def __iter__(self) -> Iterator[Any]:
        """Iterator over all partials."""
        return iter(self._get_partials_state())

    def __len__(self) -> int:
        """Number of partials in the partial storage."""
        return len(self._get_partials_state())

    def __str__(self) -> str:
        """String representation of the partial state."""
        return str(self._get_partials_state())

    def __getitem__(self, key: str) -> WrappedPartial:
        """Return a specific partial."""
        return self._get_partials_state()[key]

    def __setitem__(self, key: str, value: WrappedPartial) -> None:
        """Store the WrappedPartial for a given partial."""
        self._get_partials_state()[key] = value

    def __delitem__(self, key: str) -> None:
        """Delete the WrappedPartial of a given partial."""
        del self._get_partials_state()[key]

    def __contains__(self, key: Any) -> bool:
        return key in self._get_partials_state()

    def clear(self) -> None:
        return self._get_partials_state().clear()
