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

from enum import Enum
from typing import Callable, Literal

from streamlit.elements.widgets.options_selector.options_selector_utils import (
    MultiSelectSerde,
)
from streamlit.type_util import compare_float

FeedbackOptions = Literal["thumbs", "smiles", "stars"]


class SentimentScores(Enum):
    UNKNOWN = None
    SAD = 0.0
    DISSAPOINTED = 0.25
    NEUTRAL = 0.5
    HAPPY = 0.75
    VERY_HAPPY = 1.0


class FeedbackSerde:
    def __init__(self, options) -> None:
        self.multiselect_serde: MultiSelectSerde[float | str] = MultiSelectSerde(
            options
        )

    def serialize(self, value: float | None) -> list[int]:
        if value is None:
            return []
        return self.multiselect_serde.serialize([value])

    def deserialize(self, ui_value: list[int], widget_id: str = "") -> float | None:
        deserialized = self.multiselect_serde.deserialize(ui_value, widget_id)

        if len(deserialized) == 0:
            return SentimentScores.UNKNOWN.value

        return float(deserialized[0])


def format_func_thumbs(sentiment_score: float) -> bytes:
    mapped_option = ""
    if compare_float(sentiment_score, SentimentScores.VERY_HAPPY.value):
        mapped_option = ":material/thumb_up:"
    elif compare_float(sentiment_score, SentimentScores.SAD.value):
        mapped_option = ":material/thumb_down:"

    return mapped_option.encode("utf-8")


def format_func_smiles(sentiment_score: float) -> bytes:
    mapped_option = ""
    if compare_float(sentiment_score, SentimentScores.SAD.value):
        mapped_option = ":material/sentiment_sad:"
    elif compare_float(sentiment_score, SentimentScores.DISSAPOINTED.value):
        mapped_option = ":material/sentiment_dissatisfied:"
    elif compare_float(sentiment_score, SentimentScores.NEUTRAL.value):
        mapped_option = ":material/sentiment_neutral:"
    elif compare_float(sentiment_score, SentimentScores.HAPPY.value):
        mapped_option = ":material/sentiment_satisfied:"
    elif compare_float(sentiment_score, SentimentScores.VERY_HAPPY.value):
        mapped_option = ":material/sentiment_very_satisfied:"

    return mapped_option.encode("utf-8")


def format_func_stars(sentiment_score: float) -> bytes:
    return b":material/star_rate:"


def get_mapped_options_and_format_funcs(
    feedback_option: FeedbackOptions,
) -> tuple[list[float], Callable[[float], bytes]]:
    mapped_options = [
        SentimentScores.VERY_HAPPY.value,
        SentimentScores.SAD.value,
    ]
    if feedback_option in ["smiles", "stars"]:
        mapped_options = [
            SentimentScores.SAD.value,
            SentimentScores.DISSAPOINTED.value,
            SentimentScores.NEUTRAL.value,
            SentimentScores.HAPPY.value,
            SentimentScores.VERY_HAPPY.value,
        ]

    format_func = format_func_thumbs
    # thumbs_up is 1, thumbs_down is 0; but we want to show thumbs_up first,
    # so its index is 0
    if feedback_option == "smiles":
        format_func = format_func_smiles
        # generates steps from 0 to 1 like [0, 0.25, 0.5, 0.75, 1]
    elif feedback_option == "stars":
        format_func = format_func_stars

    return mapped_options, format_func
