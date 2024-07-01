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

import streamlit as st

import pytest
from tests.delta_generator_test_case import DeltaGeneratorTestCase

from parameterized import parameterized

import numpy as np
import pandas as pd
from unittest.mock import MagicMock, patch


from streamlit.elements.widgets.options_selector.button_group import ButtonGroupMixin
from streamlit.testing.v1.app_test import AppTest
from streamlit.testing.v1.util import patch_config_options
from streamlit.proto.ButtonGroup_pb2 import ButtonGroup as ButtonGroupProto
from streamlit.errors import StreamlitAPIException


class ButtonGroupFeedbackTest(DeltaGeneratorTestCase):
    """Test ability to marshall button_group protos."""

    def test_feedback(self):
        st.feedback("thumbs")

        delta = self.get_delta_from_queue().new_element.button_group
        self.assertEqual(
            delta.options,
            [
                ButtonGroupProto.Option(content=":material/thumb_up:"),
                ButtonGroupProto.Option(content=":material/thumb_down:"),
            ],
        )
        self.assertEqual(delta.default, [])
        self.assertEqual(delta.click_mode, 0)
        self.assertFalse(delta.disabled)
        self.assertEqual(delta.form_id, "")
        self.assertEqual(delta.selection_visualization, 0)

    def test_default_return_value(self):
        sentiment = st.feedback("thumbs")
        self.assertIsNone(sentiment)

    def test_feedback_disabled(self):
        st.feedback("thumbs", disabled=True)

        delta = self.get_delta_from_queue().new_element.button_group
        self.assertTrue(delta.disabled)


