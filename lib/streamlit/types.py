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

"""Typing provider for streamlit."""

from streamlit.color_util import Color
from streamlit.commands.page_config import InitialSideBarState, PageIcon
from streamlit.components.v1.custom_component import CustomComponent
from streamlit.connections import BaseConnection, SnowflakeConnection, SQLConnection
from streamlit.dataframe_util import OptionSequence
from streamlit.delta_generator import DeltaGenerator
from streamlit.elements.widgets.data_editor import DataTypes, EditableData
from streamlit.elements.widgets.number_input import Number
from streamlit.navigation.page import StreamlitPage
from streamlit.runtime.uploaded_file_manager import UploadedFile

__all__ = [
    "DeltaGenerator",
    "Number",
    "DataTypes",
    "EditableData",
    "UploadedFile",
    "OptionSequence",
    "StreamlitPage",
    "Color",
    "BaseConnection",
    "SQLConnection",
    "SnowflakeConnection",
    "CustomComponent",
    "PageIcon",
    "InitialSideBarState",
]
