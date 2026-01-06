# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

from parameterized import parameterized

from streamlit.deprecation_util import (
    deprecate_func_name,
    deprecate_obj_name,
    show_deprecation_warning,
)
from tests.testutil import patch_config_options


class DeprecationUtilTest(unittest.TestCase):
    @patch("streamlit.deprecation_util._LOGGER")
    @patch("streamlit.warning")
    def test_show_deprecation_warning(self, mock_warning: Mock, mock_logger: Mock):
        """show_deprecation_warning logs warnings always, and prints to the browser only
        if config.client.showErrorDetails is True.
        """
        message = (
            "We regret the bother, but it's been fated:\n"
            "the function you called is DEPRECATED."
        )

        # config.client.showErrorDetails=True: log AND show in browser
        with patch_config_options({"client.showErrorDetails": True}):
            show_deprecation_warning(message)
            mock_logger.warning.assert_called_once_with(message)
            mock_warning.assert_called_once_with(message)

        mock_logger.reset_mock()
        mock_warning.reset_mock()

        # config.client.showErrorDetails=False: log, but DON'T show in browser
        with patch_config_options({"client.showErrorDetails": False}):
            show_deprecation_warning(message)
            mock_logger.warning.assert_called_once_with(message)
            mock_warning.assert_not_called()

    @parameterized.expand(
        [
            ("full",),
            (True,),
            ("true",),
            ("True",),
        ]
    )
    @patch("streamlit.deprecation_util._LOGGER")
    @patch("streamlit.warning")
    def test_show_deprecation_warning_with_full_details(
        self,
        show_error_details_value: str | bool,
        mock_warning: Mock,
        mock_logger: Mock,
    ):
        """Test that deprecation warnings are shown in browser when showErrorDetails
        is set to "full" or legacy True variations.
        """
        message = "This feature is deprecated."

        with patch_config_options(
            {"client.showErrorDetails": show_error_details_value}
        ):
            show_deprecation_warning(message)
            mock_logger.warning.assert_called_once_with(message)
            mock_warning.assert_called_once_with(message)

    @parameterized.expand(
        [
            ("stacktrace",),
            ("type",),
            ("none",),
            (False,),
            ("false",),
            ("False",),
        ]
    )
    @patch("streamlit.deprecation_util._LOGGER")
    @patch("streamlit.warning")
    def test_show_deprecation_warning_with_reduced_details(
        self,
        show_error_details_value: str | bool,
        mock_warning: Mock,
        mock_logger: Mock,
    ):
        """Test that deprecation warnings are NOT shown in browser when showErrorDetails
        is set to "stacktrace", "type", "none", or legacy False variations.
        """
        message = "This feature is deprecated."

        with patch_config_options(
            {"client.showErrorDetails": show_error_details_value}
        ):
            show_deprecation_warning(message)
            mock_logger.warning.assert_called_once_with(message)
            mock_warning.assert_not_called()

    @patch("streamlit.deprecation_util._LOGGER")
    @patch("streamlit.warning")
    def test_show_deprecation_warning_respects_show_in_browser_parameter(
        self, mock_warning: Mock, mock_logger: Mock
    ):
        """Test that show_in_browser=False always prevents browser warnings,
        regardless of config setting.
        """
        message = "This feature is deprecated."

        # Even with "full" setting, show_in_browser=False should suppress browser warning
        with patch_config_options({"client.showErrorDetails": "full"}):
            show_deprecation_warning(message, show_in_browser=False)
            mock_logger.warning.assert_called_once_with(message)
            mock_warning.assert_not_called()

    @patch("streamlit.deprecation_util.show_deprecation_warning")
    def test_deprecate_func_name(self, mock_show_warning: Mock):
        def multiply(a, b):
            return a * b

        beta_multiply = deprecate_func_name(multiply, "beta_multiply", "1980-01-01")

        assert beta_multiply(3, 2) == 6

        expected_warning = (
            "Please replace `st.beta_multiply` with `st.multiply`.\n\n"
            "`st.beta_multiply` will be removed after 1980-01-01."
        )
        mock_show_warning.assert_called_once_with(expected_warning)

    @patch("streamlit.deprecation_util.show_deprecation_warning")
    def test_deprecate_func_name_with_override(self, mock_show_warning: Mock):
        def multiply(a, b):
            return a * b

        beta_multiply = deprecate_func_name(
            multiply, "beta_multiply", "1980-01-01", name_override="mul"
        )

        assert beta_multiply(3, 2) == 6

        expected_warning = (
            "Please replace `st.beta_multiply` with `st.mul`.\n\n"
            "`st.beta_multiply` will be removed after 1980-01-01."
        )
        mock_show_warning.assert_called_once_with(expected_warning)

    @patch("streamlit.deprecation_util.show_deprecation_warning")
    def test_deprecate_obj_name(self, mock_show_warning: Mock):
        """Test that we override dunder methods."""

        class DictClass(dict):
            pass

        beta_dict = deprecate_obj_name(
            DictClass(), "beta_dict", "my_dict", "1980-01-01"
        )

        beta_dict["foo"] = "bar"
        assert beta_dict["foo"] == "bar"
        assert len(beta_dict) == 1
        assert list(beta_dict) == ["foo"]

        expected_warning = (
            "Please replace `st.beta_dict` with `st.my_dict`.\n\n"
            "`st.beta_dict` will be removed after 1980-01-01."
        )

        # We only show the warning a single time for a given object.
        mock_show_warning.assert_called_once_with(expected_warning)

    @patch("streamlit.deprecation_util.show_deprecation_warning")
    def test_deprecate_obj_name_no_st_prefix(self, mock_show_warning: Mock):
        class DictClass(dict):
            pass

        beta_dict = deprecate_obj_name(
            DictClass(),
            "beta_dict",
            "my_dict",
            "1980-01-01",
            include_st_prefix=False,
        )

        beta_dict["foo"] = "bar"
        assert beta_dict["foo"] == "bar"
        assert len(beta_dict) == 1
        assert list(beta_dict) == ["foo"]

        expected_warning = (
            "Please replace `beta_dict` with `my_dict`.\n\n"
            "`beta_dict` will be removed after 1980-01-01."
        )

        # We only show the warning a single time for a given object.
        mock_show_warning.assert_called_once_with(expected_warning)
