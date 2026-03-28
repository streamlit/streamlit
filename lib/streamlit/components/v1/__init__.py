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

"""Contains the files and modules for the exposed API."""

import streamlit
from streamlit.components.v1.component_registry import declare_component
from streamlit.deprecation_util import deprecate_func_name

# `html` and `iframe` are part of Custom Components, so they appear in this
# `streamlit.components.v1` namespace. They are deprecated in favor of st.iframe.
html = deprecate_func_name(
    streamlit._main._html,
    "components.v1.html",
    "2026-06-01",
    name_override="iframe",
    include_st_prefix=True,
    show_in_browser=False,
    show_once=False,
)

iframe = deprecate_func_name(
    streamlit._main._iframe,
    "components.v1.iframe",
    "2026-06-01",
    name_override="iframe",
    include_st_prefix=True,
    show_in_browser=False,
    show_once=False,
)

__all__ = [
    "declare_component",
    "html",
    "iframe",
]
