# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""DeltaGenerator Unittest."""

import json
import mock
import unittest

try:
    from inspect import signature
except ImportError:
    from funcsigs import signature

from parameterized import parameterized

import pandas as pd

from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.DeltaGenerator import _build_duplicate_widget_message
from streamlit.cursor import LockedCursor
from streamlit.errors import DuplicateWidgetID
from streamlit.errors import StreamlitAPIException
from streamlit.proto.BlockPath_pb2 import BlockPath
from streamlit.proto.Delta_pb2 import Delta
from streamlit.proto.Element_pb2 import Element
from streamlit.proto.TextArea_pb2 import TextArea
from streamlit.proto.TextInput_pb2 import TextInput
from streamlit.DeltaGenerator import (
    _wraps_with_cleaned_sig,
    _with_element,
    _set_widget_id,
)
from tests import testutil
import streamlit as st


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

    def __getattr__(self, name):
        streamlit_methods = [
            method_name for method_name in dir(st) if callable(getattr(st, method_name))
        ]

        def wrapper(*args, **kwargs):
            if name in streamlit_methods:
                if self._container == "sidebar":
                    message = (
                        "Method `%(name)s()` does not exist for "
                        "`st.sidebar`. Did you mean `st.%(name)s()`?" % {"name": name}
                    )
                else:
                    message = (
                        "Method `%(name)s()` does not exist for "
                        "`DeltaGenerator` objects. Did you mean "
                        "`st.%(name)s()`?" % {"name": name}
                    )
            else:
                message = "`%(name)s()` is not a valid Streamlit command." % {
                    "name": name
                }

            raise AttributeError(message)

        return wrapper

    def fake_text(self, element, body):
        """Fake text delta generator."""
        element.text.body = str(body)

    def fake_dataframe(self, arg0, data=None):
        """Fake dataframe."""
        return (arg0, data)

    def fake_text_raise_exception(self, element, body):
        """Fake text that raises exception."""
        raise Exception("Exception in fake_text_raise_exception")

    def exception(self, e):
        """Create fake exception handler.

        The real DeltaGenerator exception is more complicated.  We use
        this so _with_element can find the exception method.  The real
        exception method wil be tested later on.
        """
        self._exception_msg = str(e)

    def _enqueue_new_element_delta(self, marshall_element, delta_type, last_index):
        """Fake enqueue new element delta.

        The real DeltaGenerator method actually enqueues the deltas but
        to test _with_element we just need this method to exist.  The
        real enqueue_new_element_delta will be tested later on.
        """
        delta = Delta()
        marshall_element(delta.new_element)
        return delta


class MockQueue(object):
    def __init__(self):
        self._deltas = []

    def __call__(self, data):
        self._deltas.append(data)


