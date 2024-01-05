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

from dataclasses import dataclass, field
from typing import Dict, Iterable, Iterator, List, MutableMapping, Union

from streamlit.errors import StreamlitAPIException
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg


@dataclass
class QueryParams(MutableMapping[str, str]):
    """A lightweight wrapper of a dict that sends forwardMsgs when state changes.
    It stores str keys with str and List[str] values.
    """

    _query_params: Dict[str, Union[List[str], str]] = field(default_factory=dict)

    def __iter__(self) -> Iterator[str]:
        self._ensure_single_query_api_used()
        return iter(self._query_params.keys())

    def __getitem__(self, key: str) -> str:
        """Retrieves a value for a given key in query parameters.
        Returns the last item in a list or an empty string if empty.
        If the key is not present, raise KeyError.
        """
        self._ensure_single_query_api_used()
        try:
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

    def __setitem__(self, key: str, value: Union[str, Iterable[str]]) -> None:
        if isinstance(value, dict):
            raise StreamlitAPIException(
                f"You cannot set a query params key `{key}` to a dictionary."
            )

        # Type checking users should handle the string serialization themselves
        # We will accept any type for the list and serialize to str just in case
        if isinstance(value, Iterable) and not isinstance(value, str):
            self._query_params[key] = [str(item) for item in value]
        else:
            self._query_params[key] = str(value)
        self._send_query_param_msg()

    def __delitem__(self, key: str) -> None:
        try:
            del self._query_params[key]
            self._send_query_param_msg()
        except KeyError:
            raise KeyError(missing_key_error_message(key))

    def get_all(self, key: str) -> List[str]:
        self._ensure_single_query_api_used()
        if key not in self._query_params:
            return []
        value = self._query_params[key]
        return value if isinstance(value, list) else [value]

    def __len__(self) -> int:
        self._ensure_single_query_api_used()
        return len(self._query_params)

    def _send_query_param_msg(self) -> None:
        # Avoid circular imports
        from streamlit.commands.experimental_query_params import _ensure_no_embed_params
        from streamlit.runtime.scriptrunner import get_script_run_ctx

        ctx = get_script_run_ctx()
        if ctx is None:
            return
        self._ensure_single_query_api_used()

        msg = ForwardMsg()
        msg.page_info_changed.query_string = _ensure_no_embed_params(
            self._query_params, ctx.query_string
        )
        ctx.query_string = msg.page_info_changed.query_string
        ctx.enqueue(msg)

    def clear(self) -> None:
        self._query_params.clear()
        self._send_query_param_msg()

    def to_dict(self) -> Dict[str, str]:
        self._ensure_single_query_api_used()
        # return the last query param if multiple keys are set
        return {key: self[key] for key in self._query_params}

    def set_with_no_forward_msg(self, key: str, val: Union[List[str], str]) -> None:
        # Avoid circular imports
        from streamlit.commands.experimental_query_params import EMBED_QUERY_PARAMS_KEYS

        if key.lower() in EMBED_QUERY_PARAMS_KEYS:
            return
        self._query_params[key] = val

    def clear_with_no_forward_msg(self) -> None:
        self._query_params.clear()

    def _ensure_single_query_api_used(self):
        # Avoid circular imports
        from streamlit.runtime.scriptrunner import get_script_run_ctx

        ctx = get_script_run_ctx()
        if ctx is None:
            return
        ctx.mark_production_query_params_used()


def missing_key_error_message(key: str) -> str:
    return f'st.query_params has no key "{key}". Did you forget to initialize it?'
