# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import sys
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

import cloudpickle

from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state.session_state_proxy import get_session_state

F = TypeVar("F", bound=Callable[..., Any])


@overload
def partial(
    func: F,
) -> F:
    ...


@overload
def partial(
    func: None = None,
) -> Callable[[F], F]:
    ...


def partial(func: Optional[F] = None) -> Union[Callable[[F], F], F]:
    if func is None:
        # Support passing the params via function decorator
        def wrapper(f: F) -> F:
            return partial(
                func=f,
            )

        return wrapper
    else:
        # To make mypy type narrow Optional[F] -> F
        non_optional_func = func

    @wraps(non_optional_func)
    def wrap(*args, **kwargs):
        ctx = get_script_run_ctx()
        if ctx is None or len(ctx.dg_stack) == 0:
            return
        dg_stack = ctx.dg_stack
        active_dg = ctx.dg_stack[-1]

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

            ctx = get_script_run_ctx(suppress_warning=True)
            assert ctx is not None

            ctx.dg_stack = dg_stack
            # Set dg stack to outside state
            print(type(ctx.dg_stack))
            print(ctx.dg_stack)
            ctx.current_partial_id = partial_id

            result = non_optional_func(*args, **kwargs)

            # TODO: always reset to None -> otherwise problems with exceptions
            ctx.current_partial_id = None
            return result

        save_partial(partial_id, wrapped_partial)
        return wrapped_partial()

    return wrap


def load_partial(partial_id: str) -> Callable[[], Any] | None:
    partial_storage = PartialsStorage()
    if partial_id not in partial_storage:
        return None

    return cloudpickle.loads(partial_storage[partial_id])  # type: ignore


def save_partial(partial_id: str, partial_function: Callable[[], Any]) -> None:
    partial_storage = PartialsStorage()
    partial_bytes = cloudpickle.dumps(partial_function)
    partial_storage[partial_id] = partial_bytes
    print(f"Size of partial {partial_id}: {sys.getsizeof(partial_bytes)}")


class PartialsStorage(MutableMapping[str, bytes]):
    """A storage for partials that is backed by the session state."""

    def _get_partials_state(self) -> MutableMapping[str, bytes]:
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

    def __getitem__(self, key: str) -> bytes:
        """Return a specific partial."""
        return self._get_partials_state()[key]

    def __setitem__(self, key: str, value: bytes) -> None:
        """Store the bytes for a given partial."""
        self._get_partials_state()[key] = value

    def __delitem__(self, key: str) -> None:
        """Delete the bytes of a given partial."""
        del self._get_partials_state()[key]

    def __contains__(self, key: str) -> bool:
        return key in self._get_partials_state()

    def clear(self) -> None:
        return self._get_partials_state().clear()
