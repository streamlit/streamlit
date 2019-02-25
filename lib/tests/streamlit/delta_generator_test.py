# -*- coding: future_fstrings -*-

"""DeltaGenerator Unittest."""

# Copyright 2018 Streamlit Inc. All rights reserved.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import json
import unittest
import pandas as pd

from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.ReportQueue import ReportQueue
from streamlit import protobuf
from streamlit import util


class DeltaGeneratorClassTest(unittest.TestCase):
    """Test DeltaGenerator Class."""

    def setUp(self):
        """Setup."""
        self._mock_queue = 'mock queue'

    def test_constructor(self):
        """Test default DeltaGenerator()."""
        dg = DeltaGenerator(self._mock_queue)

        self.assertEqual(dg._queue, self._mock_queue)
        self.assertTrue(dg._generate_new_ids)
        self.assertEqual(dg._next_id, 0)
        self.assertFalse(hasattr(dg, '_id'))

    def test_constructor_with_id(self):
        """Test DeltaGenerator() with an id."""
        some_id = 1234
        dg = DeltaGenerator(self._mock_queue, id=some_id)

        self.assertFalse(dg._generate_new_ids)
        self.assertEqual(dg._id, some_id)
        self.assertFalse(hasattr(dg, '_next_id'))


class DeltaGeneratorTextTest(unittest.TestCase):
    """Test DeltaGenerator Text Proto Class."""

    def setUp(self):
        """Setup."""
        self._dg = DeltaGenerator(ReportQueue())

    def test_generic_text(self):
        """Test protobuf.Text generic str(body) stuff."""
        test_data = {
            'text': protobuf.Text.PLAIN,
            'error': protobuf.Text.ERROR,
            'warning': protobuf.Text.WARNING,
            'info': protobuf.Text.INFO,
            'success': protobuf.Text.SUCCESS,
        }

        string_data = 'Some string'
        for name, format in test_data.items():
            method = getattr(self._dg, name)
            method(string_data)

            element = get_element(self._dg)
            self.assertEqual(string_data, getattr(element, 'text').body)
            self.assertEqual(format, getattr(element, 'text').format)

    def test_json_object(self):
        """Test protobuf.Text.JSON object."""
        json_data = {
            'key': 'value',
        }

        # Testing python object
        self._dg.json(json_data)

        json_string = json.dumps(json_data)

        element = get_element(self._dg)
        self.assertEqual(json_string, element.text.body)
        self.assertEqual(protobuf.Text.JSON, element.text.format)

    def test_json_string(self):
        """Test protobuf.Text.JSON string."""
        json_string = u'{"key": "value"}'

        # Testing JSON string
        self._dg.json(json_string)

        element = get_element(self._dg)
        self.assertEqual(json_string, element.text.body)
        self.assertEqual(protobuf.Text.JSON, element.text.format)

    def test_markdown(self):
        """Test protobuf.Text.MARKDOWN."""
        test_string = '    data         '

        self._dg.markdown(test_string)

        element = get_element(self._dg)
        self.assertEqual(u'data', element.text.body)
        self.assertEqual(protobuf.Text.MARKDOWN, element.text.format)

    def test_empty(self):
        """Test protobuf.Empty."""
        self._dg.empty()

        element = get_element(self._dg)
        self.assertEqual(True, element.empty.unused)


class DeltaGeneratorProgressTest(unittest.TestCase):
    """Test DeltaGenerator Progress."""

    def test_progress(self):
        """Test protobuf.Progress."""
        dg = DeltaGenerator(ReportQueue())

        some_value = 42
        dg.progress(some_value)

        element = get_element(dg)
        self.assertEqual(some_value, element.progress.value)


class DeltaGeneratorChartTest(unittest.TestCase):
    """Test DeltaGenerator Charts."""

    def setUp(self):
        """Setup."""
        self._dg = DeltaGenerator(ReportQueue())

    def test_line_chart(self):
        """Test dg.line_chart."""
        data = pd.DataFrame([[20, 30, 50]], columns=['a', 'b', 'c'])

        dg = self._dg.line_chart(data)

        element = get_element(dg)
        self.assertEqual(element.chart.type, 'LineChart')
        self.assertEqual(element.chart.data.data.cols[0].int64s.data[0], 20)
        self.assertEqual(len(element.chart.components), 8)

    def test_area_chart(self):
        """Test dg.area_chart."""
        data = pd.DataFrame([[20, 30, 50]], columns=['a', 'b', 'c'])

        dg = self._dg.area_chart(data)

        element = get_element(dg)
        self.assertEqual(element.chart.type, 'AreaChart')
        self.assertEqual(element.chart.data.data.cols[0].int64s.data[0], 20)
        self.assertEqual(len(element.chart.components), 8)

    def test_bar_chart(self):
        """Test dg.bar_chart."""
        data = pd.DataFrame([[20, 30, 50]], columns=['a', 'b', 'c'])

        dg = self._dg.bar_chart(data)

        element = get_element(dg)
        self.assertEqual(element.chart.type, 'BarChart')
        self.assertEqual(element.chart.data.data.cols[0].int64s.data[0], 20)
        self.assertEqual(len(element.chart.components), 8)

def get_element(dg):
    return dg._queue.get_deltas()[-1].new_element
