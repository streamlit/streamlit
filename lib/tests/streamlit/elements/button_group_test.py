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

"""button_group unit test."""

from __future__ import annotations

from typing import Any, Callable, Literal
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.widgets.button_group import (
    _FACES_ICONS,
    _SELECTED_STAR_ICON,
    _STAR_ICON,
    _THUMB_ICONS,
    ButtonGroupMixin,
    SelectionMode,
    SingleOrMultiSelectSerde,
    SingleSelectSerde,
    get_mapped_options,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ButtonGroup_pb2 import ButtonGroup as ButtonGroupProto
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from streamlit.runtime.state.session_state import get_script_run_ctx
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class TestGetMappedOptions:
    def test_thumbs(self):
        options, options_indices = get_mapped_options("thumbs")

        assert len(options) == 2
        assert len(options_indices) == 2

        for index, option in enumerate(options):
            assert option.content_icon == _THUMB_ICONS[index]

        # ensure order of thumbs
        assert "down" in options[1].content_icon
        assert options_indices[0] == 1
        assert "up" in options[0].content_icon
        assert options_indices[1] == 0

    def test_faces(self):
        options, options_indices = get_mapped_options("faces")

        assert len(options) == 5
        assert len(options_indices) == 5

        for index, option in enumerate(options):
            assert option.content_icon == _FACES_ICONS[index]
            assert option.selected_content_icon == ""
            assert options_indices[index] == index

        # ensure order of faces
        assert "sad" in options[0].content_icon
        assert "very_satisfied" in options[4].content_icon

    def test_stars(self):
        options, options_indices = get_mapped_options("stars")

        assert len(options) == 5
        assert len(options_indices) == 5

        for index, option in enumerate(options):
            assert option.content_icon == _STAR_ICON
            assert option.selected_content_icon == _SELECTED_STAR_ICON
            assert options_indices[index] == index


class TestSingleSelectSerde:
    def test_serialize(self):
        option_indices = [5, 6, 7]
        serde = SingleSelectSerde[int](option_indices)
        res = serde.serialize(6)
        assert res == [1]

    def test_serialize_raise_option_does_not_exist(self):
        option_indices = [5, 6, 7]
        serde = SingleSelectSerde[int](option_indices)

        with pytest.raises(StreamlitAPIException):
            serde.serialize(8)

    def test_deserialize(self):
        option_indices = [5, 6, 7]
        serde = SingleSelectSerde[int](option_indices)
        res = serde.deserialize([1], "")
        assert res == 6

    def test_deserialize_with_default_value(self):
        option_indices = [5, 6, 7]
        serde = SingleSelectSerde[int](option_indices, default_value=[2])
        res = serde.deserialize(None, "")
        assert res == 7

    def test_deserialize_raise_indexerror(self):
        option_indices = [5, 6, 7]
        serde = SingleSelectSerde[int](option_indices)

        with pytest.raises(IndexError):
            serde.deserialize([3], "")


class TestSingleOrMultiSelectSerde:
    @parameterized.expand([("single",), ("multi",)])
    def test_serialize(self, selection_mode: SelectionMode):
        option_indices = [5, 6, 7]
        serde = SingleOrMultiSelectSerde[int](option_indices, [], selection_mode)
        res = serde.serialize(6)
        assert res == [1]

    @parameterized.expand([("single",), ("multi",)])
    def test_serialize_raise_option_does_not_exist(self, selection_mode: SelectionMode):
        option_indices = [5, 6, 7]
        serde = SingleOrMultiSelectSerde[int](option_indices, [], selection_mode)

        with pytest.raises(StreamlitAPIException):
            serde.serialize(8)

    @parameterized.expand([("single", 6), ("multi", [6])])
    def test_deserialize(
        self, selection_mode: SelectionMode, expected: int | list[int]
    ):
        option_indices = [5, 6, 7]
        serde = SingleOrMultiSelectSerde[int](option_indices, [], selection_mode)
        res = serde.deserialize([1], "")
        assert res == expected

    @parameterized.expand([("single", 7), ("multi", [7])])
    def test_deserialize_with_default_value(
        self, selection_mode: SelectionMode, expected: list[int] | int
    ):
        option_indices = [5, 6, 7]
        serde = SingleOrMultiSelectSerde[int](option_indices, [2], selection_mode)
        res = serde.deserialize(None, "")
        assert res == expected

    @parameterized.expand([("single",), ("multi",)])
    def test_deserialize_raise_indexerror(self, selection_mode: SelectionMode):
        option_indices = [5, 6, 7]
        serde = SingleOrMultiSelectSerde[int](option_indices, [], selection_mode)

        with pytest.raises(IndexError):
            serde.deserialize([3], "")


class TestFeedbackCommand(DeltaGeneratorTestCase):
    """Tests that are specific for the feedback command."""

    @parameterized.expand(
        [
            ("thumbs", list(_THUMB_ICONS)),
            ("faces", list(_FACES_ICONS)),
            ("stars", list([_STAR_ICON] * 5)),
        ]
    )
    def test_call_feedback_with_all_options(
        self, option: Literal["thumbs", "faces", "stars"], expected_icons: list[str]
    ):
        st.feedback(option)

        delta = self.get_delta_from_queue().new_element.button_group
        assert delta.default == []
        assert [option.content_icon for option in delta.options] == expected_icons

    def test_invalid_option_literal(self):
        with pytest.raises(StreamlitAPIException) as e:
            st.feedback("foo")
        assert (
            "The options argument to st.feedback must be one of "
            "['thumbs', 'faces', 'stars']. The argument passed was 'foo'."
        ) == str(e.value)

    @parameterized.expand([(0,), (1,)])
    def test_widget_state_changed_via_session_state(self, session_state_index: int):
        st.session_state.feedback_command_key = session_state_index
        val = st.feedback("thumbs", key="feedback_command_key")
        assert val == session_state_index


def get_command_matrix(
    test_args: list[Any], with_st_feedback: bool = False
) -> list[tuple[Any]]:
    """Return a test matrix for the different button group commands and the
    passed arguments.

    If the test args is a list like [("foo", ("a", "b")), ("bar", ("c", "d"))],
    this function returns following test matrix:
    [
        (st.pills, "foo", ("a", "b")),
        (st.pills, "bar", ("c", "d")),
        (st.segmented_control, "foo", ("a", "b")),
        (st.segmented_control, "bar", ("c", "d")),
        (_interal_button_group, "foo", ("a", "b")),
        (_interal_button_group, "bar", ("c", "d")),
    ]

    The pills, segmented_control, and _internal_button_group are wrapped in a lambda to pass default
    arguments that are not shared between them.
    """
    matrix = []

    commands: list[Callable[..., Any]] = [
        lambda *args, **kwargs: st.pills("label", *args, **kwargs),
        lambda *args, **kwargs: st.segmented_control("label", *args, **kwargs),
        lambda *args, **kwargs: ButtonGroupMixin._internal_button_group(
            st._main, *args, **kwargs
        ),
    ]
    if with_st_feedback:
        commands.append(lambda *args, **kwargs: st.feedback(*args, **kwargs))

    for command in commands:
        if command is None:
            continue
        if len(test_args) == 0:
            matrix.append((command,))
            continue

        for args in test_args:
            matrix.append((command, *args))
    return matrix


# TODO: Some tests are very similar to the ones in multi_test.py -> maybe we can refactor them and share even more
class ButtonGroupCommandTests(DeltaGeneratorTestCase):
    @parameterized.expand(
        [
            (
                st.feedback,
                ("thumbs",),
                None,
                [":material/thumb_up:", ":material/thumb_down:"],
                "content_icon",
                ButtonGroupProto.Style.BORDERLESS,
                False,
            ),
            (
                st.pills,
                ("label", ["a", "b", "c"]),
                {"help": "Test help param"},
                ["a", "b", "c"],
                "content",
                ButtonGroupProto.Style.PILLS,
                True,
            ),
            (
                lambda *args, **kwargs: ButtonGroupMixin._internal_button_group(
                    st._main, *args, **kwargs
                ),
                (["a", "b", "c"],),
                None,
                ["a", "b", "c"],
                "content",
                ButtonGroupProto.Style.SEGMENTED_CONTROL,
                False,
            ),
        ]
    )
    def test_proto_population(
        self,
        command: Callable[..., None],
        command_args: tuple[Any, ...],
        command_kwargs: dict[str, Any] | None,
        expected_options: list[str],
        option_field: str,
        style: ButtonGroupProto.Style,
        test_label: bool,
    ):
        if command_kwargs is None:
            command_kwargs = {}
        command(*command_args, **command_kwargs)

        delta = self.get_delta_from_queue().new_element.button_group
        assert [
            getattr(option, option_field) for option in delta.options
        ] == expected_options
        assert delta.default == []
        assert delta.click_mode == ButtonGroupProto.ClickMode.SINGLE_SELECT
        assert delta.disabled is False
        assert delta.form_id == ""
        assert (
            delta.selection_visualization
            == ButtonGroupProto.SelectionVisualization.ONLY_SELECTED
        )
        assert delta.style == style

        if test_label:
            assert delta.label == command_args[0]
        assert (
            delta.label_visibility.value
            is LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE
        )

    @parameterized.expand(
        get_command_matrix([("string_key",), (0,), (None,)], with_st_feedback=True)
    )
    def test_key_types(self, comand: Callable[..., None], key: str | int | None):
        """Test that the key argument can be passed as expected."""

        # use options that is compatible with all commands including st.feedback
        comand("thumbs", key=key)

        delta = self.get_delta_from_queue().new_element.button_group
        assert delta.id.endswith(f"-{str(key)}")

    @parameterized.expand(
        [
            (st.feedback, ("thumbs",)),
            (st.pills, ("label", ["a", "b", "c"])),
            (st.pills, ("label", ["a", "b", "c"]), {"default": "b"}, "b"),
            (
                lambda *args, **kwargs: ButtonGroupMixin._internal_button_group(
                    st._main, *args, **kwargs
                ),
                (["a", "b", "c"],),
                {"default": "b"},
                "b",
            ),
            (
                st.pills,
                ("label", ["a", "b", "c"]),
                {"default": "b", "selection_mode": "multi"},
                ["b"],
            ),
            (
                lambda *args, **kwargs: ButtonGroupMixin._internal_button_group(
                    st._main, *args, **kwargs
                ),
                (["a", "b", "c"],),
                {"default": "b", "selection_mode": "multi"},
                ["b"],
            ),
        ]
    )
    def test_default_return_value(
        self,
        command: Callable[..., None],
        command_args: tuple[Any, ...],
        command_kwargs: dict | None = None,
        expected_default: str | None = None,
    ):
        if command_kwargs is None:
            command_kwargs = {}
        res = command(*command_args, **command_kwargs)
        assert res == expected_default

    @parameterized.expand(
        [
            (st.feedback, ("thumbs",)),
            (st.pills, ("label", ["a", "b", "c"])),
        ]
    )
    def test_disabled(self, command: Callable, command_args: tuple[Any, ...]):
        command(*command_args, disabled=True)

        delta = self.get_delta_from_queue().new_element.button_group
        assert delta.disabled is True

    @parameterized.expand(
        get_command_matrix(
            [
                ((),),
                ([],),
                (np.array([]),),
                (pd.Series(np.array([])),),
                (set(),),
            ]
        )
    )
    def test_no_options(self, command: Callable[..., None], options: Any):
        """Test that it handles no options."""
        command(options)

        c = self.get_delta_from_queue().new_element.button_group
        assert c.default[:] == []
        assert [option.content for option in c.options] == []

    @parameterized.expand(
        get_command_matrix(
            [
                (("m", "f"), ["m", "f"]),
                (["male", "female"], ["male", "female"]),
                (np.array(["m", "f"]), ["m", "f"]),
                (pd.Series(np.array(["male", "female"])), ["male", "female"]),
                (pd.DataFrame({"options": ["male", "female"]}), ["male", "female"]),
                (
                    pd.DataFrame(
                        data=[[1, 4, 7], [2, 5, 8], [3, 6, 9]], columns=["a", "b", "c"]
                    ).columns,
                    ["a", "b", "c"],
                ),
            ]
        )
    )
    def test_various_option_types(
        self,
        command: Callable[..., None],
        options: Any,
        proto_options: list[str],
    ):
        """Test that it supports different types of options."""
        command(options)

        c = self.get_delta_from_queue().new_element.button_group
        assert c.default[:] == []
        assert [option.content for option in c.options] == proto_options

    @parameterized.expand(
        get_command_matrix(
            [
                (
                    pd.Series(np.array(["green", "blue", "red", "yellow", "brown"])),
                    ["yellow"],
                    ["green", "blue", "red", "yellow", "brown"],
                    [3],
                ),
                (
                    np.array(["green", "blue", "red", "yellow", "brown"]),
                    ["green", "red"],
                    ["green", "blue", "red", "yellow", "brown"],
                    [0, 2],
                ),
                (
                    ("green", "blue", "red", "yellow", "brown"),
                    ["blue"],
                    ["green", "blue", "red", "yellow", "brown"],
                    [1],
                ),
                (
                    ["green", "blue", "red", "yellow", "brown"],
                    ["brown"],
                    ["green", "blue", "red", "yellow", "brown"],
                    [4],
                ),
                (
                    pd.DataFrame({"col1": ["male", "female"], "col2": ["15", "10"]}),
                    ["male", "female"],
                    ["male", "female"],
                    [0, 1],
                ),
            ]
        )
    )
    def test_various_option_types_with_defaults(
        self,
        command: Callable[..., None],
        options: Any,
        defaults: Any,
        proto_options: list[str],
        expected_defaults: list[int],
    ):
        """Test that it supports different types of options and works with defaults."""
        command(options, default=defaults, selection_mode="multi")

        c = self.get_delta_from_queue().new_element.button_group
        assert [option.content for option in c.options] == proto_options
        assert c.default[:] == expected_defaults

    @parameterized.expand(
        get_command_matrix(
            [
                (("Tea", "Water"), [1, 2]),
                # the lambda returns a generator that needs to be fresh
                # for every test run:
                (lambda: (i for i in ("Tea", "Water")), [1, 2]),
                (np.array(["Coffee", "Tea"]), [0, 1]),
                (pd.Series(np.array(["Coffee", "Tea"])), [0, 1]),
                ("Coffee", [0]),
            ]
        )
    )
    def test_default_types(
        self, command: Callable[..., None], defaults: Any, expected: list[Any]
    ):
        if callable(defaults):
            defaults = defaults()

        command(["Coffee", "Tea", "Water"], default=defaults, selection_mode="multi")

        c = self.get_delta_from_queue().new_element.button_group
        assert c.default[:] == expected
        assert [option.content for option in c.options] == ["Coffee", "Tea", "Water"]

    @parameterized.expand(
        get_command_matrix([(None, []), ([], []), (["Tea", "Water"], [1, 2])])
    )
    def test_defaults_for_multi(
        self, command: Callable[..., None], defaults: Any, expected: list[Any]
    ):
        """Test that valid default can be passed as expected."""
        command(
            ["Coffee", "Tea", "Water"],
            default=defaults,
            selection_mode="multi",
        )
        c = self.get_delta_from_queue().new_element.button_group
        assert c.default[:] == expected
        assert [option.content for option in c.options] == ["Coffee", "Tea", "Water"]

    @parameterized.expand(
        get_command_matrix([(None, []), ([], []), (["Tea"], [1]), ("Coffee", [0])])
    )
    def test_default_for_singleselect(
        self, command: Callable[..., None], defaults: Any, expected: list[Any]
    ):
        """Test that valid default can be passed as expected and that the default can be
        a list or single value."""
        command(
            ["Coffee", "Tea", "Water"],
            default=defaults,
            selection_mode="single",
        )
        c = self.get_delta_from_queue().new_element.button_group
        assert c.default[:] == expected
        assert [option.content for option in c.options] == ["Coffee", "Tea", "Water"]

    @parameterized.expand(get_command_matrix([]))
    def test_default_for_single_select_must_be_single_value(
        self, command: Callable[..., None]
    ):
        """Test that passing multiple values as default for single select raises an
        exception."""
        with pytest.raises(StreamlitAPIException) as exception:
            command(
                ["Coffee", "Tea", "Water"],
                default=["Coffee", "Tea"],
                selection_mode="single",
            )
        assert (
            str(exception.value)
            == "The default argument to `st.pills` must be a single value when "
            "`selection_mode='single'`."
        )

    @parameterized.expand(
        get_command_matrix(
            [
                (["Tea", "Vodka", None], StreamlitAPIException),
                ([1, 2], StreamlitAPIException),
            ]
        )
    )
    def test_invalid_defaults(
        self, command: Callable[..., None], defaults: list, expected: type[Exception]
    ):
        """Test that invalid default trigger the expected exception."""
        with pytest.raises(expected):
            command(["Coffee", "Tea", "Water"], default=defaults)

    @parameterized.expand(
        get_command_matrix(
            [([":material/thumb_up:", ":material/thumb_down:", "foo", 0],)]
        )
    )
    def test_format_func_is_applied(
        self,
        command: Callable[..., None],
        options: list[str],
    ):
        """Test that format_func is applied to the options; since we add '!' its not a
        valid icon anymore."""
        command(options, format_func=lambda x: f"{x}!")
        c = self.get_delta_from_queue().new_element.button_group
        for index, option in enumerate(options):
            assert c.options[index].content == f"{option}!"

    @parameterized.expand(
        [
            (st.feedback, ("thumbs",)),
            (st.pills, ("label", ["a", "b", "c"])),
        ]
    )
    def test_on_change_is_registered(
        self,
        command: Callable[..., None],
        command_args: tuple[str, ...],
    ):
        command(*command_args, on_change=lambda x: x)

        ctx = get_script_run_ctx()
        assert ctx is not None
        session_state = ctx.session_state._state
        widget_id = session_state.get_widget_states()[0].id
        metadata = session_state._new_widget_state.widget_metadata.get(widget_id)
        assert metadata is not None
        assert metadata.callback is not None

    @parameterized.expand(get_command_matrix([]))
    def test_option_starting_with_icon(self, command: Callable[..., None]):
        command(
            [
                "☕ Coffee",
                "🍵 Tea",
                ":material/zoom_in: Water",
                "Earth",
                ":material/zoom_out:",
            ]
        )

        c = self.get_delta_from_queue().new_element.button_group
        assert c.default == []
        assert [option.content for option in c.options] == [
            "☕ Coffee",
            "🍵 Tea",
            "Water",
            "Earth",
            "",
        ]
        assert [option.content_icon for option in c.options] == [
            "",
            "",
            ":material/zoom_in:",
            "",
            ":material/zoom_out:",
        ]

    @parameterized.expand(
        get_command_matrix(
            [
                ("no-icon Coffee",),
                ("",),
                (":material/foo: Water",),
                (":material/thumb_up Tea",),
            ]
        )
    )
    def test_invalid_icons_are_not_set_to_content_icon_field(
        self, command: Callable[..., None], option: str
    ):
        command([option])

        proto = self.get_delta_from_queue().new_element.button_group
        for proto_option in proto.options:
            assert proto_option.content_icon == ""
            assert proto_option.content == option

    @parameterized.expand(get_command_matrix([], with_st_feedback=True))
    def test_outside_form(self, command: Callable[..., None]):
        """Test that form id is marshalled correctly outside of a form."""
        # pass an option that is valid for st.feedback and also the other button_group
        # commands
        command("thumbs")

        proto = self.get_delta_from_queue().new_element.button_group
        assert proto.form_id == ""

    @parameterized.expand(get_command_matrix([], with_st_feedback=True))
    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self, command: Callable[..., None]):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            # pass an option that is valid for st.feedback and also the other button_group
            # commands
            command("thumbs")

        # 2 elements will be created: form block, widget
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block
        proto = self.get_delta_from_queue(1).new_element.button_group
        assert proto.form_id == form_proto.form.form_id

    @parameterized.expand(get_command_matrix([]))
    def test_inside_column(self, command: Callable[..., None]):
        """Test that button group commands work correctly inside of a column."""

        col1, _ = st.columns(2)

        with col1:
            command(["bar", "baz"])
        all_deltas = self.get_all_deltas_from_queue()

        # 4 elements will be created: 1 horizontal block, 2 columns, 1 widget
        assert len(all_deltas) == 4
        proto = self.get_delta_from_queue().new_element.button_group

        assert proto.default == []
        assert [option.content for option in proto.options] == ["bar", "baz"]

    def test_inside_column_feedback(self):
        """Test that st.feedback works correctly inside of a column."""

        col1, _ = st.columns(2)

        with col1:
            st.feedback("thumbs")
        all_deltas = self.get_all_deltas_from_queue()

        # 4 elements will be created: 1 horizontal block, 2 columns, 1 widget
        assert len(all_deltas) == 4
        proto = self.get_delta_from_queue().new_element.button_group

        assert proto.default == []
        assert [option.content_icon for option in proto.options] == [
            ":material/thumb_up:",
            ":material/thumb_down:",
        ]

    @parameterized.expand(get_command_matrix([]))
    def test_default_string(self, command: Callable[..., None]):
        """Test if works when the default value is not a list."""
        arg_options = ["some str", 123, None, {}]
        proto_options = ["some str", "123", "None", "{}"]

        command(
            arg_options,
            default="some str",
        )

        c = self.get_delta_from_queue().new_element.button_group
        assert c.default[:] == [0]
        assert [option.content for option in c.options] == proto_options

    @parameterized.expand(get_command_matrix([]))
    def test_invalid_selection_mode(self, command: Callable[..., None]):
        """Test that passing an invalid selection_mode raises an exception."""
        with pytest.raises(StreamlitAPIException) as exception:
            command(["a", "b"], selection_mode="foo")
        assert (
            "The selection_mode argument must be one of ['single', 'multi']. "
            "The argument passed was 'foo'." == str(exception.value)
        )

    @parameterized.expand(get_command_matrix([]))
    def test_widget_state_changed_via_session_state_for_single_select(
        self, command: Callable[..., None]
    ):
        st.session_state.command_key = "stars"
        val = command(["thumbs", "stars"], key="command_key")
        assert val == "stars"

    @parameterized.expand(get_command_matrix([]))
    def test_widget_state_changed_via_session_state_for_multi_select(
        self, command: Callable[..., None]
    ):
        st.session_state.command_key = ["stars"]
        val = command(["thumbs", "stars"], key="command_key", selection_mode="multi")
        assert val == ["stars"]

    def test_invalid_style(self):
        """Test internal button_group command does not accept invalid style."""

        with pytest.raises(StreamlitAPIException) as exception:
            ButtonGroupMixin._internal_button_group(
                st._main, ["a", "b", "c"], style="foo"
            )
        assert (
            "The style argument must be one of ['borderless', 'pills', 'segmented_control']. "
            "The argument passed was 'foo'." == str(exception.value)
        )
