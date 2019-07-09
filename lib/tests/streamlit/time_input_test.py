# Copyright 2019 Streamlit Inc. All rights reserved.

"""time_input unit test."""

from tests import testutil
import streamlit as st
from parameterized import parameterized
from datetime import datetime
from datetime import time


class TimeInputTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall time_input protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.time_input('the label')

        c = self.get_delta_from_queue().new_element.time_input
        self.assertEqual(c.label, 'the label')
        self.assertLessEqual(
            datetime.strptime(c.value, '%H:%M').time(),
            datetime.now().time())

    @parameterized.expand([
        (time(8, 45), '08:45'),
        (datetime(2019, 7, 6, 21, 15), '21:15')
    ])
    def test_value_types(self, arg_value, proto_value):
        """Test that it supports different types of values."""
        st.time_input('the label', arg_value)

        c = self.get_delta_from_queue().new_element.time_input
        self.assertEqual(c.label, 'the label')
        self.assertEqual(c.value, proto_value)
