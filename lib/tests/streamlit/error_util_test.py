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

import contextlib
import io
import unittest
from unittest.mock import patch

from streamlit.error_util import _print_rich_exception, handle_uncaught_app_exception
from tests import testutil


class ErrorUtilTest(unittest.TestCase):
    @patch("streamlit.exception")
    @patch("streamlit.error")
    def test_uncaught_exception_show_details(self, mock_st_error, mock_st_exception):
        """If client.showErrorDetails is true, uncaught app errors print
        to the frontend."""
        with testutil.patch_config_options({"client.showErrorDetails": True}):
            exc = RuntimeError("boom!")
            handle_uncaught_app_exception(exc)

            mock_st_error.assert_not_called()
            mock_st_exception.assert_called_once_with(exc)

    @patch("streamlit.exception")
    @patch("streamlit.error")
    def test_uncaught_exception_no_details(self, mock_st_error, mock_st_exception):
        """If client.showErrorDetails is false, uncaught app errors are logged,
        and a generic error message is printed to the frontend."""
        with testutil.patch_config_options({"client.showErrorDetails": False}):
            exc = RuntimeError("boom!")
            handle_uncaught_app_exception(exc)

            mock_st_error.assert_not_called()
            mock_st_exception.assert_called_once()

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
        with testutil.patch_config_options({"logger.enableRich": True}):
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
        with testutil.patch_config_options({"logger.enableRich": False}):
            with io.StringIO() as buf:
                # Capture stdout logs
                with contextlib.redirect_stdout(buf):
                    handle_uncaught_app_exception(exc)
                # Capture the stdout output
                captured_output = buf.getvalue()

                # With rich deactivated, the exception is not logged to stdout
                assert "Exception:" not in captured_output
                assert "boom!" not in captured_output
