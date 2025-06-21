# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import contextlib
import io
import unittest
from unittest.mock import patch

from streamlit.error_util import _print_rich_exception, handle_uncaught_app_exception
from tests import testutil


class ErrorUtilTest(unittest.TestCase):
    def test_handle_print_rich_exception(self):
        """Test if the print rich exception method is working fine."""

        with io.StringIO() as buf:
            # Capture stdout logs (rich logs to stdout)
            with contextlib.redirect_stdout(buf):
                _print_rich_exception(Exception("boom!"))
            # Capture the stdout output
            captured_output = buf.getvalue()

            assert "Exception:" in captured_output
            assert "boom!" in captured_output

    def test_handle_uncaught_app_exception_with_rich(self):
        """Test if the exception is logged with rich enabled and disabled."""
        exc = Exception("boom!")
        # The default is to use rich if rich is installed:
        with io.StringIO() as buf:
            # Capture stdout logs (rich logs to stdout)
            with contextlib.redirect_stdout(buf):
                handle_uncaught_app_exception(exc)
            # Capture the stdout output
            captured_output = buf.getvalue()

            assert "Exception:" in captured_output
            assert "boom!" in captured_output
            # Uncaught app exception is only used by the non-rich exception logging
            assert "Uncaught app exception" not in captured_output

        with (
            testutil.patch_config_options({"logger.enableRich": False}),
            io.StringIO() as buf,
        ):
            # Capture stdout logs
            with contextlib.redirect_stdout(buf):
                handle_uncaught_app_exception(exc)
            # Capture the stdout output
            captured_output = buf.getvalue()

            # With rich deactivated, the exception is not logged to stdout
            assert "Exception:" not in captured_output
            assert "boom!" not in captured_output

    def test_handle_uncaught_app_exception_with_rich_doesnt_call_logger(self):
        """Test that if rich is enabled, the logger error is not used."""
        # The default is to use rich if rich is installed (which is the case in the
        # test environment):
        with patch("streamlit.error_util._LOGGER.error") as mock_logger:
            handle_uncaught_app_exception(Exception("boom!"))
            mock_logger.assert_not_called()

        # Test if it is explicitly enabled:
        with (
            testutil.patch_config_options({"logger.enableRich": True}),
            patch("streamlit.error_util._LOGGER.error") as mock_logger,
        ):
            handle_uncaught_app_exception(Exception("boom!"))
            mock_logger.assert_not_called()

        # Test if it is explicitly disabled:
        with (
            testutil.patch_config_options({"logger.enableRich": False}),
            patch("streamlit.error_util._LOGGER.error") as mock_logger,
        ):
            handle_uncaught_app_exception(Exception("boom!"))
            mock_logger.assert_called_once()
