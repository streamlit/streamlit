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

"""
This directory contains the files and modules for the exposed API.
"""

import streamlit

# The `custom_component as components` import exists as existing custom components have started
# to rely on internals of the components package. For example, streamlit-option-menu accesses
# [register_widget](https://github.com/victoryhb/streamlit-option-menu/blob/master/streamlit_option_menu/streamlit_callback.py#L28),
# which is only a transitive import through `streamlit.components.v1.custom_component`.
# Since we do not know what other internals are used out in the wild, let's try to
# model the old behavior and not to break things. Ideally, custom component implementors
# use officially exposed APIs only or do direct imports instead of indirect imports.
from streamlit.components.v1 import custom_component as components
from streamlit.components.v1.component_registry import declare_component

# `html` and `iframe` are part of Custom Components, so they appear in this
# `streamlit.components.v1` namespace.
html = streamlit._main._html
iframe = streamlit._main._iframe

__all__ = [
    "components",
    "declare_component",
    "html",
    "iframe",
]
