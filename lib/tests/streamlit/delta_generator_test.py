# Copyright 2019 Streamlit Inc. All rights reserved.
"""DeltaGenerator Unittest."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import json
import sys
import unittest

import pandas as pd

try:
    from inspect import signature
except ImportError:
    from funcsigs import signature

from streamlit import protobuf
from streamlit.DeltaGenerator import DeltaGenerator, _wraps_with_cleaned_sig, \
    _clean_up_sig
from streamlit.ReportQueue import ReportQueue


class FakeDeltaGenerator(object):
    """Fake DeltaGenerator class.

    The methods in this class are specifically here as to not use the
    one in the actual delta generator.  This purely exists just to test the
    DeltaGenerator Decorators without relying on the actual
    DeltaGenerator methods.
    """

    def __init__(self):
        """Constructor."""
        pass

    def fake_text(self, element, body):
        """Fake text delta generator."""
        element.text.body = str(body)
        element.text.format = protobuf.Text.PLAIN

    def fake_dataframe(self, element, arg0, data=None):
        """Fake dataframe.

        In the real dataframe, element is set to _ but in reality the
        decorator passes None in to what would be the element, so I want to
        verify that None is indeed getting passed in.
        """
        return (element, arg0, data)


class DeltaGeneratorTest(unittest.TestCase):
    """Test streamlit.DeltaGenerator methods."""

    def test_wraps_with_cleaned_sig(self):
        wrapped_function = _wraps_with_cleaned_sig(FakeDeltaGenerator.fake_text)
        wrapped = wrapped_function.keywords.get('wrapped')

        # Check meta data.
        self.assertEqual(wrapped.__module__, 'delta_generator_test')
        self.assertEqual(wrapped.__name__, 'fake_text')
        self.assertEqual(wrapped.__doc__, 'Fake text delta generator.')

        # Verify original signature
        sig = signature(FakeDeltaGenerator.fake_text)
        self.assertEqual(str(sig), '(self, element, body)')

        # Check clean signature
        sig = signature(wrapped)
        self.assertEqual(str(sig), '(body)')

    def test_clean_up_sig(self):
        wrapped = _clean_up_sig(FakeDeltaGenerator.fake_dataframe)

        # Verify original signature
        sig = signature(FakeDeltaGenerator.fake_dataframe)
        self.assertEqual(str(sig), '(self, element, arg0, data=None)', str(sig))

        # Check cleaned signature.
        # On python2 it looks like: '(self, *args, **kwargs)'
        if sys.version_info >= (3, 0):
            sig = signature(wrapped)
            self.assertEqual('(arg0, data=None)', str(sig))

        # Check cleaned output.
        dg = FakeDeltaGenerator()
        result = wrapped(dg, 'foo', data='bar')
        self.assertEqual(result, (None, 'foo', 'bar'))

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

    def test_code(self):
        """Test st.code()"""
        code = "print('Hello, %s!' % 'Streamlit')"
        expected_body = '```python\n%s\n```' % code

        self._dg.code(code, language='python')
        element = get_element(self._dg)

        # st.code() creates a MARKDOWN text object that wraps
        # the body inside a codeblock declaration
        self.assertEqual(element.text.format, protobuf.Text.MARKDOWN)
        self.assertEqual(element.text.body, expected_body)

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


class DeltaGeneratorImageTest(unittest.TestCase):
    """Test DeltaGenerator Images"""

    def setUp(self):
        self._dg = DeltaGenerator(ReportQueue())

    def test_image_from_url(self):
        """Tests dg.image with single and multiple image URLs"""

        url = 'https://streamlit.io/an_image.png'
        caption = 'ahoy!'

        # single URL
        dg = self._dg.image(url, caption=caption, width=200)
        element = get_element(dg)
        self.assertEqual(element.imgs.width, 200)
        self.assertEqual(len(element.imgs.imgs), 1)
        self.assertEqual(element.imgs.imgs[0].url, url)
        self.assertEqual(element.imgs.imgs[0].caption, caption)

        # multiple URLs
        dg = self._dg.image([url] * 5, caption=[caption] * 5, width=200)
        element = get_element(dg)
        self.assertEqual(len(element.imgs.imgs), 5)
        self.assertEqual(element.imgs.imgs[4].url, url)
        self.assertEqual(element.imgs.imgs[4].caption, caption)

    def test_unequal_images_and_captions_error(self):
        """Tests that the number of images and captions must match, or
        an exception is generated"""

        url = 'https://streamlit.io/an_image.png'
        caption = 'ahoy!'

        self._dg.image([url] * 5, caption=[caption] * 2)

        element = get_element(self._dg)
        self.assertEqual(element.exception.message,
                         'Cannot pair 2 captions with 5 images.')


def get_element(dg):
    return dg._queue.get_deltas()[-1].new_element
