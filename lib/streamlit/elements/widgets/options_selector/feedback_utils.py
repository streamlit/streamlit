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

from typing import Callable, Literal

from streamlit.elements.widgets.options_selector.options_selector_utils import (
    MultiSelectSerde,
)

CustomIconList = list[str]
FeedbackOptions = Literal["thumbs", "smiles", "stars"]

thumb_icons = [":material/thumb_up:", ":material/thumb_down:"]
smile_icons = [
    ":material/sentiment_sad:",
    ":material/sentiment_dissatisfied:",
    ":material/sentiment_neutral:",
    ":material/sentiment_satisfied:",
    ":material/sentiment_very_satisfied:",
]
number_stars = 5
star_icon = ":material/star_rate:"
selected_star_icon = (
    "<img src='data:image/svg+xml;base64,"
    "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9"
    "zdmciIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0Ij48cGF0aCBkPSJNMCAwaDI"
    "0djI0SDB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIvPjxwYXR"
    "oIGQ9Ik0xMiAxNy4yN0wxOC4xOCAyMWwtMS42NC03LjAzTDIyIDkuMjRsLTcuMTktLjYxTDEyIDIgOS4xOSA4"
    "LjYzIDIgOS4yNGw1LjQ2IDQuNzNMNS44MiAyMXoiLz48L3N2Zz4='>"
)


class FeedbackSerde:
    def __init__(self, options) -> None:
        self.multiselect_serde: MultiSelectSerde[int] = MultiSelectSerde(options)

    def serialize(self, value: int | None) -> list[int]:
        _value = [value] if value is not None else []
        return self.multiselect_serde.serialize(_value)

    def deserialize(self, ui_value: list[int], widget_id: str = "") -> int | None:
        deserialized = self.multiselect_serde.deserialize(ui_value, widget_id)

        if len(deserialized) == 0:
            return None

        return deserialized[0]


def create_format_func(option_icons: str | list[str]) -> Callable[[int], str]:
    def format_func(option_index: int) -> str:
        if option_icons is None:
            return ""

        if isinstance(option_icons, str):
            return option_icons

        return option_icons[option_index]

    return format_func


def get_mapped_options_and_format_funcs(
    feedback_option: FeedbackOptions | CustomIconList,
) -> tuple[list[int], Callable[[int], str]]:
    # a custom provided list of icons
    if isinstance(feedback_option, list):
        return list(range(len(feedback_option))), create_format_func(feedback_option)

    mapped_options: list[int] = []
    options: str | list[str]
    if feedback_option == "thumbs":
        mapped_options = list(range(len(thumb_icons)))
        options = thumb_icons
    elif feedback_option == "smiles":
        mapped_options = list(range(len(smile_icons)))
        options = smile_icons
    elif feedback_option == "stars":
        options = star_icon
        mapped_options = list(range(number_stars))

    format_func = create_format_func(options)
    return mapped_options, format_func
