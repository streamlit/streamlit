# Copyright 2019 Streamlit Inc. All rights reserved.

"""text_area unit test."""

import re

from tests import testutil
import streamlit as st


class TextAreaTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall text_area protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.text_area('the label')

        c = self.get_delta_from_queue().new_element.text_area
        self.assertEqual(c.label, 'the label')
        self.assertEqual(c.value, '')

    def test_value_types(self):
        """Test that it supports different types of values."""
        arg_values = ['some str', 123, None, {}, SomeObj()]
        proto_values = ['some str', '123', 'None', '{}', '.*SomeObj.*']

        for arg_value, proto_value in zip(arg_values, proto_values):
            st.text_area('the label', arg_value)

            c = self.get_delta_from_queue().new_element.text_area
            self.assertEqual(c.label, 'the label')
            self.assertTrue(re.match(proto_value, c.value))


class SomeObj(object):
    pass
