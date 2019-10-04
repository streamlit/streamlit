# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

"""hello.py unit tests."""

import unittest
import inspect
from streamlit.hello import util
from parameterized import parameterized


def fn_only_docstring():
    """
    """


def fn_no_docstring():
    a = 1
    b = 1
    c = 1


def fn_non_empty_docstring_no_code():
    """
    Hello world.
    """


def fn_non_empty_docstring_with_code():
    """
    First line.
    Second line.
    """
    a = 1


def fn_docstring_oneline():
    """This is a docstring."""


def fn_docstring_oneline_empty():
    """"""
    a = 1


def get_sourcelines(code):
    sourcelines, n_lines = inspect.getsourcelines(code)
    return sourcelines


class HelloUtilTest(unittest.TestCase):
    def test_remove_declaration_and_docstring_empty(self):
        self.assertRaises(Exception, util.remove_declaration_and_docstring, [])

    @parameterized.expand(
        [
            (fn_only_docstring, []),
            (fn_no_docstring, ["a = 1", "b = 1", "c = 1"]),
            (fn_non_empty_docstring_no_code, []),
            (fn_non_empty_docstring_with_code, ["a = 1"]),
            (fn_docstring_oneline, []),
            (fn_docstring_oneline_empty, ["a = 1"]),
        ]
    )
    def test_remove_declaration_and_docstring(self, input, expected):
        lines = get_sourcelines(input)
        without = util.remove_declaration_and_docstring(lines)
        self.assertEqual(expected, [x.strip() for x in without])
