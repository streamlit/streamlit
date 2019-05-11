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
    _clean_up_sig, _with_element
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

    def fake_text_raise_exception(self, element, body):
        """Fake text that raises exception."""
        raise Exception('Exception in fake_text_raise_exception')

    def exception(self, e):
        """Create fake exception handler.

        The real DeltaGenerator exception is more complicated.  We use
        this so _with_element can find the exception method.  The real
        exception method wil be tested later on.
        """
        self._exception_msg = str(e)

    def _enqueue_new_element_delta(self, marshall_element):
        """Fake enqueue new element delta.

        The real DeltaGenerator method actually enqueues the deltas but
        to test _with_element we just need this method to exist.  The
        real enqueue_new_element_delta will be tested later on.
        """
        delta = protobuf.Delta()
        marshall_element(delta.new_element)
        return delta


class MockQueue(object):
    def __init__(self):
        self._deltas = []

    def __call__(self, data):
        self._deltas.append(data)


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

    def test_with_element(self):
        wrapped = _with_element(FakeDeltaGenerator.fake_text)

        dg = FakeDeltaGenerator()
        data = 'some_text'
        # This would really look like st.text(data) but since we're
        # testng the wrapper, it looks like this.
        element = wrapped(dg, data)
        self.assertEqual(element.new_element.text.body, data)

    def test_with_element_exception(self):
        wrapped = _with_element(FakeDeltaGenerator.fake_text_raise_exception)

        dg = FakeDeltaGenerator()
        data = 'some_text'
        wrapped(dg, data)
        self.assertEqual(dg._exception_msg, 'Exception in fake_text_raise_exception')


class DeltaGeneratorClassTest(unittest.TestCase):
    """Test DeltaGenerator Class."""

    def setUp(self):
        self.queue = []

    def enqueue(self, msg):
        self.queue.append(msg)
        return True

    def test_constructor(self):
        """Test default DeltaGenerator()."""
        dg = DeltaGenerator(self.enqueue)
        self.assertTrue(dg._is_root)
        self.assertEqual(dg._id, 0)

    def test_constructor_with_id(self):
        """Test DeltaGenerator() with an id."""
        dg = DeltaGenerator(self.enqueue, id=1234, is_root=False)
        self.assertFalse(dg._is_root)
        self.assertEqual(dg._id, 1234)

    def test_enqueue_new_element_delta_null(self):
        # Test "Null" Delta generators
        dg = DeltaGenerator(None)
        new_dg = dg._enqueue_new_element_delta(None)
        self.assertEqual(dg, new_dg)

    def test_enqueue_new_element_delta(self):
        dg = DeltaGenerator(self.enqueue)
        self.assertEqual(0, dg._id)

        test_data = 'some test data'
        # Use FakeDeltaGenerator.fake_text cause if we use
        # DeltaGenerator.text, it calls enqueue_new_element_delta
        # automatically.  Ideally I should unwrap it.
        fake_dg = FakeDeltaGenerator()

        def marshall_element(element):
            fake_dg.fake_text(element, test_data)

        new_dg = dg._enqueue_new_element_delta(marshall_element)
        self.assertNotEqual(dg, new_dg)
        self.assertEqual(1, dg._id)

        element = self.queue[-1].delta.new_element
        self.assertEqual(element.text.body, test_data)

    def test_enqueue_new_element_delta_same_id(self):
        dg = DeltaGenerator(self.enqueue, id=123, is_root=False)
        self.assertEqual(123, dg._id)

        test_data = 'some test data'
        # Use FakeDeltaGenerator.fake_text cause if we use
        # DeltaGenerator.text, it calls enqueue_new_element_delta
        # automatically.  Ideally I should unwrap it.
        fake_dg = FakeDeltaGenerator()

        def marshall_element(element):
            fake_dg.fake_text(element, test_data)

        new_dg = dg._enqueue_new_element_delta(marshall_element)
        self.assertEqual(dg, new_dg)

        msg = self.queue[-1]
        self.assertEqual(123, msg.delta.id)
        self.assertEqual(msg.delta.new_element.text.body, test_data)


class DeltaGeneratorTextTest(unittest.TestCase):
    """Test DeltaGenerator Text Proto Class."""

    def setUp(self):
        self.queue = []

        def enqueue(x):
            self.queue.append(x)
            return True

        self._dg = DeltaGenerator(enqueue)

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

            element = self.queue[-1].delta.new_element
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

        element = self.queue[-1].delta.new_element
        self.assertEqual(json_string, element.text.body)
        self.assertEqual(protobuf.Text.JSON, element.text.format)

    def test_json_string(self):
        """Test protobuf.Text.JSON string."""
        json_string = u'{"key": "value"}'

        # Testing JSON string
        self._dg.json(json_string)

        element = self.queue[-1].delta.new_element
        self.assertEqual(json_string, element.text.body)
        self.assertEqual(protobuf.Text.JSON, element.text.format)

    def test_json_unserializable(self):
        """Test protobuf.Text.JSON with unserializable object."""
        obj = json  # Modules aren't serializable.

        # Testing unserializable object.
        self._dg.json(obj)

        element = self.queue[-1].delta.new_element
        # self.assertTrue(
        #     element.text.body.startswith('"<module \'json\' from '))
        self.assertEqual('"<class \'module\'>"', element.text.body)
        self.assertEqual(protobuf.Text.JSON, element.text.format)

    def test_markdown(self):
        """Test protobuf.Text.MARKDOWN."""
        test_string = '    data         '

        self._dg.markdown(test_string)

        element = self.queue[-1].delta.new_element
        self.assertEqual(u'data', element.text.body)
        self.assertEqual(protobuf.Text.MARKDOWN, element.text.format)

    def test_code(self):
        """Test st.code()"""
        code = "print('Hello, %s!' % 'Streamlit')"
        expected_body = '```python\n%s\n```' % code

        self._dg.code(code, language='python')
        element = self.queue[-1].delta.new_element

        # st.code() creates a MARKDOWN text object that wraps
        # the body inside a codeblock declaration
        self.assertEqual(element.text.format, protobuf.Text.MARKDOWN)
        self.assertEqual(element.text.body, expected_body)

    def test_empty(self):
        """Test protobuf.Empty."""
        self._dg.empty()

        element = self.queue[-1].delta.new_element
        self.assertEqual(True, element.empty.unused)


