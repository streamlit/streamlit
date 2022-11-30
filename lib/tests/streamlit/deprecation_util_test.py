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

from parameterized import parameterized

from streamlit.deprecation_util import (
    PrereleaseAPIType,
    deprecate_object_with_console_warning,
    function_prerelease_graduation_warning,
    object_prerelease_graduation_warning,
)


class DeprecationUtilTest(unittest.TestCase):
    @parameterized.expand(
        [
            (
                PrereleaseAPIType.BETA,
                "Please replace `st.beta_multiply` with `st.multiply`.\n\n"
                "`st.beta_multiply` will be removed after 1980-01-01.",
            ),
            (
                PrereleaseAPIType.EXPERIMENTAL,
                "Please replace `st.experimental_multiply` with `st.multiply`.\n\n"
                "`st.experimental_multiply` will be removed after 1980-01-01.",
            ),
        ]
    )
    @patch("streamlit.warning")
    def test_function_prerelease_graduation_warning(
        self, api_type: PrereleaseAPIType, warning_msg: str, mock_warning: Mock
    ):
        def multiply(a, b):
            return a * b

        prerelease_multiply = function_prerelease_graduation_warning(
            api_type, multiply, "1980-01-01"
        )

        self.assertEqual(prerelease_multiply(3, 2), 6)
        mock_warning.assert_called_once_with(warning_msg)

    @parameterized.expand(
        [
            (
                PrereleaseAPIType.BETA,
                "Please replace `st.beta_multiplier` with `st.multiplier`.\n\n"
                "`st.beta_multiplier` will be removed after 1980-01-01.",
            ),
            (
                PrereleaseAPIType.EXPERIMENTAL,
                "Please replace `st.experimental_multiplier` with `st.multiplier`.\n\n"
                "`st.experimental_multiplier` will be removed after 1980-01-01.",
            ),
        ]
    )
    @patch("streamlit.warning")
    def test_object_beta_warning(
        self, api_type: PrereleaseAPIType, warning_msg: str, mock_warning: Mock
    ):
        class Multiplier:
            def multiply(self, a, b):
                return a * b

        prerelease_multiplier = object_prerelease_graduation_warning(
            api_type, Multiplier(), "multiplier", "1980-01-01"
        )

        self.assertEqual(prerelease_multiplier.multiply(3, 2), 6)
        self.assertEqual(prerelease_multiplier.multiply(5, 4), 20)

        # We only show the warning a single time for a given object.
        mock_warning.assert_called_once_with(warning_msg)

    @parameterized.expand(
        [
            (
                PrereleaseAPIType.BETA,
                "Please replace `st.beta_my_dict` with `st.my_dict`.\n\n"
                "`st.beta_my_dict` will be removed after 1980-01-01.",
            ),
            (
                PrereleaseAPIType.EXPERIMENTAL,
                "Please replace `st.experimental_my_dict` with `st.my_dict`.\n\n"
                "`st.experimental_my_dict` will be removed after 1980-01-01.",
            ),
        ]
    )
    @patch("streamlit.warning")
    def test_object_beta_warning_magic_function(
        self, api_type: PrereleaseAPIType, warning_msg: str, mock_warning: Mock
    ):
        """Test that we override dunder methods."""

        class DictClass(dict):
            pass

        beta_dict = object_prerelease_graduation_warning(
            api_type, DictClass(), "my_dict", "1980-01-01"
        )

        beta_dict["foo"] = "bar"
        self.assertEqual(beta_dict["foo"], "bar")
        self.assertEqual(len(beta_dict), 1)
        self.assertEqual(list(beta_dict), ["foo"])

        # We only show the warning a single time for a given object.
        mock_warning.assert_called_once_with(warning_msg)

    @patch("builtins.print")
    def test_deprecate_object_with_console_warning(self, mock_print: Mock):
        """`deprecate_object_with_console_warning` should print the given
        warning text to the console.
        """

        class Multiplier:
            def multiply(self, a, b):
                return a * b

        warning_text = "Here be dragons!"
        deprecated_multiplier = deprecate_object_with_console_warning(
            Multiplier(), warning_text
        )
        self.assertEqual(deprecated_multiplier.multiply(3, 2), 6)
        self.assertEqual(deprecated_multiplier.multiply(5, 4), 20)

        # We only show the warning a single time for a given object.
        mock_print.assert_called_once_with(warning_text)
