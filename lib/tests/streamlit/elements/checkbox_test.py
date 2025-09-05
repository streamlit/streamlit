# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.lib.policies import _LOGGER
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Checkbox_pb2 import Checkbox as CheckboxProto
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class SomeObj:
    pass


class CheckboxTest(DeltaGeneratorTestCase):
    """Test ability to marshall checkbox protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.checkbox("the label")

        c = self.get_delta_from_queue().new_element.checkbox
        assert c.label == "the label"
        assert not c.default
        assert not c.disabled
        assert (
            c.label_visibility.value
            == LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE
        )
        assert c.type == CheckboxProto.StyleType.DEFAULT

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.checkbox("the label", disabled=True)

        c = self.get_delta_from_queue(0).new_element.checkbox
        assert c.disabled

    @parameterized.expand(
        [
            ("some str", True),
            (123, True),
            (0, False),
            (None, False),
            ({}, False),
            (SomeObj(), True),
        ]
    )
    def test_value_types(self, arg_value, proto_value):
        """Test that it supports different types of values."""
        st.checkbox("the label", arg_value)

        c = self.get_delta_from_queue().new_element.checkbox
        assert c.label == "the label"
        assert c.default == proto_value

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        st.checkbox("foo")

        proto = self.get_delta_from_queue().new_element.checkbox
        assert proto.form_id == ""

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            st.checkbox("foo")

        # 2 elements will be created: a block and a checkbox
        assert len(self.get_all_deltas_from_queue()) == 2

        form_proto = self.get_delta_from_queue(0).add_block.form
        checkbox_proto = self.get_delta_from_queue(1).new_element.checkbox
        assert checkbox_proto.form_id == form_proto.form_id

    def test_checkbox_help_dedents(self):
        """Test that the checkbox help properly dedents in order to avoid code blocks"""
        st.checkbox(
            "Checkbox label",
            value=True,
            help="""\
hello
 world
