# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import os
from unittest import mock

import streamlit as st
from tests.delta_generator_test_case import DeltaGeneratorTestCase


def patch_varname_getter():
    """
    Patches streamlit.elements.doc_string so _get_variable_name()
    works outside ScriptRunner.
    """
    import inspect

    parent_frame_filename = inspect.getouterframes(inspect.currentframe())[2].filename

    return mock.patch(
        "streamlit.elements.doc_string.SCRIPTRUNNER_FILENAME", parent_frame_filename
    )


class ConditionalHello:
    def __init__(self, available, ExceptionType=AttributeError):
        self.available = available
        self.ExceptionType = ExceptionType

    def __getattribute__(self, name):
        if name == "say_hello" and not self.available:
            raise self.ExceptionType(f"{name} is not accessible when x is even")
        else:
            return object.__getattribute__(self, name)

    def say_hello(self):
        pass


class StHelpAPITest(DeltaGeneratorTestCase):
    """Test Public Streamlit Public APIs."""

    def test_st_help(self):
        """Test st.help."""
        with patch_varname_getter():
            st.help(os.chdir)

        el = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("os.chdir", el.name)
        self.assertEqual("builtin_function_or_method", el.type)
        self.assertTrue(
            el.doc_string.startswith("Change the current working directory")
        )
        self.assertIn(el.value, ["posix.chdir(path)", "nt.chdir(path)"])

    def test_st_help_with_available_conditional_members(self):
        """Test st.help with conditional members available"""

        st.help(ConditionalHello(True))
        el = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("ConditionalHello", el.type)
        member_names = [member.name for member in el.members]
        self.assertIn("say_hello", member_names)

    def test_st_help_with_unavailable_conditional_members(self):
        """Test st.help with conditional members not available
        via AttributeError"""

        st.help(ConditionalHello(False))
        el = self.get_delta_from_queue().new_element.doc_string
        self.assertEqual("ConditionalHello", el.type)
        member_names = [member.name for member in el.members]
        self.assertNotIn("say_hello", member_names)

    def test_st_help_with_erroneous_members(self):
        """Test st.help with conditional members not available
        via some non-AttributeError exception"""

        with self.assertRaises(ValueError):
            st.help(ConditionalHello(False, ValueError))
