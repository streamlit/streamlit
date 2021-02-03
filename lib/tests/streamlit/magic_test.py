# Copyright 2018-2021 Streamlit Inc.
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

"""Magic unit test."""

import unittest
import ast

import streamlit.magic as magic


class MagicTest(unittest.TestCase):
    """Test for Magic
    The test counts the number of substitutions that magic.add_code do for
    a few code snippets. The test passes if the expected number of
    substitutions have been made.
    """

    def _testCode(self, code, expected_count):
        tree = magic.add_magic(code, "./")
        count = 0
        for node in ast.walk(tree):
            # count the nodes where a substitution has been made, i.e.
            # look for 'calls' to a 'streamlit' function
            if type(node) is ast.Call and "streamlit" in ast.dump(node.func):
                count += 1
        self.assertEqual(
            expected_count,
            count,
            ("There must be exactly {} streamlit nodes, but found {}").format(
                expected_count, count
            ),
        )

    def test_simple_statement(self):
        """Test simple statements"""
        CODE_SIMPLE_STATEMENTS = """
a = 1
b = 10
a
b
"""
        self._testCode(CODE_SIMPLE_STATEMENTS, 2)

    def test_if_statement(self):
        """Test if statements"""
        CODE_IF_STATEMENT = """
a = 1
if True:
    a
    if False:
        a
    elif False:
        a
    else:
        a
else:
    a
"""
        self._testCode(CODE_IF_STATEMENT, 5)

    def test_for_statement(self):
        """Test for statements"""
        CODE_FOR_STATEMENT = """
a = 1
for i in range(10):
    for j in range(2):
        a

"""
        self._testCode(CODE_FOR_STATEMENT, 1)

    def test_try_statement(self):
        """Test try statements"""
        CODE_TRY_STATEMENT = """
try:
    a = 10
    a
except Exception:
    try:
        a
    finally:
        a
finally:
    a
"""
        self._testCode(CODE_TRY_STATEMENT, 4)

    def test_function_call_statement(self):
        """Test with function calls"""
        CODE_FUNCTION_CALL = """
def myfunc(a):
    a
a =10
myfunc(a)
"""
        self._testCode(CODE_FUNCTION_CALL, 1)

    def test_with_statement(self):
        """Test 'with' statements"""
        CODE_WITH_STATEMENT = """
a = 10
with None:
    a
"""
        self._testCode(CODE_WITH_STATEMENT, 1)

    def test_while_statement(self):
        """Test 'while' statements"""
        CODE_WHILE_STATEMENT = """
a = 10
while True:
    a
"""
        self._testCode(CODE_WHILE_STATEMENT, 1)

    def test_yield_statement(self):
        """Test that 'yield' expressions do not get magicked"""
        CODE_YIELD_STATEMENT = """
def yield_func():
    yield
"""
        self._testCode(CODE_YIELD_STATEMENT, 0)

    def test_yield_from_statement(self):
        """Test that 'yield from' expressions do not get magicked"""
        CODE_YIELD_FROM_STATEMENT = """
def yield_func():
    yield from None
"""
        self._testCode(CODE_YIELD_FROM_STATEMENT, 0)

    def test_async_function_statement(self):
        """Test async function definitions"""
        CODE_ASYNC_FUNCTION = """
async def myfunc(a):
    a
"""
        self._testCode(CODE_ASYNC_FUNCTION, 1)

    def test_async_with_statement(self):
        """Test 'async with' statements"""
        CODE_ASYNC_WITH = """
async def myfunc(a):
    async with None:
        a
"""
        self._testCode(CODE_ASYNC_WITH, 1)

    def test_async_for_statement(self):
        """Test 'async for' statements"""
        CODE_ASYNC_FOR = """
async def myfunc(a):
    async for _ in None:
        a
"""
        self._testCode(CODE_ASYNC_FOR, 1)

    def test_docstring_is_ignored(self):
        """Test that docstrings don't print in the app"""
        CODE = """
def myfunc(a):
    '''This is the docstring'''
    return 42
"""
        self._testCode(CODE, 0)
