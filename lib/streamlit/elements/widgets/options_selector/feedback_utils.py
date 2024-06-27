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
from streamlit.proto.ButtonGroup_pb2 import ButtonGroup as ButtonGroupProto

FeedbackOptions = Literal["thumbs", "faces", "stars"]

_thumb_icons = [":material/thumb_up:", ":material/thumb_down:"]
_face_icons = [
    ":material/sentiment_sad:",
    ":material/sentiment_dissatisfied:",
    ":material/sentiment_neutral:",
    ":material/sentiment_satisfied:",
    ":material/sentiment_very_satisfied:",
]
_number_stars = 5
_star_icon = ":material/star:"
# we don't have the filled-material icon library as a dependency. Hence, we have it here
# in base64 format and send it over the wire as an image.
_selected_star_icon = (
    "<img src='data:image/svg+xml;base64,"
    "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9"
    "zdmciIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0Ij48cGF0aCBkPSJNMCAwaDI"
    "0djI0SDB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgMGgyNHYyNEgweiIgZmlsbD0ibm9uZSIvPjxwYXR"
    "oIGQ9Ik0xMiAxNy4yN0wxOC4xOCAyMWwtMS42NC03LjAzTDIyIDkuMjRsLTcuMTktLjYxTDEyIDIgOS4xOSA4"
    "LjYzIDIgOS4yNGw1LjQ2IDQuNzNMNS44MiAyMXoiLz48L3N2Zz4='>"
)


class FeedbackSerde:
    """Uses the MultiSelectSerde under-the-hood, but accepts a single index value
    and deserializes to a single index value. This is because for feedback, we always
    allow just a single selection.

    When a sentiment_mapping is provided, the sentiment corresponding to the index is
    serialized/deserialized. Otherwise, the index is used as the sentiment.
    """

    def __init__(self, options, sentiment_mapping: list[int] | None) -> None:
        self.multiselect_serde: MultiSelectSerde[int] = MultiSelectSerde(options)
        self.sentiment_mapping = sentiment_mapping

    def serialize(self, value: int | None) -> list[int]:
        if self.sentiment_mapping is not None:
            value = self.sentiment_mapping[value] if value is not None else None
        _value = [value] if value is not None else []
        return self.multiselect_serde.serialize(_value)

    def deserialize(self, ui_value: list[int], widget_id: str = "") -> int | None:
        deserialized = self.multiselect_serde.deserialize(ui_value, widget_id)

        if len(deserialized) == 0:
            return None

        index = deserialized[0]
        return (
            index if self.sentiment_mapping is None else self.sentiment_mapping[index]
        )


def create_format_func(
    option_icons: ButtonGroupProto.Option | list[ButtonGroupProto.Option],
) -> Callable[[int], ButtonGroupProto.Option]:
    def format_func(option_index: int) -> ButtonGroupProto.Option:
        if option_icons is None:
            return ""

        if isinstance(option_icons, ButtonGroupProto.Option):
            return option_icons

        return option_icons[option_index]

    return format_func


def get_mapped_options(
    feedback_option: FeedbackOptions,
) -> tuple[
    ButtonGroupProto.Option | list[ButtonGroupProto.Option], list[int], list[int] | None
]:
    # options object understandable by the web app
    options: ButtonGroupProto.Option | list[ButtonGroupProto.Option] = []
    # we use the option index in the webapp communication to
    # indicate which option is selected
    options_indices: list[int] = []
    # used in case the sentiment is different to the option's index. For example,thumbs
    # up is index 0 as we want to show it first, but sentiment 1.
    sentiment_index_mapping: list[int] | None = None

    if feedback_option == "thumbs":
        options_indices = list(range(len(_thumb_icons)))
        sentiment_index_mapping = list(reversed(options_indices))
        options = [ButtonGroupProto.Option(content=icon) for icon in _thumb_icons]
    elif feedback_option == "faces":
        options_indices = list(range(len(_face_icons)))
        options = [ButtonGroupProto.Option(content=icon) for icon in _face_icons]
    elif feedback_option == "stars":
        options_indices = list(range(_number_stars))
        options = ButtonGroupProto.Option(
            content=_star_icon,
            selected_content=_selected_star_icon,
            disable_selection_highlight=True,
        )

    return options, options_indices, sentiment_index_mapping
