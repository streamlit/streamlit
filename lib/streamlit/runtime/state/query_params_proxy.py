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

from __future__ import annotations

from collections.abc import Iterable, Iterator, MutableMapping
from typing import TYPE_CHECKING, Any, overload

from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.state.session_state_proxy import get_session_state

if TYPE_CHECKING:
    from _typeshed import SupportsKeysAndGetItem


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

    def __str__(self) -> str:
        with get_session_state().query_params() as qp:
            return str(qp)

    @gather_metrics("query_params.get_item")
    def __getitem__(self, key: str) -> str:
        with get_session_state().query_params() as qp:
            try:
                return qp[key]
            except KeyError:
                raise KeyError(self.missing_key_error_message(key))

    def __delitem__(self, key: str) -> None:
        with get_session_state().query_params() as qp:
            del qp[key]

    @gather_metrics("query_params.set_item")
    def __setitem__(self, key: str, value: Any) -> None:
        with get_session_state().query_params() as qp:
            qp[key] = value

    @gather_metrics("query_params.get_attr")
    def __getattr__(self, key: str) -> str:
        with get_session_state().query_params() as qp:
            try:
                return qp[key]
            except KeyError:
                raise AttributeError(self.missing_attr_error_message(key))

    def __delattr__(self, key: str) -> None:
        with get_session_state().query_params() as qp:
            try:
                del qp[key]
            except KeyError:
                raise AttributeError(self.missing_key_error_message(key))

    @overload
    def update(
        self, params: SupportsKeysAndGetItem[str, str | Iterable[str]], /, **kwds: str
    ) -> None: ...

    @overload
    def update(
        self, params: Iterable[tuple[str, str | Iterable[str]]], /, **kwds: str
    ) -> None: ...

    @overload
    def update(self, **kwds: str | Iterable[str]) -> None: ...

    def update(self, params=(), /, **kwds) -> None:  # type: ignore
        """
        Update one or more values in query_params at once from a dictionary or
        dictionary-like object.

        See `Mapping.update()` from Python's `collections` library.

        Parameters
        ----------
        other: SupportsKeysAndGetItem[str, str] | Iterable[tuple[str, str]]
            A dictionary or mapping of strings to strings.
        **kwds: str
            Additional key/value pairs to update passed as keyword arguments.
        """
        with get_session_state().query_params() as qp:
            qp.update(params, **kwds)

    @gather_metrics("query_params.set_attr")
    def __setattr__(self, key: str, value: Any) -> None:
        with get_session_state().query_params() as qp:
            qp[key] = value

    @gather_metrics("query_params.get_all")
    def get_all(self, key: str) -> list[str]:
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
    def to_dict(self) -> dict[str, str]:
        """
        Get all query parameters as a dictionary.

        This method primarily exists for internal use and is not needed for
        most cases. ``st.query_params`` returns an object that inherits from
        ``dict`` by default.

        When a key is repeated as a query parameter within the URL, this method
        will return only the last value of each unique key.

        Returns
        -------
        Dict[str,str]
            A dictionary of the current query parameters in the app's URL.
        """
        with get_session_state().query_params() as qp:
            return qp.to_dict()

    @overload
    def from_dict(self, params: Iterable[tuple[str, str | Iterable[str]]]) -> None: ...

    @overload
    def from_dict(
        self, params: SupportsKeysAndGetItem[str, str | Iterable[str]]
    ) -> None: ...

    @gather_metrics("query_params.from_dict")
    def from_dict(
        self,
        params: SupportsKeysAndGetItem[str, str | Iterable[str]]
        | Iterable[tuple[str, str | Iterable[str]]],
    ) -> None:
        """
        Set all of the query parameters from a dictionary or dictionary-like object.

        This method primarily exists for advanced users who want to control
        multiple query parameters in a single update. To set individual query
        parameters, use key or attribute notation instead.

        This method inherits limitations from ``st.query_params`` and can't be
        used to set embedding options as described in `Embed your app \
        <https://docs.streamlit.io/deploy/streamlit-community-cloud/share-your-app/embed-your-app#embed-options>`_.

        To handle repeated keys, the value in a key-value pair should be a list.

        .. note::
            ``.from_dict()`` is not a direct inverse of ``.to_dict()`` if
            you are working with repeated keys. A true inverse operation is
            ``{key: st.query_params.get_all(key) for key in st.query_params}``.

        Parameters
        ----------
        params: dict
            A dictionary used to replace the current query parameters.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> st.query_params.from_dict({"foo": "bar", "baz": [1, "two"]})

        """
        with get_session_state().query_params() as qp:
            return qp.from_dict(params)

    @staticmethod
    def missing_key_error_message(key: str) -> str:
        """Returns a formatted error message for missing keys."""
        return f'st.query_params has no key "{key}".'

    @staticmethod
    def missing_attr_error_message(key: str) -> str:
        """Returns a formatted error message for missing attributes."""
        return f'st.query_params has no attribute "{key}".'
