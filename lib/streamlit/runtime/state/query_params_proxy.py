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

from typing import Any, Dict, Iterator, List, MutableMapping

from streamlit.runtime.state.query_params import (
    QueryParams,
    _missing_key_error_message_query_params,
)
from streamlit.runtime.state.session_state_proxy import get_session_state
from streamlit.type_util import Key


def get_query_params() -> QueryParams:
    from streamlit.runtime.scriptrunner import get_script_run_ctx

    ctx = get_script_run_ctx()

    if ctx is None:
        return QueryParams()
    return get_session_state()._state._query_params


class QueryParamsProxy(MutableMapping[Key, Any]):
    """A stateless singleton that proxies `st.query_params` interactions
    to the current script thread's QueryParams instance. It stores str keys with str and List[str] values.
    """

    def __iter__(self) -> Iterator[Any]:
        return iter(get_query_params())

    def __len__(self) -> int:
        return len(get_query_params())

    def __getitem__(self, key: str) -> str:  # type: ignore[override]
        return get_query_params()[key]

    def __getattr__(self, key: str) -> str:
        try:
            return get_query_params()[key]
        except KeyError:
            raise AttributeError(_missing_key_error_message_query_params(key))

    def __delitem__(self, key: str) -> None:  # type: ignore[override]
        del get_query_params()[key]

    def __delattr__(self, key: str) -> None:
        try:
            del get_query_params()[key]
        except KeyError:
            raise AttributeError(_missing_key_error_message_query_params(key))

    def __setattr__(self, key: str, value: Any) -> None:
        try:
            get_query_params()[key] = value
        except KeyError:
            raise AttributeError(_missing_key_error_message_query_params(key))

    def __setitem__(self, key: str, value: str) -> None:  # type: ignore[override]
        get_query_params()[key] = value

    def get_all(self, key: str) -> List[str]:
        return get_query_params().get_all(key)

    def __contains__(self, key: str) -> bool:  # type: ignore[override]
        return key in get_query_params()

    def clear(self) -> None:
        get_query_params().clear()

    def get(self, key: str, default: Any = None) -> str:  # type: ignore[override]
        return get_query_params().get(key, default)

    def to_dict(self) -> Dict[str, List[str] | str]:
        return get_query_params().to_dict()
