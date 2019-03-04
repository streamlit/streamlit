# Copyright 2019 Streamlit Inc. All rights reserved.

"""vega_lite unit test."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import unittest
import pandas as pd
import json

from streamlit.DeltaGenerator import DeltaGenerator


df1 = pd.DataFrame(
    [['A', 'B', 'C', 'D'], [28, 55, 43, 91]],
    index=['a', 'b']
).T


class VegaLiteTest(unittest.TestCase):
    """Test ability to marshall vega_lite_chart protos."""

    def test_no_args(self):
        """Test that it can be called with no args."""
        queue = []
        dg = DeltaGenerator(queue.append)
        dg.vega_lite_chart()

        c = queue[-1].new_element.vega_lite_chart
        self.assertEqual(c.HasField('data'), False)
        self.assertDictEqual(json.loads(c.spec), {})

    def test_none_args(self):
        """Test that it can be called with args set to None."""
        queue = []
        dg = DeltaGenerator(queue.append)
        dg.vega_lite_chart(None, None)

        c = queue[-1].new_element.vega_lite_chart
        self.assertEqual(c.HasField('data'), False)
        self.assertDictEqual(json.loads(c.spec), {})

    def test_spec_but_no_data(self):
        """Test that it can be called with only data set to None."""
        queue = []
        dg = DeltaGenerator(queue.append)
        dg.vega_lite_chart(None, {'hello': 'hi'})

        c = queue[-1].new_element.vega_lite_chart
        self.assertEqual(c.HasField('data'), False)
        self.assertDictEqual(json.loads(c.spec), {'hello': 'hi'})

    def test_spec_in_arg1(self):
        """Test that it can be called spec as the 1st arg."""
        queue = []
        dg = DeltaGenerator(queue.append)
        dg.vega_lite_chart({'hello': 'hi'})

        c = queue[-1].new_element.vega_lite_chart
        self.assertEqual(c.HasField('data'), False)
        self.assertDictEqual(json.loads(c.spec), {'hello': 'hi'})

    def test_data_in_spec(self):
        """Test passing data=df inside the spec."""
        queue = []
        dg = DeltaGenerator(queue.append)

        dg.vega_lite_chart({
            'hello': 'hi',
            'data': df1,
        })

        c = queue[-1].new_element.vega_lite_chart
        self.assertEqual(c.HasField('data'), True)
        self.assertDictEqual(json.loads(c.spec), {'hello': 'hi'})

    def test_data_value_in_spec(self):
        """Test passing data={value: df} inside the spec."""
        queue = []
        dg = DeltaGenerator(queue.append)

        dg.vega_lite_chart({
            'hello': 'hi',
            'data': {
                'value': df1,
            },
        })

        c = queue[-1].new_element.vega_lite_chart
        self.assertEqual(c.HasField('data'), True)
        self.assertDictEqual(json.loads(c.spec), {'data': {}, 'hello': 'hi'})

    def test_datasets_in_spec(self):
        """Test passing datasets={foo: df} inside the spec."""
        queue = []
        dg = DeltaGenerator(queue.append)

        dg.vega_lite_chart({
            'hello': 'hi',
            'datasets': {
                'foo': df1,
            },
        })

        c = queue[-1].new_element.vega_lite_chart
        self.assertEqual(c.HasField('data'), False)
        self.assertDictEqual(json.loads(c.spec), {'hello': 'hi'})

    def test_datasets_correctly_in_spec(self):
        """Test passing datasets={foo: df}, data={name: 'foo'} in the spec."""
        queue = []
        dg = DeltaGenerator(queue.append)

        dg.vega_lite_chart({
            'hello': 'hi',
            'datasets': {
                'foo': df1,
            },
            'data': {
                'name': 'foo',
            },
        })

        c = queue[-1].new_element.vega_lite_chart
        self.assertEqual(c.HasField('data'), False)
        self.assertDictEqual(json.loads(c.spec), {
            'data': {'name': 'foo'}, 'hello': 'hi'
        })

    def test_dict_unflatten(self):
        """Test passing a spec as keywords."""
        queue = []
        dg = DeltaGenerator(queue.append)

        dg.vega_lite_chart(
            df1,
            x='foo',
            boink_boop=100,
            baz={'boz': 'booz'},
        )

        c = queue[-1].new_element.vega_lite_chart
        self.assertEqual(c.HasField('data'), True)
        self.assertDictEqual(
            json.loads(c.spec),
            {
                'baz': {'boz': 'booz'},
                'boink': {'boop': 100},
                'encoding': {'x': 'foo'}
            })
