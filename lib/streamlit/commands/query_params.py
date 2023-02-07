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
from typing import Any, Dict, List

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

    query_params = parse.parse_qs(ctx.query_string)

    # Drop any embed, embed_options query params
    util.drop_key_query_params(query_params, keys_to_drop=EMBED_QUERY_PARAMS_KEYS)

    return query_params


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

    all_current_params = parse.parse_qs(ctx.query_string)
    current_embed_params = util.extract_key_query_params(
        all_current_params, param_key=EMBED_QUERY_PARAM
    )
    current_embed_options_params = util.extract_key_query_params(
        all_current_params, param_key=EMBED_OPTIONS_QUERY_PARAM
    )
    current_embed_params = f"{current_embed_params}{current_embed_options_params}"

    # Drop any embed, embed_options query params
    key_was_dropped = util.drop_key_query_params(
        query_params, keys_to_drop=EMBED_QUERY_PARAMS_KEYS
    )
    if key_was_dropped:
        raise StreamlitAPIException(
            "Query param embed and embed_options (case-insensitive) cannot be set using set_query_params method."
        )

    query_string = parse.urlencode(query_params, doseq=True)
    if len(query_string) > 0:
        query_string += current_embed_params
    else:
        query_string = current_embed_params[1:]

    ctx.query_string = query_string
    msg = ForwardMsg()
    msg.page_info_changed.query_string = ctx.query_string
    ctx.enqueue(msg)