class DeltaGeneratorTest(testutil.DeltaGeneratorTestCase):
    """Test streamlit.DeltaGenerator methods."""

    def test_nonexistent_method(self):
        with self.assertRaises(Exception) as ctx:
            st.sidebar.non_existing()

        self.assertEqual(
            str(ctx.exception), "`non_existing()` is not a valid Streamlit command."
        )

    def test_sidebar_nonexistent_method(self):
        with self.assertRaises(Exception) as ctx:
            st.sidebar.write()

        self.assertEqual(
            str(ctx.exception),
            "Method `write()` does not exist for `st.sidebar`. "
            "Did you mean `st.write()`?",
        )

    @parameterized.expand(
        [
            (st.empty().empty, "streamlit.DeltaGenerator", "empty", "()"),
            (st.empty().text, "streamlit.DeltaGenerator", "text", "(body)"),
            (
                st.empty().markdown,
                "streamlit.DeltaGenerator",
                "markdown",
                "(body, unsafe_allow_html=False)",
            ),
            (
                st.empty().checkbox,
                "streamlit.DeltaGenerator",
                "checkbox",
                "(label, value=False, key=None)",
            ),
            (
                st.empty().dataframe,
                "streamlit.DeltaGenerator",
                "dataframe",
                "(data=None, width=None, height=None)",
            ),
            (
                st.empty().add_rows,
                "streamlit.DeltaGenerator",
                "add_rows",
                "(data=None, **kwargs)",
            ),
            (st.write, "streamlit", "write", "(*args, **kwargs)"),
        ]
    )
    def test_function_signatures(self, func, module, name, sig):
        self.assertEqual(module, func.__module__)
        self.assertEqual(name, func.__name__)
        actual_sig = signature(func)
        self.assertEqual(str(actual_sig), sig)

    def test_wraps_with_cleaned_sig(self):
        wrapped_function = _wraps_with_cleaned_sig(FakeDeltaGenerator.fake_text, 2)
        wrapped = wrapped_function.keywords.get("wrapped")

        # Check meta data.
        self.assertEqual("delta_generator_test", wrapped.__module__)
        self.assertEqual("fake_text", wrapped.__name__)
        self.assertEqual("Fake text delta generator.", wrapped.__doc__)

        # Verify original signature
        sig = signature(FakeDeltaGenerator.fake_text)
        self.assertEqual(str(sig), "(self, element, body)")

        # Check clean signature
        sig = signature(wrapped)
        self.assertEqual(str(sig), "(body)")

    def test_with_element(self):
        wrapped = _with_element(FakeDeltaGenerator.fake_text)

        dg = FakeDeltaGenerator()
        data = "some_text"
        # This would really look like st.text(data) but since we're
        # testing the wrapper, it looks like this.
        element = wrapped(dg, data)
        self.assertEqual(element.new_element.text.body, data)

    def test_with_element_exception(self):
        wrapped = _with_element(FakeDeltaGenerator.fake_text_raise_exception)

        dg = FakeDeltaGenerator()
        data = "some_text"
        with self.assertRaises(Exception) as ctx:
            wrapped(dg, data)

        self.assertTrue("Exception in fake_text_raise_exception" in str(ctx.exception))

    def set_widget_requires_args(self):
        st.text_input()
        c = self.get_delta_from_queue().new_element.exception
        self.assertEqual(c.type, "TypeError")

    def test_duplicate_widget_id_error(self):
        """Multiple widgets with the same key should report an error."""
        widgets = {
            "button": lambda key=None: st.button("", key=key),
            "checkbox": lambda key=None: st.checkbox("", key=key),
            "multiselect": lambda key=None: st.multiselect("", options=[1, 2], key=key),
            "radio": lambda key=None: st.radio("", options=[1, 2], key=key),
            "selectbox": lambda key=None: st.selectbox("", options=[1, 2], key=key),
            "slider": lambda key=None: st.slider("", key=key),
            "text_area": lambda key=None: st.text_area("", key=key),
            "text_input": lambda key=None: st.text_input("", key=key),
            "time_input": lambda key=None: st.time_input("", key=key),
            "date_input": lambda key=None: st.date_input("", key=key),
            "number_input": lambda key=None: st.number_input("", key=key),
        }

        # Iterate each widget type
        for widget_type, create_widget in widgets.items():
            # Test duplicate auto-generated widget key
            create_widget()
            with self.assertRaises(DuplicateWidgetID) as ctx:
                create_widget()
                self.assertIn(
                    _build_duplicate_widget_message(
                        widget_type=widget_type, user_key=None
                    ),
                    ctx.exception,
                )

            # Test duplicate user-specified widget key
            create_widget("key")
            with self.assertRaises(DuplicateWidgetID) as ctx:
                create_widget("key")
                self.assertIn(
                    _build_duplicate_widget_message(
                        widget_type=widget_type, user_key="key"
                    ),
                    ctx.exception,
                )


