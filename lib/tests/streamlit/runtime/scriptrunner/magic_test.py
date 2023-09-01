# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Magic unit test."""

import ast
import unittest

import streamlit.runtime.scriptrunner.magic as magic
from tests.testutil import patch_config_options


class MagicTest(unittest.TestCase):
    """Test for Magic
    The test counts the number of substitutions that magic.add_code do for
    a few code snippets. The test passes if the expected number of
    substitutions have been made.
    """

    def _testCode(self, code: str, expected_count: int) -> None:
        tree = magic.add_magic(code, "./")
        count = 0
        for node in ast.walk(tree):
            # count the nodes where a substitution has been made, i.e.
            # look for 'calls' to a '__streamlitmagic__' function
            if type(node) is ast.Call and magic.MAGIC_MODULE_NAME in ast.dump(
                node.func
            ):
                count += 1
        self.assertEqual(
            expected_count,
            count,
            f"There must be exactly {expected_count} {magic.MAGIC_MODULE_NAME} nodes, but found {count}",
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

    def test_await_expression(self):
        """Test that 'await' expressions do not get magicked"""
        CODE_AWAIT_EXPRESSION = """
async def await_func(a):
    await coro()
"""
        self._testCode(CODE_AWAIT_EXPRESSION, 0)

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

    def test_docstring_is_ignored_func(self):
        """Test that docstrings don't print in the app"""
        CODE = """
def myfunc(a):
    '''This is the docstring'''
    return 42
"""
        self._testCode(CODE, 0)

    def test_docstring_is_ignored_async_func(self):
        """Test that async function docstrings don't print in the app by default"""
        CODE = """
async def myfunc(a):
    '''This is the docstring for async func'''
    return 43
"""
        self._testCode(CODE, 0)

    def test_display_root_docstring_config_option(self):
        """Test that magic.displayRootDocString skips/includes docstrings when True/False."""

        CODE = """
'''This is a top-level docstring'''

'this is a string that should always be magicked'

def my_func():
    '''This is a function docstring'''

    'this is a string that should always be magicked'

class MyClass:
    '''This is a class docstring'''

    'this is a string that should never be magicked'

    def __init__(self):
        '''This is a method docstring'''

        'this is a string that should always be magicked'
"""

        self._testCode(CODE, 3)

        with patch_config_options({"magic.displayRootDocString": True}):
            self._testCode(CODE, 4)

        with patch_config_options({"magic.displayRootDocString": False}):
            self._testCode(CODE, 3)

    def test_display_last_expr_config_option(self):
        """Test that magic.displayLastExprIfNoSemicolon causes the last function ast.Expr
        node in a file to be wrapped in st.write()."""

        CODE_WITHOUT_SEMICOLON = """
this_should_not_be_magicked()

def my_func():
    this_should_not_be_magicked()

class MyClass:
    this_should_not_be_magicked()

    def __init__(self):
        this_should_not_be_magicked()

this_is_the_last_expr()

# Some newlines for good measure


"""

        self._testCode(CODE_WITHOUT_SEMICOLON, 0)

        with patch_config_options({"magic.displayLastExprIfNoSemicolon": True}):
            self._testCode(CODE_WITHOUT_SEMICOLON, 1)

        with patch_config_options({"magic.displayLastExprIfNoSemicolon": False}):
            self._testCode(CODE_WITHOUT_SEMICOLON, 0)

        CODE_WITH_SEMICOLON = """
this_should_not_be_magicked()

def my_func():
    this_should_not_be_magicked()

class MyClass:
    this_should_not_be_magicked()

    def __init__(self):
        this_should_not_be_magicked()

this_is_the_last_expr();

# Some newlines for good measure


"""

        self._testCode(CODE_WITH_SEMICOLON, 0)

        with patch_config_options({"magic.displayLastExprIfNoSemicolon": True}):
            self._testCode(CODE_WITH_SEMICOLON, 0)

        with patch_config_options({"magic.displayLastExprIfNoSemicolon": False}):
            self._testCode(CODE_WITH_SEMICOLON, 0)
