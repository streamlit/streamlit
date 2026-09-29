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

"""Public Streamlit-owned types for annotating app and library code.

This namespace collects a curated set of stable, documented types produced by
Streamlit commands (or stored in Session State) that users may need to name in
function parameters, return annotations, and shared helpers. Import them from
``streamlit.typing`` (or ``st.typing``) instead of Streamlit's internal modules::

    import streamlit as st
    from streamlit.typing import UploadedFile


    def parse_upload(file: UploadedFile) -> dict[str, str]: ...

The re-exported objects are the same runtime classes returned by the corresponding
``st.*`` commands, so ``isinstance`` checks and attribute/item access behave normally.
Values are normally obtained from Streamlit commands rather than constructed directly.
"""

from __future__ import annotations

from streamlit.elements.arrow import DataframeState
from streamlit.elements.deck_gl_json_chart import PydeckState
from streamlit.elements.lib.column_config_utils import ButtonColumnClickState
from streamlit.elements.plotly_chart import PlotlyState
from streamlit.elements.vega_charts import VegaLiteState
from streamlit.elements.widgets.chat import ChatInputValue
from streamlit.elements.widgets.data_editor import DataEditorState
from streamlit.runtime.uploaded_file_manager import UploadedFile

__all__ = [
    "ButtonColumnClickState",
    "ChatInputValue",
    "DataEditorState",
    "DataframeState",
    "PlotlyState",
    "PydeckState",
    "UploadedFile",
    "VegaLiteState",
]
