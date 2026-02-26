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

"""button_group unit test."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.widgets.button_group import (
    ButtonGroupMixin,
    _MultiSelectButtonGroupSerde,
    _SingleSelectButtonGroupSerde,
)
from streamlit.errors import StreamlitAPIException, StreamlitInvalidBindValueError
from streamlit.proto.ButtonGroup_pb2 import ButtonGroup as ButtonGroupProto
from streamlit.proto.LabelVisibility_pb2 import LabelVisibility
from streamlit.runtime.state.session_state import get_script_run_ctx
from streamlit.testing.v1.app_test import AppTest
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields

if TYPE_CHECKING:
    from collections.abc import Callable


class TestButtonGroupSerde:
    """Tests for the _SingleSelectButtonGroupSerde and _MultiSelectButtonGroupSerde classes."""

    def test_single_select_serialize(self):
        """Test single-select serialization returns formatted string in list."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _SingleSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: x.capitalize(),
        )
        res = serde.serialize("banana")
        assert res == ["Banana"]

    def test_single_select_serialize_none(self):
        """Test single-select serialization of None returns empty list."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _SingleSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: x.capitalize(),
        )
        res = serde.serialize(None)
        assert res == []

    def test_single_select_deserialize(self):
        """Test single-select deserialization returns original option."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _SingleSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: x.capitalize(),
        )
        res = serde.deserialize(["Banana"])
        assert res == "banana"

    def test_single_select_deserialize_with_default(self):
        """Test single-select deserialization with default value."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _SingleSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            default_option_index=2,  # cherry
            format_func=lambda x: x.capitalize(),
        )
        res = serde.deserialize(None)
        assert res == "cherry"

    def test_single_select_deserialize_explicit_deselection(self):
        """Test single-select explicit deselection (empty list) returns None, not default.

        When the frontend sends an empty list [], it means the user explicitly
        deselected (clicked the selected button to toggle it off). This should
        return None, not the default value.
        """
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _SingleSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            default_option_index=2,  # cherry is default
            format_func=lambda x: x.capitalize(),
        )
        # Empty list = explicit deselection, should return None (not default)
        res = serde.deserialize([])
        assert res is None

    def test_single_select_deserialize_unknown_value(self):
        """Test single-select deserialization of unknown value returns string as-is."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _SingleSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: x.capitalize(),
        )
        res = serde.deserialize(["Unknown"])
        assert res == "Unknown"

    def test_multi_select_serialize(self):
        """Test multi-select serialization returns list of formatted strings."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: x.capitalize(),
        )
        res = serde.serialize(["apple", "cherry"])
        assert res == ["Apple", "Cherry"]

    def test_multi_select_serialize_empty(self):
        """Test multi-select serialization of empty list returns empty list."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: x.capitalize(),
        )
        res = serde.serialize([])
        assert res == []

    def test_multi_select_deserialize(self):
        """Test multi-select deserialization returns list of original options."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: x.capitalize(),
        )
        res = serde.deserialize(["Apple", "Cherry"])
        assert res == ["apple", "cherry"]

    def test_multi_select_deserialize_with_default(self):
        """Test multi-select deserialization with default values."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            default_option_indices=[0, 2],  # apple, cherry
            format_func=lambda x: x.capitalize(),
        )
        res = serde.deserialize(None)
        assert res == ["apple", "cherry"]

    def test_multi_select_deserialize_unknown_value(self):
        """Test multi-select deserialization with unknown value includes it as-is."""
        options = ["apple", "banana", "cherry"]
        formatted_options = ["Apple", "Banana", "Cherry"]
        formatted_option_to_option_index = {
            f: i for i, f in enumerate(formatted_options)
        }
        serde = _MultiSelectButtonGroupSerde[str](
            options,
            formatted_options=formatted_options,
            formatted_option_to_option_index=formatted_option_to_option_index,
            format_func=lambda x: x.capitalize(),
        )
        res = serde.deserialize(["Apple", "Unknown"])
        assert res == ["apple", "Unknown"]


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
        assert delta.style == style

        if test_label:
            assert delta.label == command_args[0]
        assert (
            delta.label_visibility.value
            is LabelVisibility.LabelVisibilityOptions.VISIBLE
        )

    @parameterized.expand(get_command_matrix([("string_key",), (0,), (None,)]))
    def test_key_types(self, command: Callable[..., None], key: str | int | None):
        """Test that the key argument can be passed as expected."""

        command(["a", "b", "c"], key=key)

        delta = self.get_delta_from_queue().new_element.button_group
        assert delta.id.endswith(f"-{key}")

    @parameterized.expand(
        [
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
        command: Callable[..., Any],
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
            (st.pills, ("label", ["a", "b", "c"])),
        ]
    )
    def test_disabled(self, command: Callable, command_args: tuple[Any, ...]):
        command(*command_args, disabled=True)

        delta = self.get_delta_from_queue().new_element.button_group
        assert delta.disabled is True

    @parameterized.expand(
        [
            (st.segmented_control),
            (st.pills),
        ]
    )
    def test_includes_label_in_id(self, command: Callable):
        command(label="label 1", options=["a", "b", "c"])

        button_group_1 = self.get_delta_from_queue().new_element.button_group

        command(label="label 2", options=["a", "b", "c"])
        button_group_2 = self.get_delta_from_queue().new_element.button_group

        assert button_group_1.id != button_group_2.id

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
            "Coffee",
            "Tea",
            "Water",
            "Earth",
            "",
        ]
        assert [option.content_icon for option in c.options] == [
            "☕",
            "🍵",
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

    @parameterized.expand(get_command_matrix([]))
    def test_outside_form(self, command: Callable[..., None]):
        """Test that form id is marshalled correctly outside of a form."""
        command(["a", "b", "c"])

        proto = self.get_delta_from_queue().new_element.button_group
        assert proto.form_id == ""

    @parameterized.expand(get_command_matrix([]))
    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self, command: Callable[..., None]):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            command(["a", "b", "c"])

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
            str(exception.value)
            == "The selection_mode argument must be one of ['single', 'multi']. "
            "The argument passed was 'foo'."
        )

    @parameterized.expand(get_command_matrix([]))
    def test_widget_state_changed_via_session_state_for_single_select(
        self, command: Callable[..., Any]
    ):
        st.session_state.command_key = "stars"
        val = command(["thumbs", "stars"], key="command_key")
        assert val == "stars"

    @parameterized.expand(get_command_matrix([]))
    def test_widget_state_changed_via_session_state_for_multi_select(
        self, command: Callable[..., Any]
    ):
        st.session_state.command_key = ["stars"]
        val = command(["thumbs", "stars"], key="command_key", selection_mode="multi")
        assert val == ["stars"]

    @parameterized.expand(get_command_matrix([]))
    def test_button_group_with_width(self, command: Callable[..., None]):
        """Test button group widgets with different width types."""
        test_cases = [
            (500, WidthConfigFields.PIXEL_WIDTH.value, "pixel_width", 500),
            ("stretch", WidthConfigFields.USE_STRETCH.value, "use_stretch", True),
            ("content", WidthConfigFields.USE_CONTENT.value, "use_content", True),
        ]

        for width_value, expected_width_spec, field_name, field_value in test_cases:
            with self.subTest(width_value=width_value):
                command(["a", "b", "c"], width=width_value)

                el = self.get_delta_from_queue().new_element
                assert el.button_group.options[0].content == "a"

                assert el.width_config.WhichOneof("width_spec") == expected_width_spec
                assert getattr(el.width_config, field_name) == field_value

    @parameterized.expand(get_command_matrix([]))
    def test_button_group_with_invalid_width(self, command: Callable[..., None]):
        """Test button group widgets with invalid width values."""
        test_cases = [
            (
                "invalid",
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -100,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
            (
                100.5,
                "Width must be either a positive integer (pixels), 'stretch', or 'content'.",
            ),
        ]

        for width_value, expected_error_message in test_cases:
            with self.subTest(width_value=width_value):
                with pytest.raises(StreamlitAPIException) as exc:
                    command(["a", "b", "c"], width=width_value)

                assert expected_error_message in str(exc.value)

    @parameterized.expand(get_command_matrix([]))
    def test_button_group_default_width(self, command: Callable[..., None]):
        """Test that button group widgets default to content width."""
        command(["a", "b", "c"])

        el = self.get_delta_from_queue().new_element
        assert el.button_group.options[0].content == "a"
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert el.width_config.use_content is True

    def test_invalid_style(self):
        """Test internal button_group command does not accept invalid style."""

        with pytest.raises(StreamlitAPIException) as exception:
            ButtonGroupMixin._internal_button_group(
                st._main, ["a", "b", "c"], style="foo"
            )
        assert (
            str(exception.value) == "The style argument must be one of "
            "['pills', 'segmented_control']. "
            "The argument passed was 'foo'."
        )

    @parameterized.expand(
        [
            (st.pills, ("label", ["a", "b", "c"]), "pills"),
            (st.segmented_control, ("label", ["a", "b", "c"]), "segmented_control"),
        ]
    )
    def test_duplicate_element_id_error_message(
        self, command: Callable, command_args: tuple[Any, ...], element_name: str
    ):
        with pytest.raises(StreamlitAPIException) as exception:
            # Call two times to trigger the error:
            command(*command_args)
            command(*command_args)

        # Make sure the correct name is used in the error message
        assert element_name in str(exception.value)

    def test_stable_id_with_key_segmented_control(self):
        """Test that the widget ID is stable for segmented_control when a stable key is provided.

        With key_as_main_identity={"click_mode"}, the ID only changes when selection_mode changes.
        Options, format_func, and other params can change without affecting the ID.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with certain params
            st.segmented_control(
                label="Label 1",
                key="segmented_control_key",
                help="Help 1",
                disabled=False,
                width="content",
                on_change=lambda: None,
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
                label_visibility="visible",
                default="a",
                # These can change without affecting ID (only click_mode matters):
                options=["a", "b", "c"],
                selection_mode="single",
                format_func=lambda x: x.capitalize(),
            )
            proto1 = self.get_delta_from_queue().new_element.button_group
            id1 = proto1.id

            # Second render with different params but same key and selection_mode
            st.segmented_control(
                label="Label 2",
                key="segmented_control_key",
                help="Help 2",
                disabled=True,
                width="stretch",
                on_change=lambda: None,
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
                label_visibility="hidden",
                default="b",
                # These can change without affecting ID:
                options=["a", "b", "c"],
                selection_mode="single",
                format_func=lambda x: x.capitalize(),
            )
            proto2 = self.get_delta_from_queue().new_element.button_group
            id2 = proto2.id
            assert id1 == id2

    @parameterized.expand(
        [
            # Only selection_mode (click_mode) changes should cause ID changes
            # options and format_func are not in key_as_main_identity for pills/segmented_control
            ("selection_mode", "single", "multi"),
        ]
    )
    def test_whitelisted_stable_key_kwargs_segmented_control(
        self, kwarg_name: str, value1: object, value2: object
    ):
        """Test that the widget ID changes for segmented_control when selection_mode changes
        even when the key is provided. Options and format_func changes do NOT cause ID changes.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            base_kwargs: dict[str, object] = {
                "label": "Label",
                "key": "segmented_control_key_1",
                "options": ["a", "b", "c"],
                "selection_mode": "single",
            }

            # Apply first value for the whitelisted kwarg
            base_kwargs[kwarg_name] = value1
            st.segmented_control(**base_kwargs)  # type: ignore[arg-type]
            proto1 = self.get_delta_from_queue().new_element.button_group
            id1 = proto1.id

            # Apply second value for the whitelisted kwarg
            base_kwargs[kwarg_name] = value2
            st.segmented_control(**base_kwargs)  # type: ignore[arg-type]
            proto2 = self.get_delta_from_queue().new_element.button_group
            id2 = proto2.id
            assert id1 != id2

    def test_options_change_does_not_change_id_segmented_control(self):
        """Test that changing options does NOT change the widget ID when a key is provided.

        This is the key behavior for dynamic options support - options can change
        without resetting the widget state.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with options ["a", "b"]
            st.segmented_control(
                label="Label",
                key="segmented_control_options_key",
                options=["a", "b"],
                selection_mode="single",
            )
            proto1 = self.get_delta_from_queue().new_element.button_group
            id1 = proto1.id

            # Second render with different options ["x", "y", "z"]
            st.segmented_control(
                label="Label",
                key="segmented_control_options_key",
                options=["x", "y", "z"],
                selection_mode="single",
            )
            proto2 = self.get_delta_from_queue().new_element.button_group
            id2 = proto2.id

            # IDs should be the SAME because options is not in key_as_main_identity
            assert id1 == id2

    def test_stable_id_with_key_pills(self):
        """Test that the widget ID is stable for pills when a stable key is provided.

        With key_as_main_identity={"click_mode"}, the ID only changes when selection_mode changes.
        Options, format_func, and other params can change without affecting the ID.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with certain params
            st.pills(
                label="Label 1",
                key="pills_key",
                help="Help 1",
                disabled=False,
                width="content",
                on_change=lambda: None,
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
                label_visibility="visible",
                default="a",
                # These can change without affecting ID (only click_mode matters):
                options=["a", "b", "c"],
                selection_mode="single",
                format_func=lambda x: x.capitalize(),
            )
            proto1 = self.get_delta_from_queue().new_element.button_group
            id1 = proto1.id

            # Second render with different params but same key and selection_mode
            st.pills(
                label="Label 2",
                key="pills_key",
                help="Help 2",
                disabled=True,
                width="stretch",
                on_change=lambda: None,
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
                label_visibility="hidden",
                default="b",
                # These can change without affecting ID:
                options=["a", "b", "c"],
                selection_mode="single",
                format_func=lambda x: x.capitalize(),
            )
            proto2 = self.get_delta_from_queue().new_element.button_group
            id2 = proto2.id
            assert id1 == id2

    @parameterized.expand(
        [
            # Only selection_mode (click_mode) changes should cause ID changes
            # options and format_func are not in key_as_main_identity for pills/segmented_control
            ("selection_mode", "single", "multi"),
        ]
    )
    def test_whitelisted_stable_key_kwargs_pills(
        self, kwarg_name: str, value1: object, value2: object
    ):
        """Test that the widget ID changes for pills when selection_mode changes even when
        the key is provided. Options and format_func changes do NOT cause ID changes.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            base_kwargs: dict[str, object] = {
                "label": "Label",
                "key": "pills_key_1",
                "options": ["a", "b", "c"],
                "selection_mode": "single",
            }

            # Apply first value for the whitelisted kwarg
            base_kwargs[kwarg_name] = value1
            st.pills(**base_kwargs)  # type: ignore[arg-type]
            proto1 = self.get_delta_from_queue().new_element.button_group
            id1 = proto1.id

            # Apply second value for the whitelisted kwarg
            base_kwargs[kwarg_name] = value2
            st.pills(**base_kwargs)  # type: ignore[arg-type]
            proto2 = self.get_delta_from_queue().new_element.button_group
            id2 = proto2.id
            assert id1 != id2

    def test_options_change_does_not_change_id_pills(self):
        """Test that changing options does NOT change the widget ID when a key is provided.

        This is the key behavior for dynamic options support - options can change
        without resetting the widget state.
        """
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with options ["a", "b"]
            st.pills(
                label="Label",
                key="pills_options_key",
                options=["a", "b"],
                selection_mode="single",
            )
            proto1 = self.get_delta_from_queue().new_element.button_group
            id1 = proto1.id

            # Second render with different options ["x", "y", "z"]
            st.pills(
                label="Label",
                key="pills_options_key",
                options=["x", "y", "z"],
                selection_mode="single",
            )
            proto2 = self.get_delta_from_queue().new_element.button_group
            id2 = proto2.id

            # IDs should be the SAME because options is not in key_as_main_identity
            assert id1 == id2


class TestButtonGroupAppTest:
    """AppTest tests for st.pills and st.segmented_control."""

    def test_pills_with_format_func(self):
        """Test st.pills with format_func works correctly in AppTest.

        This is a regression test for the format_func issue where
        the testing framework would fail on subsequent runs.
        """

        def script():
            import streamlit as st

            st.pills(
                "single pills",
                options=["a", "b", "c"],
                format_func=lambda x: x.upper(),
                key="sp",
            )

        at = AppTest.from_function(script).run()
        assert not at.exception

        # Initial value should be None for single-select
        assert at.button_group("sp").value is None

        # Select a value and run again
        at.button_group("sp").select("a").run()
        assert at.button_group("sp").value == "a"
        assert not at.exception

        # Select a different value - this would fail before the fix
        at.button_group("sp").select("b").run()
        assert at.button_group("sp").value == "b"
        assert not at.exception

    def test_pills_multi_select_with_format_func(self):
        """Test st.pills multi-select with format_func works correctly in AppTest."""

        def script():
            import streamlit as st

            st.pills(
                "multi pills",
                options=[1, 2, 3],
                selection_mode="multi",
                format_func=lambda x: f"Num: {x}",
                key="mp",
            )

        at = AppTest.from_function(script).run()
        assert not at.exception

        # Initial value should be empty list for multi-select
        assert at.button_group("mp").value == []

        # Select multiple values
        at.button_group("mp").select(1).select(2).run()
        assert at.button_group("mp").value == [1, 2]
        assert not at.exception

        # Unselect a value
        at.button_group("mp").unselect(1).run()
        assert at.button_group("mp").value == [2]
        assert not at.exception

    def test_segmented_control_with_format_func(self):
        """Test st.segmented_control with format_func works correctly in AppTest."""

        def script():
            import streamlit as st

            st.segmented_control(
                "segmented",
                options=["x", "y", "z"],
                format_func=lambda x: x.upper(),
                key="sc",
            )

        at = AppTest.from_function(script).run()
        assert not at.exception

        # Initial value should be None
        assert at.button_group("sc").value is None

        # Select a value
        at.button_group("sc").select("x").run()
        assert at.button_group("sc").value == "x"
        assert not at.exception

        # Select a different value - this would fail before the fix
        at.button_group("sc").select("y").run()
        assert at.button_group("sc").value == "y"
        assert not at.exception


class PillsBindQueryParamsTest(DeltaGeneratorTestCase):
    """Tests for st.pills bind='query-params' functionality."""

    def test_bind_sets_query_param_key(self):
        """Test that bind='query-params' with a key sets query_param_key in proto."""
        st.pills("label", ["a", "b", "c"], key="my_key", bind="query-params")

        c = self.get_delta_from_queue().new_element.button_group
        assert c.query_param_key == "my_key"

    def test_bind_without_key_raises_exception(self):
        """Test that bind='query-params' without a key raises an exception."""
        with pytest.raises(StreamlitAPIException, match=r"must have a unique 'key'"):
            st.pills("label", ["a", "b", "c"], bind="query-params")

    def test_no_bind_does_not_set_query_param_key(self):
        """Test that without bind, query_param_key is not set."""
        st.pills("label", ["a", "b", "c"], key="my_key")

        c = self.get_delta_from_queue().new_element.button_group
        assert c.query_param_key == ""

    def test_invalid_bind_value_raises_exception(self):
        """Test that an invalid bind value raises StreamlitInvalidBindValueError."""
        with pytest.raises(StreamlitInvalidBindValueError, match=r"invalid-value"):
            st.pills("label", ["a", "b"], key="my_key", bind="invalid-value")

    def test_bind_with_format_func(self):
        """Test that bind works with format_func."""
        st.pills(
            "label",
            ["cat", "dog"],
            format_func=str.upper,
            key="my_key",
            bind="query-params",
        )

        c = self.get_delta_from_queue().new_element.button_group
        assert c.query_param_key == "my_key"

    def test_bind_multi_mode(self):
        """Test that bind works with selection_mode='multi'."""
        st.pills(
            "label",
            ["a", "b", "c"],
            selection_mode="multi",
            key="my_key",
            bind="query-params",
        )

        c = self.get_delta_from_queue().new_element.button_group
        assert c.query_param_key == "my_key"


class SegmentedControlBindQueryParamsTest(DeltaGeneratorTestCase):
    """Tests for st.segmented_control bind='query-params' functionality."""

    def test_bind_sets_query_param_key(self):
        """Test that bind='query-params' with a key sets query_param_key in proto."""
        st.segmented_control(
            "label", ["a", "b", "c"], key="my_key", bind="query-params"
        )

        c = self.get_delta_from_queue().new_element.button_group
        assert c.query_param_key == "my_key"

    def test_bind_without_key_raises_exception(self):
        """Test that bind='query-params' without a key raises an exception."""
        with pytest.raises(StreamlitAPIException, match=r"must have a unique 'key'"):
            st.segmented_control("label", ["a", "b", "c"], bind="query-params")

    def test_no_bind_does_not_set_query_param_key(self):
        """Test that without bind, query_param_key is not set."""
        st.segmented_control("label", ["a", "b", "c"], key="my_key")

        c = self.get_delta_from_queue().new_element.button_group
        assert c.query_param_key == ""

    def test_bind_multi_mode(self):
        """Test that bind works with selection_mode='multi'."""
        st.segmented_control(
            "label",
            ["a", "b", "c"],
            selection_mode="multi",
            key="my_key",
            bind="query-params",
        )

        c = self.get_delta_from_queue().new_element.button_group
        assert c.query_param_key == "my_key"
