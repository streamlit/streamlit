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

from copy import deepcopy
from typing import (
    Any,
    Final,
    ItemsView,
    Iterator,
    KeysView,
    Mapping,
    NoReturn,
    ValuesView,
)

from blinker import Signal

import streamlit as st
from streamlit.logger import get_logger

_LOGGER: Final = get_logger(__name__)


class AttrDict(Mapping[str, Any]):
    """
    We use AttrDict to wrap up dictionary values from secrets
    to provide dot access to nested secrets
    """

    def __init__(self, value, missing_attr_error_message, missing_key_error_message):
        self.__dict__["__nested_secrets__"] = dict(value)
        self._missing_attr_error_message = missing_attr_error_message
        self._missing_key_error_message = missing_key_error_message

    def _maybe_wrap_in_attr_dict(self, value) -> Any:
        if not isinstance(value, Mapping):
            return value
        else:
            return AttrDict(
                value, self._missing_attr_error_message, self._missing_key_error_message
            )

    def __len__(self) -> int:
        return len(self.__nested_secrets__)

    def __iter__(self) -> Iterator[str]:
        return iter(self.__nested_secrets__)

    def __getitem__(self, key: str) -> Any:
        try:
            value = self.__nested_secrets__[key]
            return self._maybe_wrap_in_attr_dict(value)
        except KeyError:
            raise KeyError(self._missing_key_error_message(key))

    def __getattr__(self, attr_name: str) -> Any:
        try:
            value = self.__nested_secrets__[attr_name]
            return self._maybe_wrap_in_attr_dict(value)
        except KeyError:
            raise AttributeError(self._missing_attr_error_message(attr_name))

    def __repr__(self):
        return repr(self.__nested_secrets__)

    def __setitem__(self, key, value) -> NoReturn:
        raise TypeError("Secrets does not support item assignment.")

    def __setattr__(self, key, value) -> NoReturn:
        if key == "_missing_attr_error_message" or key == "_missing_key_error_message":
            super().__setattr__(key, value)
            return
        raise TypeError("Secrets does not support attribute assignment.")

    def to_dict(self) -> dict[str, Any]:
        return deepcopy(self.__nested_secrets__)


def get_attr_dict_factory(missing_attr_error_message, missing_key_error_message):
    def get_attr_dict(value):
        return AttrDict(value, missing_attr_error_message, missing_key_error_message)

    return get_attr_dict


class SecretsProvider(Mapping[str, Any]):
    change_listener: Signal

    """Load secrets. If none exist, no exception will be raised.
    (If the source exists but is malformed, an exception *will* be raised.)

    Returns True if a secrets were successfully loaded, False otherwise.

    Thread-safe.
    """

    def load(self):
        raise NotImplementedError

    """Return the value with the given key. If no such key
    exists, raise an AttributeError.

    Thread-safe.
    """

    def __getattr__(self, key: str) -> Any:
        raise NotImplementedError

    """Return the value with the given key. If no such key
    exists, raise a KeyError.

    Thread-safe.
    """

    def __getitem__(self, key: str) -> Any:
        raise NotImplementedError

    """A string representation of the contents of the dict. Thread-safe."""

    def __repr__(self) -> str:
        raise NotImplementedError

    """The number of entries in the dict. Thread-safe."""

    def __len__(self) -> int:
        raise NotImplementedError

    """True if the given key is in the dict. Thread-safe."""

    def has_key(self, k: str) -> bool:
        raise NotImplementedError

    """A view of the keys in the dict. Thread-safe."""

    def keys(self) -> KeysView[str]:
        raise NotImplementedError

    """A view of the values in the dict. Thread-safe."""

    def values(self) -> ValuesView[Any]:
        raise NotImplementedError

    """A view of the key-value items in the dict. Thread-safe."""

    def items(self) -> ItemsView[str, Any]:
        raise NotImplementedError

    """True if the given key is in the dict.

    Thread-safe."""

    def __contains__(self, key: Any) -> bool:
        raise NotImplementedError

    """An iterator over the keys in the dict.

    Thread-safe."""

    def __iter__(self) -> Iterator[str]:
        raise NotImplementedError
