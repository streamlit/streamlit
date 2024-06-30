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

_thumb_icons = [":material/thumb_down:", ":material/thumb_up:"]
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

FeedbackOptions = Literal["thumbs", "faces", "stars"]


class FeedbackSerde:
    """Uses the MultiSelectSerde under-the-hood, but accepts a single index value
    and deserializes to a single index value. This is because for feedback, we always
    allow just a single selection.

    When a sentiment_mapping is provided, the sentiment corresponding to the index is
    serialized/deserialized. Otherwise, the index is used as the sentiment.
    """

    def __init__(self, option_indices: list[int]) -> None:
        """Initialize the FeedbackSerde with a list of sentimets."""
        self.multiselect_serde: MultiSelectSerde[int] = MultiSelectSerde(option_indices)

    def serialize(self, value: int | None) -> list[int]:
        """Serialize the passed sentiment option into its corresponding index
        (wrapped in a list).
        """
        _value = [value] if value is not None else []
        return self.multiselect_serde.serialize(_value)

    def deserialize(self, ui_value: list[int], widget_id: str = "") -> int | None:
        """Receive a list of indices and return the corresponding sentiments."""
        deserialized = self.multiselect_serde.deserialize(ui_value, widget_id)

        if len(deserialized) == 0:
            return None

        return deserialized[0]


def create_format_func(
    option_icons: ButtonGroupProto.Option | list[ButtonGroupProto.Option],
) -> Callable[[int], ButtonGroupProto.Option]:
    """Return a function that accepts an index and returns the corresponding option.

    If the passed options is None, returns an empty string.
    If the passed options is a single option, always return the same option.
    """

    def format_func(option_index: int) -> ButtonGroupProto.Option:
        if option_icons is None:
            return ""

        if isinstance(option_icons, ButtonGroupProto.Option):
            return option_icons

        return option_icons[option_index]

    return format_func


def get_mapped_options(
    feedback_option: FeedbackOptions,
) -> tuple[ButtonGroupProto.Option | list[ButtonGroupProto.Option], list[int]]:
    # options object understandable by the web app
    options: ButtonGroupProto.Option | list[ButtonGroupProto.Option] = []
    # we use the option index in the webapp communication to
    # indicate which option is selected
    options_indices: list[int] = []

    if feedback_option == "thumbs":
        # reversing the index mapping to have thumbs up first (but still with the higher
        # index (=sentiment) in the list)
        options_indices = list(reversed(range(len(_thumb_icons))))
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

    return options, options_indices
