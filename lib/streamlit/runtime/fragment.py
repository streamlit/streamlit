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

from abc import abstractmethod
from typing import Any, Callable, TypeVar, overload

from typing_extensions import Protocol

from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.scriptrunner.script_run_context import dg_stack

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


# TODO(vdonato): Have this class implement a get_stats method, then add a new
# MemoryFragmentStorageStatProvider class to register with the StatsManager in
# runtime.py (see SessionState and SessionStateStatProvider for an example).
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
    run_every: float | None = None,
) -> F:
    ...


# Support being able to pass parameters to this decorator (that is, being able to write
# `@fragment(run_every=5.0)`).
@overload
def fragment(
    func: None = None,
    *,
    run_every: float | None = None,
) -> Callable[[F], F]:
    ...


@gather_metrics("experimental_fragment")
def fragment(  # type: ignore[empty-body]
    func: F | None = None,
    *,
    run_every: float | None = None,
) -> Callable[[F], F] | F:
    pass