# TODO: These tests are very similar to the ones in multiselect_test.py -> refactor to re-use them
class TestButtonGroup(DeltaGeneratorTestCase):
    @parameterized.expand(
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
    def test_option_types(self, options, proto_options):
        """Test that it supports different types of options."""
        ButtonGroupMixin._button_group(
            st._main, options, format_func=lambda x: ButtonGroupProto.Option(content=x)
        )

        c = self.get_delta_from_queue().new_element.button_group
        self.assertListEqual(c.default[:], [])
        self.assertEqual(
            c.options,
            [ButtonGroupProto.Option(content=option) for option in proto_options],
        )

    def test_default_string(self):
        """Test if works when the default value is not a list."""
        arg_options = ["some str", 123, None, {}]
        proto_options = ["some str", "123", "None", "{}"]

        ButtonGroupMixin._button_group(
            st._main,
            arg_options,
            default={},
            format_func=lambda x: ButtonGroupProto.Option(content=str(x)),
        )

        c = self.get_delta_from_queue().new_element.button_group
        self.assertListEqual(c.default[:], [3])
        self.assertEqual(
            c.options,
            [ButtonGroupProto.Option(content=option) for option in proto_options],
        )

    @parameterized.expand(
        [
            ((),),
            ([],),
            (np.array([]),),
            (pd.Series(np.array([])),),
            (set(),),
            (list(),),
        ]
    )
    def test_no_options(self, options):
        """Test that it handles no options."""
        ButtonGroupMixin._button_group(
            st._main,
            options,
            format_func=lambda x: ButtonGroupProto.Option(content=str(x)),
        )

        c = self.get_delta_from_queue().new_element.button_group
        self.assertListEqual(c.default[:], [])
        self.assertEqual(c.options, [])

    @parameterized.expand([(15, TypeError), ("str", TypeError)])
    def test_invalid_options(self, options, expected):
        """Test that it handles invalid options."""
        with self.assertRaises(expected):
            ButtonGroupMixin._button_group(
                st._main,
                options,
                format_func=lambda x: ButtonGroupProto.Option(content=str(x)),
            )

    @parameterized.expand([(None, []), ([], []), (["Tea", "Water"], [1, 2])])
    def test_defaults(self, defaults, expected):
        """Test that valid default can be passed as expected."""
        ButtonGroupMixin._button_group(
            st._main,
            ["Coffee", "Tea", "Water"],
            default=defaults,
            format_func=lambda x: ButtonGroupProto.Option(content=str(x)),
        )
        c = self.get_delta_from_queue().new_element.button_group
        self.assertListEqual(c.default[:], expected)
        self.assertEqual(
            c.options,
            [
                ButtonGroupProto.Option(content=option)
                for option in ["Coffee", "Tea", "Water"]
            ],
        )

    @parameterized.expand(
        [
            (("Tea", "Water"), [1, 2]),
            ((i for i in ("Tea", "Water")), [1, 2]),
            (np.array(["Coffee", "Tea"]), [0, 1]),
            (pd.Series(np.array(["Coffee", "Tea"])), [0, 1]),
            ("Coffee", [0]),
        ]
    )
    def test_default_types(self, defaults, expected):
        """Test that iterables other than lists can be passed as defaults."""
        ButtonGroupMixin._button_group(
            st._main,
            ["Coffee", "Tea", "Water"],
            default=defaults,
            format_func=lambda x: ButtonGroupProto.Option(content=str(x)),
        )

        c = self.get_delta_from_queue().new_element.button_group
        self.assertListEqual(c.default[:], expected)
        self.assertEqual(
            c.options,
            [
                ButtonGroupProto.Option(content=option)
                for option in ["Coffee", "Tea", "Water"]
            ],
        )

    @parameterized.expand(
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
    def test_options_with_default_types(
        self, options, defaults, expected_options, expected_default
    ):
        ButtonGroupMixin._button_group(
            st._main,
            options,
            default=defaults,
            format_func=lambda x: ButtonGroupProto.Option(content=str(x)),
        )
        c = self.get_delta_from_queue().new_element.button_group
        self.assertListEqual(c.default[:], expected_default)
        self.assertEqual(
            c.options,
            [ButtonGroupProto.Option(content=option) for option in expected_options],
        )

    @parameterized.expand(
        [
            (["Tea", "Vodka", None], StreamlitAPIException),
            ([1, 2], StreamlitAPIException),
        ]
    )
    def test_invalid_defaults(self, defaults, expected):
        """Test that invalid default trigger the expected exception."""
        with self.assertRaises(expected):
            ButtonGroupMixin._button_group(
                st._main,
                ["Coffee", "Tea", "Water"],
                default=defaults,
                format_func=lambda x: ButtonGroupProto.Option(content=str(x)),
            )

    def test_outside_form(self):
        """Test that form id is marshalled correctly outside of a form."""

        ButtonGroupMixin._button_group(
            st._main,
            ["bar", "baz"],
            format_func=lambda x: ButtonGroupProto.Option(content=str(x)),
        )

        proto = self.get_delta_from_queue().new_element.button_group
        self.assertEqual(proto.form_id, "")

    @patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_inside_form(self):
        """Test that form id is marshalled correctly inside of a form."""

        with st.form("form"):
            ButtonGroupMixin._button_group(
                st._main,
                ["bar", "baz"],
                format_func=lambda x: ButtonGroupProto.Option(content=str(x)),
            )
        # 2 elements will be created: form block, widget
        self.assertEqual(len(self.get_all_deltas_from_queue()), 2)

        form_proto = self.get_delta_from_queue(0).add_block
        proto = self.get_delta_from_queue(1).new_element.button_group
        self.assertEqual(proto.form_id, form_proto.form.form_id)

    def test_inside_column(self):
        """Test that it works correctly inside of a column."""

        col1, col2 = st.columns(2)

        with col1:
            ButtonGroupMixin._button_group(
                st._main,
                ["bar", "baz"],
                format_func=lambda x: ButtonGroupProto.Option(content=str(x)),
            )
        all_deltas = self.get_all_deltas_from_queue()

        # 4 elements will be created: 1 horizontal block, 2 columns, 1 widget
        self.assertEqual(len(all_deltas), 4)
        proto = self.get_delta_from_queue().new_element.button_group

        self.assertEqual(proto.default, [])
        self.assertEqual(
            proto.options,
            [ButtonGroupProto.Option(content=option) for option in ["bar", "baz"]],
        )


def test_button_group_coercion():
    """Test E2E Enum Coercion on a selectbox."""

    def script():
        from enum import Enum

        import streamlit as st

        from streamlit.elements.widgets.options_selector.button_group import (
            ButtonGroupMixin,
        )
        from streamlit.proto.ButtonGroup_pb2 import ButtonGroup as ButtonGroupProto

        class EnumA(Enum):
            A = 1
            B = 2
            C = 3

        button_group = ButtonGroupMixin._button_group(
            st._main,
            EnumA,
            default=[EnumA.A, EnumA.C],
            format_func=lambda x: ButtonGroupProto.Option(content=str(x)),
        )
        print(f"Button Group: {button_group}")
        st.text(id(button_group[0].__class__))
        st.text(id(EnumA))
        st.text(all(selected in EnumA for selected in button_group))

    at = AppTest.from_function(script).run()

    def test_enum():
        button_group = at.button_group[0]
        original_class = button_group.value[0].__class__
        button_group.set_value([original_class.A, original_class.B]).run()
        assert at.text[0].value == at.text[1].value, "Enum Class ID not the same"
        assert at.text[2].value == "True", "Not all enums found in class"

    with patch_config_options({"runner.enumCoercion": "nameOnly"}):
        test_enum()
    with patch_config_options({"runner.enumCoercion": "off"}):
        with pytest.raises(AssertionError):
            test_enum()  # expect a failure with the config value off.
