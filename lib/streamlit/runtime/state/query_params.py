# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from collections.abc import Iterable, Iterator, Mapping, MutableMapping
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Final, cast
from urllib import parse

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

QueryParamScalar = str | int | float | bool | None | bytes
QueryParamValue = QueryParamScalar | Iterable[QueryParamScalar]
QueryParamsMappingInput = Mapping[str, QueryParamValue]
QueryParamsSequenceInput = Iterable[tuple[str, QueryParamValue]]
QueryParamsInput = QueryParamsMappingInput | QueryParamsSequenceInput


@dataclass
class QueryParams(MutableMapping[str, str]):
    """A lightweight wrapper of a dict that sends forwardMsgs when state changes.
    It stores str keys with str and List[str] values.
    """

    _query_params: dict[str, list[str] | str] = field(default_factory=dict)

    def __iter__(self) -> Iterator[str]:
        self._ensure_single_query_api_used()

        return iter(
            key for key in self._query_params if key not in EMBED_QUERY_PARAMS_KEYS
        )

    def __getitem__(self, key: str) -> str:
        """Retrieves a value for a given key in query parameters.
        Returns the last item in a list or an empty string if empty.
        If the key is not present, raise KeyError.
        """
        self._ensure_single_query_api_used()
        if key in EMBED_QUERY_PARAMS_KEYS:
            raise KeyError(missing_key_error_message(key))

        try:
            value = self._query_params[key]
            if isinstance(value, list):
                if len(value) == 0:
                    return ""
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

        _validate_query_param_key(key)
        # Type checking users should handle the string serialization themselves
        # We will accept any type for the list and serialize to str just in case
        if isinstance(value, Iterable) and not isinstance(value, str):
            self._query_params[key] = [str(item) for item in value]
        else:
            self._query_params[key] = str(value)

    def __delitem__(self, key: str) -> None:
        self._ensure_single_query_api_used()
        if key in EMBED_QUERY_PARAMS_KEYS:
            raise KeyError(missing_key_error_message(key))
        try:
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
    ) -> None:
        # This overrides the `update` provided by MutableMapping
        # to ensure only one one ForwardMsg is sent.
        self._ensure_single_query_api_used()
        if hasattr(other, "keys") and hasattr(other, "__getitem__"):
            other = cast("SupportsKeysAndGetItem[str, str | Iterable[str]]", other)
            for key in other.keys():  # noqa: SIM118
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
        ctx = get_script_run_ctx()
        if ctx is None:
            return
        self._ensure_single_query_api_used()

        msg = ForwardMsg()
        msg.page_info_changed.query_string = parse.urlencode(
            self._query_params, doseq=True
        )
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
    ) -> None:
        self._ensure_single_query_api_used()
        old_value = self._query_params.copy()
        self.clear_with_no_forward_msg(preserve_embed=True)
        try:
            self.update(_dict)
        except StreamlitAPIException:
            # restore the original from before we made any changes.
            self._query_params = old_value
            raise

    def set_with_no_forward_msg(self, key: str, val: list[str] | str) -> None:
        self._query_params[key] = val

    def clear_with_no_forward_msg(self, preserve_embed: bool = False) -> None:
        self._query_params = {
            key: value
            for key, value in self._query_params.items()
            if key in EMBED_QUERY_PARAMS_KEYS and preserve_embed
        }

    def _ensure_single_query_api_used(self) -> None:
        ctx = get_script_run_ctx()
        if ctx is None:
            return
        ctx.mark_production_query_params_used()


def missing_key_error_message(key: str) -> str:
    return f'st.query_params has no key "{key}".'


def _validate_query_param_key(key: str) -> None:
    if key.lower() in EMBED_QUERY_PARAMS_KEYS:
        raise StreamlitAPIException(
            "Query param embed and embed_options (case-insensitive) cannot be set programmatically."
        )


def _stringify_query_param_scalar(value: QueryParamScalar) -> str:
    if value is None:
        return ""

    if isinstance(value, bytes):
        return value.decode()

    return str(value)


def _iter_query_param_items(
    query_params: QueryParamsInput,
) -> Iterable[tuple[str, QueryParamValue]]:
    if isinstance(query_params, Mapping):
        return query_params.items()
    return query_params


def flatten_query_params(query_params: QueryParamsInput) -> list[tuple[str, str]]:
    """Normalize query params input into a flat list of string tuples."""

    flattened: list[tuple[str, str]] = []
    for raw_key, raw_value in _iter_query_param_items(query_params):
        if not isinstance(raw_key, str):
            raise StreamlitAPIException(
                "Query parameter keys must be strings when passed to query_params."
            )

        if isinstance(raw_value, dict):
            raise StreamlitAPIException(
                f"You cannot set a query params key `{raw_key}` to a dictionary."
            )

        _validate_query_param_key(raw_key)

        if isinstance(raw_value, Iterable) and not isinstance(raw_value, (str, bytes)):
            for item in raw_value:
                flattened.append((raw_key, _stringify_query_param_scalar(item)))  # noqa: PERF401
        else:
            flattened.append((raw_key, _stringify_query_param_scalar(raw_value)))

    return flattened


def merge_query_params(
    existing_query: str | None,
    new_query_params: QueryParamsInput | None,
) -> tuple[str | None, list[tuple[str, str]]]:
    """Merge existing query string with new query params input."""

    existing_pairs: list[tuple[str, str]] = []
    if existing_query:
        existing_pairs = parse.parse_qsl(existing_query, keep_blank_values=True)
        for key, _ in existing_pairs:
            _validate_query_param_key(key)

    if new_query_params is None:
        if not existing_pairs:
            return None, []
        result = parse.urlencode(existing_pairs, doseq=True)
        return (result if result else None), existing_pairs

    new_pairs = flatten_query_params(new_query_params)
    override_keys = {key.lower() for key, _ in new_pairs}
    filtered_existing = [
        (key, value)
        for key, value in existing_pairs
        if key.lower() not in override_keys
    ]
    combined_pairs = filtered_existing + new_pairs

    query_string = parse.urlencode(combined_pairs, doseq=True)
    return (query_string if query_string else None), combined_pairs


def pairs_to_query_dict(pairs: Iterable[tuple[str, str]]) -> dict[str, str | list[str]]:
    """Convert flat pairs into a mapping suitable for QueryParams.update."""

    multi: dict[str, list[str]] = {}
    for key, value in pairs:
        multi.setdefault(key, []).append(value)

    return {
        key: values[0] if len(values) == 1 else values for key, values in multi.items()
    }
