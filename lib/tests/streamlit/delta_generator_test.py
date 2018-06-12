"""DeltaGenerator Unittest."""
import json
import unittest

from streamlit.DeltaGenerator import DeltaGenerator, _export_to_io
from streamlit import protobuf


def unwrap(dg, name):
    """Return unwrapped method 'name' from class 'dg'."""
    method = getattr(dg, name)
    return method.func_closure[0].cell_contents


class DeltaGeneratorDecoratorTest(unittest.TestCase):
    """Test Decorators."""

    def test_export_to_io(self):
        """Test DeltaGenerator decorator export_to_io."""
        def method():
            pass

        # undecorated function shouldn't have export_to_io
        self.assertFalse(hasattr(method, '__export_to_io__'))

        # Run decorator
        _export_to_io(method)

        # undecorated function should have export_to_io
        self.assertTrue(hasattr(method, '__export_to_io__'))
        # and it should be True
        self.assertTrue(getattr(method, '__export_to_io__'))


class DeltaGeneratorClassTest(unittest.TestCase):
    """Test DeltaGenerator Class."""

    def setUp(self):
        """Setup."""
        self._mock_queue = 'mock queue'

    def test_constructor(self):
        """Test default DeltaGenerator()."""
        dg = DeltaGenerator(self._mock_queue)

        self.assertEquals(dg._queue, self._mock_queue)
        self.assertTrue(dg._generate_new_ids)
        self.assertEquals(dg._next_id, 0)
        self.assertFalse(hasattr(dg, '_id'))

    def test_constructor_with_id(self):
        """Test DeltaGenerator() with an id."""
        some_id = 1234
        dg = DeltaGenerator(self._mock_queue, id=some_id)

        self.assertFalse(dg._generate_new_ids)
        self.assertEquals(dg._id, some_id)
        self.assertFalse(hasattr(dg, '_next_id'))


class DeltaGeneratorTextTest(unittest.TestCase):
    """Test DeltaGenerator Text Proto Class."""

    def setUp(self):
        """Setup."""
        self._dg = DeltaGenerator(None)

    def test_generic_text(self):
        """Test protobuf.Text generic str(body) stuff."""
        test_data = {
            'title': protobuf.Text.TITLE,
            'text': protobuf.Text.PLAIN,
            'header': protobuf.Text.HEADER,
            'subheader': protobuf.Text.SUB_HEADER,
            'error': protobuf.Text.ERROR,
            'warning': protobuf.Text.WARNING,
            'info': protobuf.Text.INFO,
            'success': protobuf.Text.SUCCESS,
            'link': protobuf.Text.LINK,
        }

        string_data = 'Some string'
        for name, format in test_data.items():
            method = unwrap(self._dg, name)

            delta = protobuf.Delta()
            element = delta.new_element
            method(self._dg, element, string_data)

            self.assertEquals(string_data, getattr(element, 'text').body)
            self.assertEquals(format, getattr(element, 'text').format)

    def test_json_object(self):
        """Test protobuf.Text.JSON object."""
        json_data = {
            'key': 'value',
        }

        method = unwrap(self._dg, 'json')

        # Testing python object
        delta = protobuf.Delta()
        element = delta.new_element
        method(self._dg, element, json_data)

        json_string = json.dumps(json_data)

        self.assertEquals(json_string, element.text.body)
        self.assertEquals(protobuf.Text.JSON, element.text.format)

    def test_json_string(self):
        """Test protobuf.Text.JSON string."""
        json_string = u'{"key": "value"}'

        method = unwrap(self._dg, 'json')

        # Testing JSON string
        delta = protobuf.Delta()
        element = delta.new_element
        method(self._dg, element, json_string)

        self.assertEquals(json_string, element.text.body)
        self.assertEquals(protobuf.Text.JSON, element.text.format)

    def test_markdown(self):
        """Test protobuf.Text.MARKDOWN."""
        test_string = '    data         '

        method = unwrap(self._dg, 'markdown')

        delta = protobuf.Delta()
        element = delta.new_element
        method(self._dg, element, test_string)

        self.assertEquals(u'data', element.text.body)
        self.assertEquals(protobuf.Text.MARKDOWN, element.text.format)

    def test_empty(self):
        """Test protobuf.Empty."""
        method = unwrap(self._dg, 'empty')

        delta = protobuf.Delta()
        element = delta.new_element
        method(self._dg, element)

        self.assertEquals(True, element.empty.unused)


class DeltaGeneratorProgressTest(unittest.TestCase):
    """Test DeltaGenerator Progress."""

    def test_progress(self):
        """Test protobuf.Progress."""
        self._dg = DeltaGenerator(None)

        method = unwrap(self._dg, 'progress')

        delta = protobuf.Delta()
        element = delta.new_element

        some_value = 42
        method(self._dg, element, some_value)

        self.assertEquals(some_value, element.progress.value)
