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

import os
from unittest import mock

import streamlit as st
from tests.delta_generator_test_case import DeltaGeneratorTestCase


def patch_varname_getter():
    """Patches streamlit.elements.doc_string so _get_variable_name() works outside ScriptRunner."""
    import inspect

    parent_frame_filename = inspect.getouterframes(inspect.currentframe())[2].filename

    return mock.patch(
        "streamlit.elements.doc_string.SCRIPTRUNNER_FILENAME", parent_frame_filename
    )


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
        self.assertEqual(f"posix.chdir(path)", el.value)
