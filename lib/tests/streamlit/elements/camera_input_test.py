"""camera_input unit test."""

from parameterized import parameterized

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.proto.LabelVisibilityMessage_pb2 import LabelVisibilityMessage
from tests import testutil


class CameraInputTest(testutil.DeltaGeneratorTestCase):
    def test_just_label(self):
        """Test that it can be called with no other values."""
        st.camera_input("the label")

        c = self.get_delta_from_queue().new_element.camera_input
        self.assertEqual(c.label, "the label")
        self.assertEqual(
            c.label_visibility.value,
            LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE,
        )

    def test_help_tooltip(self):
        """Test that it can be called with help parameter."""
        st.camera_input("the label", help="help_label")

        c = self.get_delta_from_queue().new_element.camera_input
        self.assertEqual(c.help, "help_label")

    @parameterized.expand(
        [
            ("visible", LabelVisibilityMessage.LabelVisibilityOptions.VISIBLE),
            ("hidden", LabelVisibilityMessage.LabelVisibilityOptions.HIDDEN),
            ("collapsed", LabelVisibilityMessage.LabelVisibilityOptions.COLLAPSED),
        ]
    )
    def test_label_visibility(self, label_visibility_value, proto_value):
        """Test that it can be called with label_visibility parameter."""
        st.camera_input("the label", label_visibility=label_visibility_value)

        c = self.get_delta_from_queue().new_element.camera_input
        self.assertEqual(c.label_visibility.value, proto_value)

    def test_label_visibility_wrong_value(self):
        with self.assertRaises(StreamlitAPIException) as e:
            st.camera_input("the label", label_visibility="wrong_value")
            self.assertEquals(
                str(e),
                "Unsupported label_visibility option 'wrong_value'. Valid values are "
                "'visible', 'hidden' or 'collapsed'.",
            )
