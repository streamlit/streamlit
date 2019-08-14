# Copyright 2019 Streamlit Inc. All rights reserved.

"""selectbox unit tests."""

import numpy as np
import pandas as pd
from parameterized import parameterized

import streamlit as st
from tests import testutil


class SelectboxTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall selectbox protos."""

    def test_just_label(self):
        """Test that it can be called with no value."""
        st.selectbox('the label', ('m', 'f'))

        c = self.get_delta_from_queue().new_element.selectbox
        self.assertEqual(c.label, 'the label')
        self.assertEqual(c.value, 0)

    def test_valid_value(self):
        """Test that valid value is an int."""
        st.selectbox('the label', ('m', 'f'), 1)

        c = self.get_delta_from_queue().new_element.selectbox
        self.assertEqual(c.label, 'the label')
        self.assertEqual(c.value, 1)

    @parameterized.expand([
        (('m', 'f'), ['m', 'f']),
        (['male', 'female'], ['male', 'female']),
        (np.array(['m', 'f']), ['m', 'f']),
        (pd.Series(np.array(['male', 'female'])), ['male', 'female']),
    ])
    def test_option_types(self, options, proto_options):
        """Test that it supports different types of options."""
        st.selectbox('the label', options)

        c = self.get_delta_from_queue().new_element.selectbox
        self.assertEqual(c.label, 'the label')
        self.assertEqual(c.value, 0)
        self.assertEqual(c.options, proto_options)

    def test_cast_options_to_string(self):
        """Test that it casts options to string."""
        arg_options = ['some str', 123, None, {}]
        proto_options = ['some str', '123', 'None', '{}']

        st.selectbox('the label', arg_options)

        c = self.get_delta_from_queue().new_element.selectbox
        self.assertEqual(c.label, 'the label')
        self.assertEqual(c.value, 0)
        self.assertEqual(c.options, proto_options)

    def test_format_function(self):
        """Test that it formats options."""
        arg_options = [{'name': 'john', 'height': 180},
                       {'name': 'lisa', 'height': 200}]
        proto_options = ['john', 'lisa']

        st.selectbox('the label', arg_options,
                     format_func=lambda x: x['name'])

        c = self.get_delta_from_queue().new_element.selectbox
        self.assertEqual(c.label, 'the label')
        self.assertEqual(c.value, 0)
        self.assertEqual(c.options, proto_options)

    @parameterized.expand([
        ((),),
        ([],),
        (np.array([]),),
        (pd.Series(np.array([])),),
    ])
    def test_no_options(self, options):
        """Test that it handles no options."""
        st.selectbox('the label', [])

        c = self.get_delta_from_queue().new_element.selectbox
        self.assertEqual(c.label, 'the label')
        self.assertEqual(c.value, 0)
        self.assertEqual(c.options, [])

    def test_invalid_value(self):
        """Test that value must be an int."""
        st.selectbox('the label', ('m', 'f'), '1')

        c = self.get_delta_from_queue().new_element.exception
        self.assertEqual(c.type, 'TypeError')

    def test_invalid_value_range(self):
        """Test that value must be within the length of the options."""
        st.selectbox('the label', ('m', 'f'), 2)

        c = self.get_delta_from_queue().new_element.exception
        self.assertEqual(c.type, 'ValueError')
