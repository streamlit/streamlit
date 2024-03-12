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

from __future__ import annotations

import json
from typing import Any

from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx


@gather_metrics("get_theme")
def get_theme() -> dict[str, Any]:
    """Return the current theme settings.

    Returns
    -------
    dict
      The current theme settings as a dict.

    Example
    -------
    You can get the current theme settings using the following:

    >>> import streamlit as st
    >>>
    >>> st.get_theme()
    {"primaryColor": "#f63366", "backgroundColor": "#f0f0f0", "secondaryBackgroundColor": "#d3d3d3", "textColor": "#262730", "font": "sans-serif", "codeFont": "monospace"}

    """
    ctx = get_script_run_ctx()
    if ctx is None:
        raise RuntimeError("Not in a script context")

    return json.loads(ctx.theme_data)