class DeltaGeneratorProgressTest(unittest.TestCase):
    """Test DeltaGenerator Progress."""

    def setUp(self):
        self.queue = []

        def enqueue(x):
            self.queue.append(x)
            return True

        self._dg = DeltaGenerator(enqueue)

    def test_progress_int(self):
        """Test protobuf.Progress with int values."""
        values = [0, 42, 100]
        for value in values:
            self._dg.progress(value)

            element = self.queue[-1].delta.new_element
            self.assertEqual(value, element.progress.value)

    def test_progress_float(self):
        """Test protobuf.Progress with float values."""
        values = [0.0, 0.42, 1.0]
        for value in values:
            self._dg.progress(value)

            element = self.queue[-1].delta.new_element
            self.assertEqual(int(value * 100), element.progress.value)

    def test_progress_bad_values(self):
        """Test protobuf.Progress with bad values."""
        values = [-1, 101, -0.01, 1.01]
        for value in values:
            self._dg.progress(value)

            element = self.queue[-1].delta.new_element
            self.assertEqual(element.exception.type, 'ValueError')

        self._dg.progress('some string')

        element = self.queue[-1].delta.new_element
        self.assertEqual(element.exception.type, 'TypeError')


class DeltaGeneratorChartTest(unittest.TestCase):
    """Test DeltaGenerator Charts."""

    def setUp(self):
        self.queue = []

        def enqueue(x):
            self.queue.append(x)
            return True

        self._dg = DeltaGenerator(enqueue)

    def test_line_chart(self):
        """Test dg.line_chart."""
        data = pd.DataFrame([[20, 30, 50]], columns=['a', 'b', 'c'])

        dg = self._dg.line_chart(data)

        element = self.queue[-1].delta.new_element
        self.assertEqual(element.chart.type, 'LineChart')
        self.assertEqual(element.chart.data.data.cols[0].int64s.data[0], 20)
        self.assertEqual(len(element.chart.components), 8)

    def test_area_chart(self):
        """Test dg.area_chart."""
        data = pd.DataFrame([[20, 30, 50]], columns=['a', 'b', 'c'])

        dg = self._dg.area_chart(data)

        element = self.queue[-1].delta.new_element
        self.assertEqual(element.chart.type, 'AreaChart')
        self.assertEqual(element.chart.data.data.cols[0].int64s.data[0], 20)
        self.assertEqual(len(element.chart.components), 8)

    def test_bar_chart(self):
        """Test dg.bar_chart."""
        data = pd.DataFrame([[20, 30, 50]], columns=['a', 'b', 'c'])

        dg = self._dg.bar_chart(data)

        element = self.queue[-1].delta.new_element
        self.assertEqual(element.chart.type, 'BarChart')
        self.assertEqual(element.chart.data.data.cols[0].int64s.data[0], 20)
        self.assertEqual(len(element.chart.components), 8)


class DeltaGeneratorImageTest(unittest.TestCase):
    """Test DeltaGenerator Images"""

    def setUp(self):
        self.queue = []

        def enqueue(x):
            self.queue.append(x)
            return True

        self._dg = DeltaGenerator(enqueue)

    def test_image_from_url(self):
        """Tests dg.image with single and multiple image URLs"""

        url = 'https://streamlit.io/an_image.png'
        caption = 'ahoy!'

        # single URL
        dg = self._dg.image(url, caption=caption, width=200)
        element = self.queue[-1].delta.new_element
        self.assertEqual(element.imgs.width, 200)
        self.assertEqual(len(element.imgs.imgs), 1)
        self.assertEqual(element.imgs.imgs[0].url, url)
        self.assertEqual(element.imgs.imgs[0].caption, caption)

        # multiple URLs
        dg = self._dg.image([url] * 5, caption=[caption] * 5, width=200)
        element = self.queue[-1].delta.new_element
        self.assertEqual(len(element.imgs.imgs), 5)
        self.assertEqual(element.imgs.imgs[4].url, url)
        self.assertEqual(element.imgs.imgs[4].caption, caption)

    def test_unequal_images_and_captions_error(self):
        """Tests that the number of images and captions must match, or
        an exception is generated"""

        url = 'https://streamlit.io/an_image.png'
        caption = 'ahoy!'

        self._dg.image([url] * 5, caption=[caption] * 2)

        element = self.queue[-1].delta.new_element
        self.assertEqual(element.exception.message,
                         'Cannot pair 2 captions with 5 images.')
