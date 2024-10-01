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

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Final, Iterable, Iterator, MutableMapping
from urllib import parse

from typing_extensions import Self

from streamlit.errors import StreamlitAPIException
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx

if TYPE_CHECKING:
    from _typeshed import SupportsKeysAndGetItem


EMBED_QUERY_PARAM: Final[str] = "embed"
EMBED_OPTIONS_QUERY_PARAM: Final[str] = "embed_options"
EMBED_QUERY_PARAMS_KEYS: Final[list[str]] = [
    EMBED_QUERY_PARAM,
    EMBED_OPTIONS_QUERY_PARAM,
]


@dataclass
class QueryParams(MutableMapping[str, str]):
    """A lightweight wrapper of a dict that sends forwardMsgs when state changes.
    It stores str keys with str and List[str] values.
    """

    _query_params: dict[str, list[str] | str] = field(default_factory=dict)
    _disable_forward_msg: bool = False

    def __iter__(self) -> Iterator[str]:
        self._ensure_single_query_api_used()

        return iter(
            key
            for key in self._query_params.keys()
            if key not in EMBED_QUERY_PARAMS_KEYS
        )

    def __getitem__(self, key: str) -> str:
        """Retrieves a value for a given key in query parameters.
        Returns the last item in a list or an empty string if empty.
        If the key is not present, raise KeyError.
        """
        self._ensure_single_query_api_used()
        try:
            if key in EMBED_QUERY_PARAMS_KEYS:
                raise KeyError(missing_key_error_message(key))
            value = self._query_params[key]
            if isinstance(value, list):
                if len(value) == 0:
                    return ""
                else:
                    # Return the last value to mimic Tornado's behavior
                    # https://www.tornadoweb.org/en/stable/web.html#tornado.web.RequestHandler.get_query_argument
                    return value[-1]
            return value
        except KeyError:
            raise KeyError(missing_key_error_message(key))

    def __setitem__(self, key: str, value: str | Iterable[str]) -> None:
        self._ensure_single_query_api_used()
        self.__set_item_internal(key, value)
        self._send_query_param_msg()

    def __set_item_internal(self, key: str, value: str | Iterable[str]) -> None:
        if isinstance(value, dict):
            raise StreamlitAPIException(
                f"You cannot set a query params key `{key}` to a dictionary."
            )

        if key in EMBED_QUERY_PARAMS_KEYS:
            raise StreamlitAPIException(
                "Query param embed and embed_options (case-insensitive) cannot be set programmatically."
            )
        # Type checking users should handle the string serialization themselves
        # We will accept any type for the list and serialize to str just in case
        if isinstance(value, Iterable) and not isinstance(value, str):
            self._query_params[key] = [str(item) for item in value]
        else:
            self._query_params[key] = str(value)

    def __delitem__(self, key: str) -> None:
        self._ensure_single_query_api_used()
        try:
            if key in EMBED_QUERY_PARAMS_KEYS:
                raise KeyError(missing_key_error_message(key))
            del self._query_params[key]
            self._send_query_param_msg()
        except KeyError:
            raise KeyError(missing_key_error_message(key))

    def update(
        self,
        other: Iterable[tuple[str, str | Iterable[str]]]
        | SupportsKeysAndGetItem[str, str | Iterable[str]] = (),
        /,
        **kwds: str,
    ):
        # This overrides the `update` provided by MutableMapping
        # to ensure only one one ForwardMsg is sent.
        self._ensure_single_query_api_used()
        if hasattr(other, "keys") and hasattr(other, "__getitem__"):
            for key in other.keys():
                self.__set_item_internal(key, other[key])
        else:
            for key, value in other:
                self.__set_item_internal(key, value)
        for key, value in kwds.items():
            self.__set_item_internal(key, value)
        self._send_query_param_msg()

    def get_all(self, key: str) -> list[str]:
        self._ensure_single_query_api_used()
        if key not in self._query_params or key in EMBED_QUERY_PARAMS_KEYS:
            return []
        value = self._query_params[key]
        return value if isinstance(value, list) else [value]

    def __len__(self) -> int:
        self._ensure_single_query_api_used()
        return len(
            {key for key in self._query_params if key not in EMBED_QUERY_PARAMS_KEYS}
        )

    def __str__(self) -> str:
        self._ensure_single_query_api_used()
        return str(self._query_params)

    def _send_query_param_msg(self) -> None:
        if self._disable_forward_msg:
            return
        ctx = get_script_run_ctx()
        if ctx is None:
            return
        self._ensure_single_query_api_used()

        msg = ForwardMsg()
        msg.page_info_changed.query_string = self.to_string()
        ctx.query_string = msg.page_info_changed.query_string
        ctx.enqueue(msg)

    def clear(self) -> None:
        self._ensure_single_query_api_used()
        self.clear_with_no_forward_msg(preserve_embed=True)
        self._send_query_param_msg()

    def to_dict(self) -> dict[str, str]:
        self._ensure_single_query_api_used()
        # return the last query param if multiple values are set
        return {
            key: self[key]
            for key in self._query_params
            if key not in EMBED_QUERY_PARAMS_KEYS
        }

    def from_dict(
        self,
        _dict: Iterable[tuple[str, str | Iterable[str]]]
        | SupportsKeysAndGetItem[str, str | Iterable[str]],
    ) -> Self:
        self._ensure_single_query_api_used()
        old_value = self._query_params.copy()
        self.clear_with_no_forward_msg(preserve_embed=True)
        try:
            self.update(_dict)
        except StreamlitAPIException:
            # restore the original from before we made any changes.
            self._query_params = old_value
            raise
        return self

    def to_string(self) -> str:
        """Convert this object to a string which can be joined to an existing URL with a '?' character."""
        return parse.urlencode(self._query_params, doseq=True)

    def set_with_no_forward_msg(self, key: str, val: list[str] | str) -> None:
        self._query_params[key] = val

    def clear_with_no_forward_msg(self, preserve_embed: bool = False) -> None:
        self._query_params = {
            key: value
            for key, value in self._query_params.items()
            if key in EMBED_QUERY_PARAMS_KEYS and preserve_embed
        }

    def _ensure_single_query_api_used(self):
        ctx = get_script_run_ctx()
        if ctx is None:
            return
        ctx.mark_production_query_params_used()


def missing_key_error_message(key: str) -> str:
    return f'st.query_params has no key "{key}". Did you forget to initialize it?'