class DeltaGeneratorClassTest(testutil.DeltaGeneratorTestCase):
    """Test DeltaGenerator Class."""

    def test_constructor(self):
        """Test default DeltaGenerator()."""
        dg = DeltaGenerator()
        self.assertFalse(dg._cursor.is_locked)
        self.assertEqual(dg._cursor.index, 0)

    def test_constructor_with_id(self):
        """Test DeltaGenerator() with an id."""
        cursor = LockedCursor(index=1234)
        dg = DeltaGenerator(cursor=cursor)
        self.assertTrue(dg._cursor.is_locked)
        self.assertEqual(dg._cursor.index, 1234)

    def test_enqueue_new_element_delta_null(self):
        # Test "Null" Delta generators
        dg = DeltaGenerator(container=None)
        enqueue_fn = lambda x: None
        new_dg = dg._enqueue_new_element_delta(enqueue_fn, None)
        self.assertEqual(dg, new_dg)

    @parameterized.expand([(BlockPath.MAIN,), (BlockPath.SIDEBAR,)])
    def test_enqueue_new_element_delta(self, container):
        dg = DeltaGenerator(container=container)
        self.assertEqual(0, dg._cursor.index)
        self.assertEqual(container, dg._container)

        test_data = "some test data"
        # Use FakeDeltaGenerator.fake_text cause if we use
        # DeltaGenerator.text, it calls enqueue_new_element_delta
        # automatically.  Ideally I should unwrap it.
        fake_dg = FakeDeltaGenerator()

        def marshall_element(element):
            fake_dg.fake_text(element, test_data)

        new_dg = dg._enqueue_new_element_delta(marshall_element, None)
        self.assertNotEqual(dg, new_dg)
        self.assertEqual(1, dg._cursor.index)
        self.assertEqual(container, new_dg._container)

        element = self.get_delta_from_queue().new_element
        self.assertEqual(element.text.body, test_data)

    def test_enqueue_new_element_delta_same_id(self):
        cursor = LockedCursor(index=123)
        dg = DeltaGenerator(cursor=cursor)
        self.assertEqual(123, dg._cursor.index)

        test_data = "some test data"
        # Use FakeDeltaGenerator.fake_text cause if we use
        # DeltaGenerator.text, it calls enqueue_new_element_delta
        # automatically.  Ideally I should unwrap it.
        fake_dg = FakeDeltaGenerator()

        def marshall_element(element):
            fake_dg.fake_text(element, test_data)

        new_dg = dg._enqueue_new_element_delta(marshall_element, None)
        self.assertEqual(dg._cursor, new_dg._cursor)

        msg = self.get_message_from_queue()
        self.assertEqual(123, msg.metadata.delta_id)
        self.assertEqual(msg.delta.new_element.text.body, test_data)


class DeltaGeneratorWriteTest(testutil.DeltaGeneratorTestCase):
    """Test DeltaGenerator Text, Alert, Json, and Markdown Classes."""

    def test_json_object(self):
        """Test Text.JSON object."""
        json_data = {"key": "value"}

        # Testing python object
        st.json(json_data)

        json_string = json.dumps(json_data)

        element = self.get_delta_from_queue().new_element
        self.assertEqual(json_string, element.json.body)

    def test_json_string(self):
        """Test Text.JSON string."""
        json_string = '{"key": "value"}'

        # Testing JSON string
        st.json(json_string)

        element = self.get_delta_from_queue().new_element
        self.assertEqual(json_string, element.json.body)

    def test_json_unserializable(self):
        """Test Text.JSON with unserializable object."""
        obj = json  # Modules aren't serializable.

        # Testing unserializable object.
        st.json(obj)

        element = self.get_delta_from_queue().new_element
        self.assertEqual("\"<class 'module'>\"", element.json.body)

    def test_markdown(self):
        """Test Markdown element."""
        test_string = "    data         "

        st.markdown(test_string)

        element = self.get_delta_from_queue().new_element
        self.assertEqual("data", element.markdown.body)

        test_string = "    <a#data>data</a>   "
        st.markdown(test_string)
        element = self.get_delta_from_queue().new_element

        assert element.markdown.body.startswith("<a#data>")

    def test_code(self):
        """Test st.code()"""
        code = "print('Hello, %s!' % 'Streamlit')"
        expected_body = "```python\n%s\n```" % code

        st.code(code, language="python")
        element = self.get_delta_from_queue().new_element

        # st.code() creates a MARKDOWN text object that wraps
        # the body inside a codeblock declaration
        self.assertEqual(element.markdown.body, expected_body)

    def test_empty(self):
        """Test Empty."""
        st.empty()

        element = self.get_delta_from_queue().new_element
        self.assertEqual(True, element.empty.unused)


