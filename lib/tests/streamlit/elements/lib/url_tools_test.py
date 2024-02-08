import unittest

from streamlit.elements.lib.url_tools import merge_query_params


class UrlToolsTest(unittest.TestCase):
    def test_none(self):
        actual = merge_query_params("https://streamlit.io", None)
        self.assertEqual(actual, "https://streamlit.io")

    def test_single(self):
        actual = merge_query_params("https://streamlit.io", {"foo": "bar"})
        self.assertEqual(actual, "https://streamlit.io/?foo=bar")

    def test_multiple(self):
        actual = merge_query_params("https://streamlit.io", {"foo": ("bar", "baz")})
        self.assertEqual(actual, "https://streamlit.io/?foo=bar&foo=baz")

    def test_merge(self):
        actual = merge_query_params("https://streamlit.io/?foo=bar", {"foo": "baz"})
        self.assertEqual(actual, "https://streamlit.io/?foo=bar&foo=baz")

    def test_page_name(self):
        actual = merge_query_params("foobar", {"foo": "bar"})
        self.assertEqual(actual, "foobar?foo=bar")
