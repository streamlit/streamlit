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

import unittest
from unittest.mock import patch

from streamlit import config
from streamlit.error_util import handle_uncaught_app_exception


class ErrorUtilTest(unittest.TestCase):
    @patch("streamlit.exception")
    @patch("streamlit.error")
    def test_uncaught_exception_show_tracebacks(self, mock_st_error, mock_st_exception):
        """If client.showTracebacks is true, uncaught app errors print
        to the frontend."""
        config.set_option("client.showTracebacks", True)
        exc = RuntimeError("boom!")
        handle_uncaught_app_exception(exc)

        mock_st_error.assert_not_called()
        mock_st_exception.assert_called_once_with(exc)

    @patch("streamlit.exception")
    @patch("streamlit.error")
    def test_uncaught_exception_no_tracebacks(self, mock_st_error, mock_st_exception):
        """If client.showTracebacks is false, uncaught app errors are logged,
        and a generic error message is printed to the frontend."""
        config.set_option("client.showTracebacks", False)
        exc = RuntimeError("boom!")
        handle_uncaught_app_exception(exc)

        mock_st_exception.assert_not_called()
        mock_st_error.assert_called_once_with(
            "Whoops - something went wrong! An error has been logged."
        )
