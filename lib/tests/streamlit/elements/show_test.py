from unittest.mock import patch
import unittest

from parameterized import parameterized

import streamlit as st
from streamlit import code_util


class ShowTest(unittest.TestCase):
    """Test helper methods of `show()` in Streamlit.__init__.py."""

    def test_st_show(self):
        """Test st.experimental_show.

        Ideally we could test the order and content of the deltas.
        But not possible to inject a shared queue in `streamlit._with_dg()`

        Improvements:
        - verify markdown is escaped on write delta
        """
        thing = "something"

        with patch("streamlit.write") as write:
            with patch("streamlit.markdown") as markdown:
                st.experimental_show(thing)
                write.assert_called_once()
                markdown.assert_called_once()

        foo_show_bar = "baz"

        with patch("streamlit.write") as write:
            with patch("streamlit.markdown") as markdown:
                st.experimental_show(foo_show_bar)
                write.assert_called_once()
                markdown.assert_called_once()

    @parameterized.expand(
        [
            ("simple", "(a, b, c)", range(0, 3), ["a", "b", "c"]),
            ("complex", "(a, foo(c))", range(0, 2), ["a", "foo(c)"]),
            ("tricky", "get(a, foo(c)) trash", range(0, 2), ["a", "foo(c)"]),
        ]
    )
    def test_get_method_args_from_code(self, name, input, args, expected):
        """Parse method arguments from a string"""
        parsed = code_util.get_method_args_from_code(args, input)

        self.assertEqual(parsed, expected)

    @parameterized.expand([("fails", '(a, ")b", c)', range(0, 3), ["a", '")b"', "c"])])
    def test_failed_get_args_from_code(self, name, input, args, expected):
        """Fail to parse method arguments from a string

        The inclusion of `,` or `)` in a string with multiple args causes error
        """
        with self.assertRaises(AssertionError):
            code_util.get_method_args_from_code(args, input)

    @parameterized.expand(
        [
            ("simple", "(a, b, c)", ["a, b, c"]),
            ("complex", "(a, foo(c))", ["a, foo(c)"]),
            ("tricky", "pickup(a, foo(c)) my(trash)", ["a, foo(c)", "trash"]),
        ]
    )
    def test_extract_args(self, name, input, expected):
        """Parse contents of outer parentheses from a string"""
        parsed = code_util.extract_args(input)

        self.assertEqual(parsed, expected)
