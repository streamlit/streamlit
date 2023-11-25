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

from typing import Any, Dict, Iterator, List, MutableMapping, Union

from streamlit.runtime.state.query_params import _missing_key_error_message
from streamlit.runtime.state.session_state_proxy import get_session_state


class QueryParamsProxy(MutableMapping[str, Any]):
    """A stateless singleton that proxies `st.query_params` interactions
    to the current script thread's QueryParams instance.
    """

    def __iter__(self) -> Iterator[Any]:
        with get_session_state().query_params() as qp:
            return iter(qp)

    def __len__(self) -> int:
        with get_session_state().query_params() as qp:
            return len(qp)

    def __getitem__(self, key: str) -> Union[str, str]:
        with get_session_state().query_params() as qp:
            return qp[key]

    def __delitem__(self, key: str) -> None:
        with get_session_state().query_params() as qp:
            del qp[key]

    def __setitem__(self, key: str, value: Union[str, List[str]]) -> None:
        with get_session_state().query_params() as qp:
            qp[key] = value
            print(f"{qp[key]=}")

    def __getattr__(self, key: str) -> str:
        with get_session_state().query_params() as qp:
            try:
                return qp[key]
            except KeyError:
                raise AttributeError(_missing_key_error_message(key))

    def __delattr__(self, key: str) -> None:
        with get_session_state().query_params() as qp:
            try:
                del qp[key]
            except KeyError:
                raise AttributeError(_missing_key_error_message(key))

    def __setattr__(self, key: str, value: Union[str, List[str]]) -> None:
        with get_session_state().query_params() as qp:
            try:
                qp[key] = value
            except KeyError:
                raise AttributeError(_missing_key_error_message(key))

    def get_all(self, key: str) -> List[str]:
        with get_session_state().query_params() as qp:
            return qp.get_all(key)

    def clear(self) -> None:
        with get_session_state().query_params() as qp:
            qp.clear()

    def to_dict(self) -> Dict[str, Union[List[str], str]]:
        with get_session_state().query_params() as qp:
            return qp.to_dict()
