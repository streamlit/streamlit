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

"""A bunch of useful utilities."""

from __future__ import annotations

import dataclasses
import functools
import hashlib
from typing import TYPE_CHECKING, Any

from streamlit.proto.RootContainer_pb2 import RootContainer

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.delta_generator import DeltaGenerator


def memoize(func: Callable[..., Any]) -> Callable[..., Any]:
    """Decorator to memoize the result of a no-args func."""
    result: list[Any] = []

    @functools.wraps(func)
    def wrapped_func() -> Any:
        if not result:
            result.append(func())
        return result[0]

    return wrapped_func


def repr_(self: Any) -> str:
    """A clean repr for a class, excluding both values that are likely defaults,
    and those explicitly default for dataclasses.
    """
    classname = self.__class__.__name__
    # Most of the falsey value, but excluding 0 and 0.0, since those often have
    # semantic meaning within streamlit.
    defaults: list[Any] = [None, "", False, [], set(), {}]
    if dataclasses.is_dataclass(self):
        fields_vals = (
            (f.name, getattr(self, f.name))
            for f in dataclasses.fields(self)
            if f.repr
            and getattr(self, f.name) != f.default
            and getattr(self, f.name) not in defaults
        )
    else:
        fields_vals = ((f, v) for (f, v) in self.__dict__.items() if v not in defaults)

    field_reprs = ", ".join(f"{field}={value!r}" for field, value in fields_vals)
    return f"{classname}({field_reprs})"


def calc_md5(s: bytes | str) -> str:
    """Return the md5 hash of the given string.

    This should not be used for security-related purposes.
    """
    # Due to security issue in md5 and sha1, usedforsecurity
    h = hashlib.new("md5", usedforsecurity=False)

    b = s.encode("utf-8") if isinstance(s, str) else s

    h.update(b)
    return h.hexdigest()


class AttributeDictionary(dict[Any, Any]):  # noqa: FURB189
    """
    A dictionary subclass that supports attribute-style access.

    This class extends the functionality of a standard dictionary to allow items
    to be accessed via attribute-style dot notation in addition to the traditional
    key-based access. If a dictionary item is accessed and is itself a dictionary,
    it is automatically wrapped in another `AttributeDictionary`, enabling recursive
    attribute-style access.
    """

    def __getattr__(self, key: str) -> Any:
        try:
            item = self.__getitem__(key)
            return AttributeDictionary(item) if isinstance(item, dict) else item
        except KeyError as err:
            raise AttributeError(
                f"'{type(self).__name__}' object has no attribute '{key}'"
            ) from err

    def __setattr__(self, name: str, value: Any) -> None:
        self[name] = value


def in_sidebar(dg: DeltaGenerator) -> bool:
    """Check if the DeltaGenerator is in the sidebar."""
    return dg._active_dg._root_container == RootContainer.SIDEBAR
