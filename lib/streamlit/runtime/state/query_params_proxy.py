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

from typing import Dict, Iterable, Iterator, List, MutableMapping, Union

from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.state.query_params import missing_key_error_message
from streamlit.runtime.state.session_state_proxy import get_session_state


class QueryParamsProxy(MutableMapping[str, str]):
    """
    A stateless singleton that proxies ``st.query_params`` interactions
    to the current script thread's QueryParams instance.
    """

    def __iter__(self) -> Iterator[str]:
        with get_session_state().query_params() as qp:
            return iter(qp)

    def __len__(self) -> int:
        with get_session_state().query_params() as qp:
            return len(qp)

    @gather_metrics("query_params.get_item")
    def __getitem__(self, key: str) -> str:
        with get_session_state().query_params() as qp:
            return qp[key]

    def __delitem__(self, key: str) -> None:
        with get_session_state().query_params() as qp:
            del qp[key]

    @gather_metrics("query_params.set_item")
    def __setitem__(self, key: str, value: Union[str, Iterable[str]]) -> None:
        with get_session_state().query_params() as qp:
            qp[key] = value

    @gather_metrics("query_params.get_attr")
    def __getattr__(self, key: str) -> str:
        with get_session_state().query_params() as qp:
            try:
                return qp[key]
            except KeyError:
                raise AttributeError(missing_key_error_message(key))

    def __delattr__(self, key: str) -> None:
        with get_session_state().query_params() as qp:
            try:
                del qp[key]
            except KeyError:
                raise AttributeError(missing_key_error_message(key))

    @gather_metrics("query_params.set_attr")
    def __setattr__(self, key: str, value: Union[str, Iterable[str]]) -> None:
        with get_session_state().query_params() as qp:
            qp[key] = value

    @gather_metrics("query_params.get_all")
    def get_all(self, key: str) -> List[str]:
        """
        Get a list of all query parameter values associated to a given key.

        When a key is repeated as a query parameter within the URL, this method
        allows all values to be obtained. In contrast, dict-like methods only
        retrieve the last value when a key is repeated in the URL.

        Parameters
        ----------
        key: str
            The label of the query parameter in the URL.

        Returns
        -------
        List[str]
            A list of values associated to the given key. May return zero, one,
            or multiple values.
        """
        with get_session_state().query_params() as qp:
            return qp.get_all(key)

    @gather_metrics("query_params.clear")
    def clear(self) -> None:
        """
        Clear all query parameters from the URL of the app.

        Returns
        -------
        None
        """
        with get_session_state().query_params() as qp:
            qp.clear()

    @gather_metrics("query_params.to_dict")
    def to_dict(self) -> Dict[str, str]:
        """
        Get all query parameters as a dictionary.

        When a key is repeated as a query parameter within the URL, this method
        will return only the last value of each unique key.

        Returns
        -------
        Dict[str,str]
            A dictionary of the current query paramters in the app's URL.
        """
        with get_session_state().query_params() as qp:
            return qp.to_dict()
