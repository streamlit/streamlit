# Copyright 2019 Streamlit Inc. All rights reserved.

"""slider unit test."""

from tests import testutil
import streamlit as st
from parameterized import parameterized


class SliderTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall slider protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.slider('the label')

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.label, 'the label')
        self.assertEqual(c.value, [0.0])

    @parameterized.expand([
        (0, [0.0]),
        (0.0, [0.0]),
        ((0, 1), [0.0, 1.0]),
        ([0, 1], [0.0, 1.0]),
        ((0.0, 1.0), [0.0, 1.0]),
        ([0.0, 1.0], [0.0, 1.0])
    ])
    def test_value_types(self, arg_value, proto_value):
        """Test that it supports different types of values."""
        st.slider('the label', arg_value)

        c = self.get_delta_from_queue().new_element.slider
        self.assertEqual(c.label, 'the label')
        self.assertEqual(c.value, proto_value)
