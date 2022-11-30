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
from unittest.mock import Mock, patch

from streamlit.deprecation_util import deprecate_func_name, deprecate_obj_name


class DeprecationUtilTest(unittest.TestCase):
    @patch("streamlit.warning")
    def test_deprecate_func_name(self, mock_warning: Mock):
        def multiply(a, b):
            return a * b

        beta_multiply = deprecate_func_name(multiply, "beta_multiply", "1980-01-01")

        self.assertEqual(beta_multiply(3, 2), 6)

        expected_warning = (
            "Please replace `st.beta_multiply` with `st.multiply`.\n\n"
            "`st.beta_multiply` will be removed after 1980-01-01."
        )
        mock_warning.assert_called_once_with(expected_warning)

    @patch("streamlit.warning")
    def test_deprecate_obj_name(self, mock_warning: Mock):
        """Test that we override dunder methods."""

        class DictClass(dict):
            pass

        beta_dict = deprecate_obj_name(
            DictClass(), "beta_dict", "my_dict", "1980-01-01"
        )

        beta_dict["foo"] = "bar"
        self.assertEqual(beta_dict["foo"], "bar")
        self.assertEqual(len(beta_dict), 1)
        self.assertEqual(list(beta_dict), ["foo"])

        expected_warning = (
            "Please replace `st.beta_dict` with `st.my_dict`.\n\n"
            "`st.beta_dict` will be removed after 1980-01-01."
        )

        # We only show the warning a single time for a given object.
        mock_warning.assert_called_once_with(expected_warning)
