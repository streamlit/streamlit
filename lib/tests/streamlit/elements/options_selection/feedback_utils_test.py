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

import pytest

from streamlit.proto.ButtonGroup_pb2 import ButtonGroup as ButtonGroupProto
from streamlit.elements.widgets.options_selector.feedback_utils import (
    create_format_func,
    get_mapped_options,
    _star_icon,
    _selected_star_icon,
    _face_icons,
    _thumb_icons,
    FeedbackSerde,
)
from streamlit.errors import StreamlitAPIException


class TestGetMappedOptions:
    def test_thumbs(self):
        options, options_indices = get_mapped_options("thumbs")

        assert len(options) == 2
        assert len(options_indices) == 2

        for index, option in enumerate(options):
            assert option.content == _thumb_icons[index]

        # ensure order of thumbs
        assert "down" in options[0].content
        assert options_indices[0] == 1
        assert "up" in options[1].content
        assert options_indices[1] == 0

    def test_faces(self):
        options, options_indices = get_mapped_options("faces")

        assert len(options) == 5
        assert len(options_indices) == 5

        for index, option in enumerate(options):
            assert option.content == _face_icons[index]
            assert option.selected_content == ""
            assert options_indices[index] == index

        # ensure order of faces
        assert "sad" in options[0].content
        assert "very_satisfied" in options[4].content

    def test_stars(self):
        options, options_indices = get_mapped_options("stars")

        assert isinstance(options, ButtonGroupProto.Option)
        assert len(options_indices) == 5

        assert options.content == _star_icon
        assert options.selected_content == _selected_star_icon
        assert options.disable_selection_highlight == True


class TestCreateFormatFunc:
    def test_pass_single_option_return_option(self):
        option = ButtonGroupProto.Option(content="test")
        format_func = create_format_func(option)

        # when single option is passed, always the same option is returned
        for i in range(100):
            assert format_func(i) == option

    def pass_options(self):
        option1 = ButtonGroupProto.Option(content="test1")
        option2 = ButtonGroupProto.Option(content="test2")
        format_func = create_format_func([option1, option2])

        assert format_func(0) == option1
        assert format_func(1) == option2

        with pytest.raises(IndexError):
            format_func(2)


class TestFeedbackSerde:
    def test_serialize(self):
        option_indices = [5, 6, 7]
        serde = FeedbackSerde(option_indices)
        res = serde.serialize(6)
        assert res == [1]

    def test_serialize_raise_option_does_not_exist(self):
        option_indices = [5, 6, 7]
        serde = FeedbackSerde(option_indices)

        with pytest.raises(StreamlitAPIException):
            serde.serialize(8)

    def test_deserialize(self):
        option_indices = [5, 6, 7]
        serde = FeedbackSerde(option_indices)
        res = serde.deserialize([1], "")
        assert res == 6

    def test_deserialize_raise_indexerror(self):
        option_indices = [5, 6, 7]
        serde = FeedbackSerde(option_indices)

        with pytest.raises(IndexError):
            serde.deserialize([3], "")