class DeltaGeneratorProgressTest(testutil.DeltaGeneratorTestCase):
    """Test DeltaGenerator Progress."""

    def test_progress_int(self):
        """Test Progress with int values."""
        values = [0, 42, 100]
        for value in values:
            st.progress(value)

            element = self.get_delta_from_queue().new_element
            self.assertEqual(value, element.progress.value)

    def test_progress_float(self):
        """Test Progress with float values."""
        values = [0.0, 0.42, 1.0]
        for value in values:
            st.progress(value)

            element = self.get_delta_from_queue().new_element
            self.assertEqual(int(value * 100), element.progress.value)

    def test_progress_bad_values(self):
        """Test Progress with bad values."""
        values = [-1, 101, -0.01, 1.01]
        for value in values:
            with self.assertRaises(StreamlitAPIException):
                st.progress(value)

        with self.assertRaises(StreamlitAPIException):
            st.progress("some string")


class DeltaGeneratorChartTest(testutil.DeltaGeneratorTestCase):
    """Test DeltaGenerator Charts."""

    def test_line_chart(self):
        """Test dg.line_chart."""
        data = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])

        st.line_chart(data)

        element = self.get_delta_from_queue().new_element.vega_lite_chart
        chart_spec = json.loads(element.spec)
        self.assertEqual(chart_spec["mark"], "line")
        self.assertEqual(element.datasets[0].data.data.cols[2].int64s.data[0], 20)

    def test_line_chart_with_generic_index(self):
        """Test dg.line_chart with a generic index."""
        data = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])
        data.set_index("a", inplace=True)

        st.line_chart(data)

        element = self.get_delta_from_queue().new_element.vega_lite_chart
        chart_spec = json.loads(element.spec)
        self.assertEqual(chart_spec["mark"], "line")
        self.assertEqual(element.datasets[0].data.data.cols[2].int64s.data[0], 30)

    def test_line_chart_add_rows_with_generic_index(self):
        """Test empty dg.line_chart with add_rows funciton and a generic index."""
        data = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])
        data.set_index("a", inplace=True)

        chart = st.line_chart()
        chart.add_rows(data)

        element = self.get_delta_from_queue().new_element.vega_lite_chart
        chart_spec = json.loads(element.spec)
        self.assertEqual(chart_spec["mark"], "line")
        self.assertEqual(element.datasets[0].data.data.cols[2].int64s.data[0], 30)

    def test_area_chart(self):
        """Test dg.area_chart."""
        data = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])

        st.area_chart(data)

        element = self.get_delta_from_queue().new_element.vega_lite_chart
        chart_spec = json.loads(element.spec)
        self.assertEqual(chart_spec["mark"], "area")
        self.assertEqual(element.datasets[0].data.data.cols[2].int64s.data[0], 20)

    def test_bar_chart(self):
        """Test dg.bar_chart."""
        data = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])

        st.bar_chart(data)

        element = self.get_delta_from_queue().new_element.vega_lite_chart
        chart_spec = json.loads(element.spec)

        self.assertEqual(chart_spec["mark"], "bar")
        self.assertEqual(element.datasets[0].data.data.cols[2].int64s.data[0], 20)


