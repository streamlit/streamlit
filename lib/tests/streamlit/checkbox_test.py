# Copyright 2019 Streamlit Inc. All rights reserved.

"""checkbox unit tests."""

from parameterized import parameterized

from tests import testutil
import streamlit as st


class SomeObj(object):
    pass


class CheckboxTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall checkbox protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.checkbox('the label')

        c = self.get_delta_from_queue().new_element.checkbox
        self.assertEqual(c.label, 'the label')
        self.assertEqual(c.value, False)

    @parameterized.expand([
        ('some str', True),
        (123, True),
        (0, False),
        (None, False),
        ({}, False),
        (SomeObj(), True)
    ])
    def test_value_types(self, arg_value, proto_value):
        """Test that it supports different types of values."""
        st.checkbox('the label', arg_value)

        c = self.get_delta_from_queue().new_element.checkbox
        self.assertEqual(c.label, 'the label')
        self.assertEqual(c.value, proto_value)
