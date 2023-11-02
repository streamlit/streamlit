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
from typing import Any, Dict, Iterator, List, Set, Union

from streamlit import util
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx

EMBED_QUERY_PARAM = "embed"
EMBED_OPTIONS_QUERY_PARAM = "embed_options"
EMBED_QUERY_PARAMS_KEYS = [EMBED_QUERY_PARAM, EMBED_OPTIONS_QUERY_PARAM]


@gather_metrics("experimental_get_query_params")
def get_query_params() -> Dict[str, List[str]]:
    """Return the query parameters that is currently showing in the browser's URL bar.

    Returns
    -------
    dict
      The current query parameters as a dict. "Query parameters" are the part of the URL that comes
      after the first "?".

    Example
    -------
    Let's say the user's web browser is at
    `http://localhost:8501/?show_map=True&selected=asia&selected=america`.
    Then, you can get the query parameters using the following:

    >>> import streamlit as st
    >>>
    >>> st.experimental_get_query_params()
    {"show_map": ["True"], "selected": ["asia", "america"]}

    Note that the values in the returned dict are *always* lists. This is
    because we internally use Python's urllib.parse.parse_qs(), which behaves
    this way. And this behavior makes sense when you consider that every item
    in a query string is potentially a 1-element array.

    """
    ctx = get_script_run_ctx()
    if ctx is None:
        return {}
    # Return new query params dict, but without embed, embed_options query params
    return util.exclude_key_query_params(
        parse.parse_qs(ctx.query_string, keep_blank_values=True),
        keys_to_exclude=EMBED_QUERY_PARAMS_KEYS,
    )


@gather_metrics("experimental_set_query_params")
def set_query_params(**query_params: Any) -> None:
    """Set the query parameters that are shown in the browser's URL bar.

    .. warning::
        Query param `embed` cannot be set using this method.

    Parameters
    ----------
    **query_params : dict
        The query parameters to set, as key-value pairs.

    Example
    -------

    To point the user's web browser to something like
    "http://localhost:8501/?show_map=True&selected=asia&selected=america",
    you would do the following:

    >>> import streamlit as st
    >>>
    >>> st.experimental_set_query_params(
    ...     show_map=True,
    ...     selected=["asia", "america"],
    ... )

    """
    ctx = get_script_run_ctx()
    if ctx is None:
        return

    msg = ForwardMsg()
    msg.page_info_changed.query_string = _ensure_no_embed_params(
        query_params, ctx.query_string
    )
    ctx.query_string = msg.page_info_changed.query_string
    ctx.enqueue(msg)


def _ensure_no_embed_params(
    query_params: Dict[str, Union[List[Any], str]], query_string: str
) -> str:
    """Ensures there are no embed params set (raises StreamlitAPIException) if there is a try,
    also makes sure old param values in query_string are preserved. Returns query_string : str."""
    # Get query params dict without embed, embed_options params
    query_params_without_embed = util.exclude_key_query_params(
        query_params, keys_to_exclude=EMBED_QUERY_PARAMS_KEYS
    )
    if query_params != query_params_without_embed:
        raise StreamlitAPIException(
            "Query param embed and embed_options (case-insensitive) cannot be set using set_query_params method."
        )

    all_current_params = parse.parse_qs(query_string, keep_blank_values=True)
    current_embed_params = parse.urlencode(
        {
            EMBED_QUERY_PARAM: [
                param
                for param in util.extract_key_query_params(
                    all_current_params, param_key=EMBED_QUERY_PARAM
                )
            ],
            EMBED_OPTIONS_QUERY_PARAM: [
                param
                for param in util.extract_key_query_params(
                    all_current_params, param_key=EMBED_OPTIONS_QUERY_PARAM
                )
            ],
        },
        doseq=True,
    )
    query_string = parse.urlencode(query_params, doseq=True)

    if query_string:
        separator = "&" if current_embed_params else ""
        return separator.join([query_string, current_embed_params])
    return current_embed_params


def _missing_key_error_message(key: str) -> str:
    return f'st.query_params has no key "{key}". Did you forget to initialize it? '


@dataclass
class QueryParams:
    """A dict-like representation of query params.
    The main difference is that it only stores and returns str and List[str].

    TODO(willhuang1997): Fill in these docs with examples and fix doc above. Above is just a stub for now.
    """

    _query_params: Dict[str, Union[List[str], str]] = field(default_factory=dict)

    def __init__(self, query_params: Dict[str, Union[List[str], str]] = {}):
        # avoid using ._query_params as that will use __setattr__
        # and access _query_params which is None as _query_params isn't initialized
        self.__dict__["_query_params"] = query_params

    def _keys(self) -> Set[str]:
        return set(self._query_params.keys())

    def get(self, key: str, default: Any = None) -> Any:
        if key in self._query_params:
            return self._getitem(key)
        else:
            if default != None:
                self._setitem(key, default)

    def __iter__(self) -> Iterator[Any]:
        return iter(self._keys())

    def __getitem__(self, key: str) -> Any:
        return self._getitem(key)

    def _getitem(self, key: str) -> str:
        ctx = get_script_run_ctx()
        if ctx is None:
            return  # type: ignore
        try:
            value = self._query_params[key]
            if isinstance(value, list):
                # This should never happen as you can't set a key to an empty array
                if len(value) == 0:
                    return ""
                else:
                    return value[-1]
            return value
        except:
            raise KeyError(_missing_key_error_message(key))

    def _setitem(self, key: str, value: Any) -> None:
        if isinstance(value, list):
            self._query_params[key] = util.convert_to_strings_in_list(value)
        else:
            self._query_params[key] = str(value)
        self._send_query_param_msg()

    def __setitem__(self, key: str, value: Any) -> None:
        self._setitem(key, value)

    def get_all(self, key: str) -> List[str]:
        ctx = get_script_run_ctx()
        if ctx is None:
            return  # type: ignore
        try:
            if key not in self._query_params:
                return []
            query_params = self._query_params[key]
            return (
                query_params
                if isinstance(query_params, list)
                else [self._query_params[key]]  # type: ignore
            )
        except KeyError:
            raise KeyError(_missing_key_error_message(key))

    def __getattr__(self, key: str) -> str:
        try:
            return self._getitem(key)
        except KeyError:
            raise AttributeError(_missing_key_error_message(key))

    def __setattr__(self, key: str, value: Any) -> None:
        self._setitem(key, value)

    def __delattr__(self, key: str) -> None:
        self.__delitem__(key)

    def __contains__(self, key: str) -> bool:
        return key in self._query_params

    def __len__(self) -> int:
        return len(self._query_params)

    def _send_query_param_msg(self) -> None:
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
