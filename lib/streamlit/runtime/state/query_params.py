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

from dataclasses import dataclass, field
from typing import Any, Dict, Iterator, List, MutableMapping, Union

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg


@dataclass
class QueryParams(MutableMapping[str, Any]):
    """A lightweight wrapper of a dict that sends forwardMsgs when state changes.
    It stores str keys with str and List[str] values.
    """

    _query_params: Dict[str, Union[List[str], str]] = field(default_factory=dict)

    def __init__(self):
        # avoid using ._query_params as that will use __setattr__,
        # which itself relies on `_query_params` being defined
        self.__dict__["_query_params"] = {}

    def __iter__(self) -> Iterator[Any]:
        return iter(self._query_params.keys())

    def __getitem__(self, key: str) -> str:
        try:
            value = self._query_params[key]
            if isinstance(value, list):
                if len(value) == 0:
                    return ""
                else:
                    return value[-1]
            return value
        except:
            raise KeyError(_missing_key_error_message(key))

    def __setitem__(self, key: str, value: Union[str, List[str]]) -> None:
        # Handle non-string inputs like integers or lists by converting them to
        # strings for consistent query parameter handling.
        if isinstance(value, list):
            self._query_params[key] = [str(item) for item in value]
        else:
            self._query_params[key] = str(value)
        self._send_query_param_msg()

    def get_all(self, key: str) -> List[str]:
        try:
            if key not in self._query_params:
                return []
            query_params = self._query_params[key]
            return query_params if isinstance(query_params, list) else [query_params]
        except KeyError:
            raise KeyError(_missing_key_error_message(key))

    def __getattr__(self, key: str) -> str:
        try:
            return self.__getitem__(key)
        except KeyError:
            raise AttributeError(_missing_key_error_message(key))

    def __setattr__(self, key: str, value: Union[str, List[str]]) -> None:
        try:
            self.__setitem__(key, value)
        except KeyError:
            raise AttributeError(_missing_key_error_message(key))

    def __delattr__(self, key: str) -> None:
        try:
            self.__delitem__(key)
        except KeyError:
            raise AttributeError(_missing_key_error_message(key))

    def __contains__(self, key: Any) -> bool:
        if isinstance(key, str):
            return key in self._query_params
        return False

    def __len__(self) -> int:
        return len(self._query_params)

    def _send_query_param_msg(self) -> None:
        # Avoid circular imports
        from streamlit.commands.experimental_query_params import _ensure_no_embed_params
        from streamlit.runtime.scriptrunner import get_script_run_ctx

        ctx = get_script_run_ctx()
        if ctx is None:
            return
        msg = ForwardMsg()
        msg.page_info_changed.query_string = _ensure_no_embed_params(
            self._query_params, ctx.query_string
        )
        ctx.query_string = msg.page_info_changed.query_string
        ctx.enqueue(msg)

    def clear(self) -> None:
        self._query_params.clear()
        self._send_query_param_msg()

    def __delitem__(self, key: str) -> None:
        if key in self._query_params:
            del self._query_params[key]
            self._send_query_param_msg()
        else:
            raise KeyError(_missing_key_error_message(key))

    def to_dict(self) -> Dict[str, str]:
        return {key: self[key] for key in self._query_params}


def _missing_key_error_message(key: str) -> str:
    return f'st.query_params has no key "{key}". Did you forget to initialize it?'