""",
        )
        c = self.get_delta_from_queue(0).new_element.checkbox
        assert c.label == "Checkbox label"
        assert c.default
        assert c.help == "hello\n world\n"

    @parameterized.expand(
        [
            ("visible", LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility param."""
        st.checkbox("the label", label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.checkbox
        assert c.label == "the label"
        assert c.label_visibility.value == proto_value

    def test_label_visibility_wrong_value(self):
        with pytest.raises(StreamlitAPIException) as e:
            st.checkbox("the label", label_visibility="wrong_value")
        assert (
            str(e.value)
            == "Unsupported label_visibility option 'wrong_value'. Valid values are 'visible', 'hidden' or 'collapsed'."
        )

    def test_empty_label_warning(self):
        """Test that a warning is logged if st.checkbox was called with empty label."""

        with self.assertLogs(_LOGGER) as logs:
            st.checkbox(label="")

        assert (
            "`label` got an empty value. This is discouraged for accessibility reasons"
            in logs.records[0].msg
        )
        # Check that the stack trace is included in the warning message:
        assert logs.records[0].stack_info is not None

    def test_toggle_widget(self):
        """Test that the usage of `st.toggle` uses the correct checkbox proto config."""
        st.toggle("the label")

        c = self.get_delta_from_queue().new_element.checkbox
        assert c.label == "the label"
        assert not c.default
        assert not c.disabled
        assert (
            c.label_visibility.value
            == LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE
        )
        assert c.type == CheckboxProto.StyleType.TOGGLE

    @parameterized.expand(
        [
            (
                "checkbox",
                lambda label="Label", **kwargs: st.checkbox(label, **kwargs),
                "checkbox",
            ),
            (
                "toggle",
                lambda label="Label", **kwargs: st.toggle(label, **kwargs),
                "checkbox",
            ),
        ]
    )
    def test_stable_id_with_key(self, name, command, attr):
        """Test that the widget ID is stable when a stable key is provided."""
        with patch(
            "streamlit.elements.lib.utils._register_element_id",
            return_value=MagicMock(),
        ):
            # First render with certain params
            command(
                label="Label 1",
                key=f"{name}_key",
                value=True,
                help="Help 1",
                disabled=False,
                width="content",
                on_change=lambda: None,
                args=("arg1", "arg2"),
                kwargs={"kwarg1": "kwarg1"},
                label_visibility="visible",
            )
            c1 = getattr(self.get_delta_from_queue().new_element, attr)
            id1 = c1.id

            # Second render with different params but same key
            command(
                label="Label 2",
                key=f"{name}_key",
                value=False,
                help="Help 2",
                disabled=True,
                width="stretch",
                on_change=lambda: None,
                args=("arg_1", "arg_2"),
                kwargs={"kwarg_1": "kwarg_1"},
                label_visibility="hidden",
            )
            c2 = getattr(self.get_delta_from_queue().new_element, attr)
            id2 = c2.id
            assert id1 == id2

    def test_checkbox_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.checkbox("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_toggle_shows_cached_widget_replay_warning(self):
        """Test that a warning is shown when this widget is used inside a cached function."""
        st.cache_data(lambda: st.toggle("the label"))()

        # The widget itself is still created, so we need to go back one element more:
        el = self.get_delta_from_queue(-2).new_element.exception
        assert el.type == "CachedWidgetWarning"
        assert el.is_warning

    def test_checkbox_with_width(self):
        """Test st.checkbox with different width types."""
        test_cases = [
            (500, WidthConfigFields.PIXEL_WIDTH.value, "pixel_width", 500),
            ("stretch", WidthConfigFields.USE_STRETCH.value, "use_stretch", True),
            ("content", WidthConfigFields.USE_CONTENT.value, "use_content", True),
        ]

        for index, (
            width_value,
            expected_width_spec,
            field_name,
            field_value,
        ) in enumerate(test_cases):
            with self.subTest(width_value=width_value):
                st.checkbox(f"checkbox width test {index}", width=width_value)

                el = self.get_delta_from_queue().new_element
                assert el.checkbox.label == f"checkbox width test {index}"

                assert el.width_config.WhichOneof("width_spec") == expected_width_spec
                assert getattr(el.width_config, field_name) == field_value

    def test_checkbox_with_invalid_width(self):
        """Test st.checkbox with invalid width values."""
        test_cases = [
            (
                "invalid",
                "Invalid width value: 'invalid'. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -100,
                "Invalid width value: -100. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Invalid width value: 0. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                100.5,
                "Invalid width value: 100.5. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
        ]

        for index, (width_value, expected_error_message) in enumerate(test_cases):
            with self.subTest(width_value=width_value):
                with pytest.raises(StreamlitAPIException) as exc:
                    st.checkbox(
                        f"invalid checkbox width test {index}", width=width_value
                    )

                assert str(exc.value) == expected_error_message

    def test_checkbox_default_width(self):
        """Test that st.checkbox defaults to content width."""
        st.checkbox("the label")

        el = self.get_delta_from_queue().new_element
        assert el.checkbox.label == "the label"
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert el.width_config.use_content is True

    def test_toggle_with_width(self):
        """Test st.toggle with different width types."""
        test_cases = [
            (500, WidthConfigFields.PIXEL_WIDTH.value, "pixel_width", 500),
            ("stretch", WidthConfigFields.USE_STRETCH.value, "use_stretch", True),
            ("content", WidthConfigFields.USE_CONTENT.value, "use_content", True),
        ]

        for index, (
            width_value,
            expected_width_spec,
            field_name,
            field_value,
        ) in enumerate(test_cases):
            with self.subTest(width_value=width_value):
                st.toggle(f"toggle width test {index}", width=width_value)

                el = self.get_delta_from_queue().new_element
                assert el.checkbox.label == f"toggle width test {index}"
                assert el.checkbox.type == CheckboxProto.StyleType.TOGGLE

                assert el.width_config.WhichOneof("width_spec") == expected_width_spec
                assert getattr(el.width_config, field_name) == field_value

    def test_toggle_with_invalid_width(self):
        """Test st.toggle with invalid width values."""
        test_cases = [
            (
                "invalid",
                "Invalid width value: 'invalid'. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                -100,
                "Invalid width value: -100. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                0,
                "Invalid width value: 0. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
            (
                100.5,
                "Invalid width value: 100.5. Width must be either an integer (pixels), 'stretch', or 'content'.",
            ),
        ]

        for index, (width_value, expected_error_message) in enumerate(test_cases):
            with self.subTest(width_value=width_value):
                with pytest.raises(StreamlitAPIException) as exc:
                    st.toggle(f"invalid toggle test {index}", width=width_value)

                assert str(exc.value) == expected_error_message

    def test_toggle_default_width(self):
        """Test that st.toggle defaults to content width."""
        st.toggle("the label")

        el = self.get_delta_from_queue().new_element
        assert el.checkbox.label == "the label"
        assert el.checkbox.type == CheckboxProto.StyleType.TOGGLE
        assert (
            el.width_config.WhichOneof("width_spec")
            == WidthConfigFields.USE_CONTENT.value
        )
        assert el.width_config.use_content is True