class WidgetIdText(testutil.DeltaGeneratorTestCase):
    def test_ids_are_equal_when_proto_is_equal(self):
        text_input1 = TextInput()
        text_input1.label = "Label #1"
        text_input1.default = "Value #1"

        text_input2 = TextInput()
        text_input2.label = "Label #1"
        text_input2.default = "Value #1"

        element1 = Element()
        element1.text_input.CopyFrom(text_input1)

        element2 = Element()
        element2.text_input.CopyFrom(text_input2)

        _set_widget_id("text_input", element1)

        with self.assertRaises(DuplicateWidgetID):
            _set_widget_id("text_input", element2)

    def test_ids_are_diff_when_labels_are_diff(self):
        text_input1 = TextInput()
        text_input1.label = "Label #1"
        text_input1.default = "Value #1"

        text_input2 = TextInput()
        text_input2.label = "Label #2"
        text_input2.default = "Value #1"

        element1 = Element()
        element1.text_input.CopyFrom(text_input1)

        element2 = Element()
        element2.text_input.CopyFrom(text_input2)

        _set_widget_id("text_input", element1)
        _set_widget_id("text_input", element2)

        self.assertNotEqual(element1.text_input.id, element2.text_input.id)

    def test_ids_are_diff_when_types_are_diff(self):
        text_input1 = TextInput()
        text_input1.label = "Label #1"
        text_input1.default = "Value #1"

        text_area2 = TextArea()
        text_area2.label = "Label #1"
        text_area2.default = "Value #1"

        element1 = Element()
        element1.text_input.CopyFrom(text_input1)

        element2 = Element()
        element2.text_area.CopyFrom(text_area2)

        _set_widget_id("text_input", element1)
        _set_widget_id("text_input", element2)

        self.assertNotEqual(element1.text_input.id, element2.text_area.id)

    def test_ids_are_equal_when_keys_are_equal(self):
        text_input1 = TextInput()
        text_input1.label = "Label #1"
        text_input1.default = "Value #1"

        text_input2 = TextInput()
        text_input2.label = "Label #1"
        text_input2.default = "Value #1"

        element1 = Element()
        element1.text_input.CopyFrom(text_input1)

        element2 = Element()
        element2.text_input.CopyFrom(text_input2)

        _set_widget_id("text_input", element1, user_key="some_key")

        with self.assertRaises(DuplicateWidgetID):
            _set_widget_id("text_input", element2, user_key="some_key")

    def test_ids_are_diff_when_keys_are_diff(self):
        text_input1 = TextInput()
        text_input1.label = "Label #1"
        text_input1.default = "Value #1"

        text_input2 = TextInput()
        text_input2.label = "Label #1"
        text_input2.default = "Value #1"

        element1 = Element()
        element1.text_input.CopyFrom(text_input1)

        element2 = Element()
        element2.text_input.CopyFrom(text_input2)

        _set_widget_id("text_input", element1, user_key="some_key1")
        _set_widget_id("text_input", element2, user_key="some_key2")

        self.assertNotEqual(element1.text_input.id, element2.text_input.id)

    def test_ids_are_diff_when_values_are_diff(self):
        text_input1 = TextInput()
        text_input1.label = "Label #1"
        text_input1.default = "Value #1"

        text_input2 = TextInput()
        text_input2.label = "Label #1"
        text_input2.default = "Value #2"

        element1 = Element()
        element1.text_input.CopyFrom(text_input1)

        element2 = Element()
        element2.text_input.CopyFrom(text_input2)

        _set_widget_id("text_input", element1, user_key="some_key1")
        _set_widget_id("text_input", element2, user_key="some_key1")

        self.assertNotEqual(element1.text_input.id, element2.text_input.id)


class DeltaGeneratorImageTest(testutil.DeltaGeneratorTestCase):
    """Test DeltaGenerator Images"""

    def test_image_from_url(self):
        """Tests dg.image with single and multiple image URLs"""

        url = "https://streamlit.io/an_image.png"
        caption = "ahoy!"

        # single URL
        st.image(url, caption=caption, width=200)
        element = self.get_delta_from_queue().new_element
        self.assertEqual(element.imgs.width, 200)
        self.assertEqual(len(element.imgs.imgs), 1)
        self.assertEqual(element.imgs.imgs[0].url, url)
        self.assertEqual(element.imgs.imgs[0].caption, caption)

        # multiple URLs
        st.image([url] * 5, caption=[caption] * 5, width=200)
        element = self.get_delta_from_queue().new_element
        self.assertEqual(len(element.imgs.imgs), 5)
        self.assertEqual(element.imgs.imgs[4].url, url)
        self.assertEqual(element.imgs.imgs[4].caption, caption)

    def test_unequal_images_and_captions_error(self):
        """Tests that the number of images and captions must match, or
        an exception is generated"""

        url = "https://streamlit.io/an_image.png"
        caption = "ahoy!"

        with self.assertRaises(Exception) as ctx:
            st.image([url] * 5, caption=[caption] * 2)
        self.assertTrue("Cannot pair 2 captions with 5 images." in str(ctx.exception))
