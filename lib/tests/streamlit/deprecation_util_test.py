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

import unittest
from unittest.mock import patch

from streamlit.deprecation_util import function_beta_warning, object_beta_warning


class DeprecationUtilTest(unittest.TestCase):
    @patch("streamlit.warning")
    def test_function_beta_warning(self, mock_warning):
        def multiply(a, b):
            return a * b

        beta_multiply = function_beta_warning(multiply, "1980-01-01")

        self.assertEqual(beta_multiply(3, 2), 6)
        mock_warning.assert_called_once_with(
            "Please replace `st.beta_multiply` with `st.multiply`.\n\n"
            "`st.beta_multiply` will be removed after 1980-01-01."
        )

    @patch("streamlit.warning")
    def test_object_beta_warning(self, mock_warning):
        class Multiplier:
            def multiply(self, a, b):
                return a * b

        beta_multiplier = object_beta_warning(Multiplier(), "multiplier", "1980-01-01")

        expected_warning = (
            "Please replace `st.beta_multiplier` with `st.multiplier`.\n\n"
            "`st.beta_multiplier` will be removed after 1980-01-01."
        )

        self.assertEqual(beta_multiplier.multiply(3, 2), 6)
        self.assertEqual(beta_multiplier.multiply(5, 4), 20)

        # We only show the warning a single time for a given object.
        mock_warning.assert_called_once_with(expected_warning)

    @patch("streamlit.warning")
    def test_object_beta_warning_magic_function(self, mock_warning):
        """Test that we override dunder methods."""

        class DictClass(dict):
            pass

        beta_dict = object_beta_warning(DictClass(), "my_dict", "1980-01-01")

        expected_warning = (
            "Please replace `st.beta_my_dict` with `st.my_dict`.\n\n"
            "`st.beta_my_dict` will be removed after 1980-01-01."
        )

        beta_dict["foo"] = "bar"
        self.assertEqual(beta_dict["foo"], "bar")
        self.assertEqual(len(beta_dict), 1)
        self.assertEqual(list(beta_dict), ["foo"])

        # We only show the warning a single time for a given object.
        mock_warning.assert_called_once_with(expected_warning)
