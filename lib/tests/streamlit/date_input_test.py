# Copyright 2019 Streamlit Inc. All rights reserved.

"""date_input unit test."""

from tests import testutil
import streamlit as st
from parameterized import parameterized
from datetime import datetime
from datetime import date


class DateInputTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall date_input protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.date_input('the label')

        c = self.get_delta_from_queue().new_element.date_input
        self.assertEqual(c.label, 'the label')
        self.assertLessEqual(
            datetime.strptime(c.value, '%Y/%m/%d').date(),
            datetime.now().date())

    @parameterized.expand([
        (date(1970, 1, 1), '1970/01/01'),
        (datetime(2019, 7, 6, 21, 15), '2019/07/06')
    ])
    def test_value_types(self, arg_value, proto_value):
        """Test that it supports different types of values."""
        st.date_input('the label', arg_value)

        c = self.get_delta_from_queue().new_element.date_input
        self.assertEqual(c.label, 'the label')
        self.assertEqual(c.value, proto_value)
