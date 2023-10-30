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

import urllib.parse as parse
from dataclasses import dataclass, field
from typing import Any, Dict, List

from streamlit import util
from streamlit.commands.query_params import _ensure_no_embed_params
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.scriptrunner import get_script_run_ctx

EMBED_QUERY_PARAM = "embed"
EMBED_OPTIONS_QUERY_PARAM = "embed_options"
EMBED_QUERY_PARAMS_KEYS = [EMBED_QUERY_PARAM, EMBED_OPTIONS_QUERY_PARAM]


@dataclass
class QueryParams:
    """
    A dict-like representation of query params that generally behaves like st.session.state.
    The main difference is that it only stores and returns str and list[str].

    TODO(willhuang1997): Fill in these docs with examples and fix doc above. Above is just a stub for now.
    """

    query_params: dict[str, List[Any]] = field(default_factory=dict)

    def _missing_key_error_message(key: str) -> str:
        return f'st.query_params has no key "{key}". Did you forget to initialize it? '

    def __repr__(self):
        return util.repr_(self)

    def _keys(self) -> set[str]:
        return self.query_params.keys()

    def get(self, key: str) -> Any:
        return self._getitem(key)

    def __getitem__(self, key: str) -> Any:
        return self._getitem(key)

    def _getitem(self, key: str) -> Dict[str, Any]:
        ctx = get_script_run_ctx()
        if ctx is None:
            return {}
        try:
            if len(self.query_params[key]) == 0:
                return ""
            return (
                self.query_params[key][-1]
                if isinstance(self.query_params[key], list)
                else self.query_params[key]
            )
        except:
            raise KeyError(key)

    def __setitem__(self, key: str, value: Any) -> None:
        ctx = get_script_run_ctx()
        if ctx is None:
            return

        msg = ForwardMsg()
        self.query_params[key] = value
        msg.page_info_changed.query_string = _ensure_no_embed_params(
            self.query_params, ctx.query_string
        )
        ctx.query_string = msg.page_info_changed.query_string
        self.query_params = util.unwrap_single_element_lists(
            util.exclude_key_query_params(
                parse.parse_qs(ctx.query_string, keep_blank_values=True),
                keys_to_exclude=EMBED_QUERY_PARAMS_KEYS,
            )
        )
        ctx.enqueue(msg)

    def get_all(self, key: str) -> Dict[str, Any]:
        ctx = get_script_run_ctx()
        if ctx is None:
            return {}
        try:
            if key not in self.query_params:
                return []
            query_params = self.query_params[key]
            return (
                query_params
                if isinstance(query_params, list)
                else [self.query_params[key]]
            )
        except:
            raise KeyError(key)

    def clear(self):
        ctx = get_script_run_ctx()
        if ctx is None:
            return
        self.query_params.clear()
        msg = ForwardMsg()
        msg.page_info_changed.query_string = _ensure_no_embed_params(
            self.query_params, ctx.query_string
        )
        ctx.query_string = msg.page_info_changed.query_string
        ctx.enqueue(msg)

    def __delitem__(self, key: str) -> None:
        ctx = get_script_run_ctx()
        if ctx is None:
            return {}
        if key in self.query_params:
            del self.query_params[key]
        msg = ForwardMsg()
        msg.page_info_changed.query_string = _ensure_no_embed_params(
            self.query_params, ctx.query_string
        )
        ctx.query_string = msg.page_info_changed.query_string
        ctx.enqueue(msg)
