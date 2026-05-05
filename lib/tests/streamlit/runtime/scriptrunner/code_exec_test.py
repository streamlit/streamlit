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

import unittest
from unittest.mock import MagicMock, patch

from parameterized import parameterized

from streamlit.runtime.forward_msg_queue import ForwardMsgQueue
from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner.exec_code import exec_func_with_error_handling
from streamlit.runtime.scriptrunner_utils.exceptions import (
    RerunException,
    StopException,
)
from streamlit.runtime.scriptrunner_utils.script_requests import RerunData
from streamlit.runtime.scriptrunner_utils.script_run_context import ScriptRunContext
from streamlit.runtime.state import SafeSessionState, SessionState


class TestWrapInTryAndExec(unittest.TestCase):
    def setUp(self) -> None:
        self.ctx = ScriptRunContext(
            session_id="test session id",
            _enqueue=ForwardMsgQueue().enqueue,
            query_string="",
            session_state=SafeSessionState(SessionState(), lambda: None),
            uploaded_file_mgr=MemoryUploadedFileManager(""),
            main_script_path="",
            user_info={"email": "something@else.com"},
            fragment_storage=MemoryFragmentStorage(),
            pages_manager=PagesManager(""),
        )
        return super().setUp()

    def test_func_succeeds(self):
        def test_func():
            """Test function that does nothing and, thus, succeeds."""
            return 42

        (
            result,
            run_without_errors,
            rerun_exception_data,
            premature_stop,
            uncaught_exception,
        ) = exec_func_with_error_handling(test_func, self.ctx)

        assert result == 42
        assert run_without_errors is True
        assert rerun_exception_data is None
        assert premature_stop is False
        assert uncaught_exception is None

    def test_func_throws_rerun_exception(self):
        rerun_data = RerunData(query_string="foo")

        def test_func():
            """Test function that raises a RerunException."""
            raise RerunException(rerun_data)

        (
            _,
            run_without_errors,
            rerun_exception_data,
            premature_stop,
            uncaught_exception,
        ) = exec_func_with_error_handling(test_func, self.ctx)

        assert run_without_errors is True
        assert rerun_exception_data == rerun_data
        assert premature_stop is False
        assert uncaught_exception is None

    def test_func_throws_stop_exception(self):
        def test_func():
            """Test function that raises a StopException."""
            raise StopException()

        (
            _,
            run_without_errors,
            rerun_exception_data,
            premature_stop,
            uncaught_exception,
        ) = exec_func_with_error_handling(test_func, self.ctx)

        assert run_without_errors is True
        assert rerun_exception_data is None
        assert premature_stop is True
        assert uncaught_exception is None

    @parameterized.expand([(ValueError), (TypeError), (RuntimeError), (Exception)])
    def test_func_throws_generic_exception(self, exception_type: type):
        def test_func():
            """Test function that raises a generic Exception."""
            raise exception_type()

        (
            _,
            run_without_errors,
            rerun_exception_data,
            premature_stop,
            uncaught_exception,
        ) = exec_func_with_error_handling(test_func, self.ctx)

        assert run_without_errors is False
        assert rerun_exception_data is None
        assert premature_stop is True
        assert isinstance(uncaught_exception, exception_type)


class TestOnScriptErrorHandler(unittest.TestCase):
    """Tests for the on_script_error handler functionality."""

    def setUp(self) -> None:
        self.ctx = ScriptRunContext(
            session_id="test session id",
            _enqueue=ForwardMsgQueue().enqueue,
            query_string="",
            session_state=SafeSessionState(SessionState(), lambda: None),
            uploaded_file_mgr=MemoryUploadedFileManager(""),
            main_script_path="",
            user_info={"email": "test@example.com"},
            fragment_storage=MemoryFragmentStorage(),
            pages_manager=PagesManager(""),
        )
        return super().setUp()

    @patch("streamlit.error_util.show_uncaught_app_exception")
    @patch("streamlit.error_util._log_uncaught_app_exception")
    def test_handler_called_with_exception(
        self, mock_log: MagicMock, mock_show: MagicMock
    ):
        """Test that the on_script_error handler is called with the exception."""
        handler = MagicMock(return_value=None)
        self.ctx.on_script_error = handler
        test_exception = ValueError("test error")

        def test_func():
            raise test_exception

        exec_func_with_error_handling(test_func, self.ctx)

        handler.assert_called_once_with(test_exception)
        mock_log.assert_called_once_with(test_exception)
        mock_show.assert_called_once_with(test_exception)

    @patch("streamlit.error_util.show_uncaught_app_exception")
    @patch("streamlit.error_util._log_uncaught_app_exception")
    def test_handler_returns_true_suppresses_ui_display(
        self, mock_log: MagicMock, mock_show: MagicMock
    ):
        """Test that returning True from handler suppresses the default UI display."""
        handler = MagicMock(return_value=True)
        self.ctx.on_script_error = handler

        def test_func():
            raise ValueError("test error")

        exec_func_with_error_handling(test_func, self.ctx)

        handler.assert_called_once()
        mock_log.assert_called_once()
        mock_show.assert_not_called()

    @parameterized.expand(
        [(False,), (None,)], name_func=lambda f, n, p: f"{f.__name__}_{p.args[0]}"
    )
    @patch("streamlit.error_util.show_uncaught_app_exception")
    @patch("streamlit.error_util._log_uncaught_app_exception")
    def test_handler_returns_non_true_shows_ui_display(
        self, return_value: bool | None, mock_log: MagicMock, mock_show: MagicMock
    ):
        """Test that returning False or None from handler shows the default UI display."""
        handler = MagicMock(return_value=return_value)
        self.ctx.on_script_error = handler
        test_exception = ValueError("test error")

        def test_func():
            raise test_exception

        exec_func_with_error_handling(test_func, self.ctx)

        handler.assert_called_once()
        mock_show.assert_called_once_with(test_exception)

    @patch("streamlit.error_util._LOGGER")
    @patch("streamlit.error_util.show_uncaught_app_exception")
    @patch("streamlit.error_util._log_uncaught_app_exception")
    def test_handler_exception_logged_and_ui_shown(
        self, mock_log: MagicMock, mock_show: MagicMock, mock_logger: MagicMock
    ):
        """Test that handler exceptions are logged and default UI is shown."""

        def raising_handler(exc: Exception) -> bool | None:
            raise RuntimeError("handler error")

        self.ctx.on_script_error = raising_handler
        test_exception = ValueError("original error")

        def test_func():
            raise test_exception

        exec_func_with_error_handling(test_func, self.ctx)

        mock_logger.exception.assert_called_once_with(
            "on_script_error handler raised an exception"
        )
        mock_show.assert_called_once_with(test_exception)

    @patch("streamlit.error_util.show_uncaught_app_exception")
    @patch("streamlit.error_util._log_uncaught_app_exception")
    def test_no_handler_shows_ui_display(
        self, mock_log: MagicMock, mock_show: MagicMock
    ):
        """Test that with no handler, the default UI display is shown."""
        self.ctx.on_script_error = None
        test_exception = ValueError("test error")

        def test_func():
            raise test_exception

        exec_func_with_error_handling(test_func, self.ctx)

        mock_log.assert_called_once_with(test_exception)
        mock_show.assert_called_once_with(test_exception)

    @patch("streamlit.error_util.show_uncaught_app_exception")
    @patch("streamlit.error_util._log_uncaught_app_exception")
    def test_handler_not_called_for_stop_exception(
        self, mock_log: MagicMock, mock_show: MagicMock
    ):
        """Test that the handler is NOT called for StopException (control flow)."""
        handler = MagicMock()
        self.ctx.on_script_error = handler

        def test_func():
            raise StopException()

        exec_func_with_error_handling(test_func, self.ctx)

        handler.assert_not_called()
        mock_log.assert_not_called()
        mock_show.assert_not_called()

    @patch("streamlit.error_util.show_uncaught_app_exception")
    @patch("streamlit.error_util._log_uncaught_app_exception")
    def test_handler_not_called_for_rerun_exception(
        self, mock_log: MagicMock, mock_show: MagicMock
    ):
        """Test that the handler is NOT called for RerunException (control flow)."""
        handler = MagicMock()
        self.ctx.on_script_error = handler

        def test_func():
            raise RerunException(RerunData())

        exec_func_with_error_handling(test_func, self.ctx)

        handler.assert_not_called()
        mock_log.assert_not_called()
        mock_show.assert_not_called()

    @patch("streamlit.error_util._LOGGER")
    @patch("streamlit.error_util.show_uncaught_app_exception")
    @patch("streamlit.error_util._log_uncaught_app_exception")
    def test_handler_raising_stop_exception_is_logged(
        self, mock_log: MagicMock, mock_show: MagicMock, mock_logger: MagicMock
    ):
        """Test that StopException from handler is logged and default UI is shown."""

        def handler_that_stops(exc: Exception) -> bool | None:
            raise StopException()

        self.ctx.on_script_error = handler_that_stops
        test_exception = ValueError("original error")

        def test_func():
            raise test_exception

        exec_func_with_error_handling(test_func, self.ctx)

        # Control-flow exceptions use warning-level logging with exc_info for debugging
        mock_logger.warning.assert_called_once_with(
            "on_script_error handler raised a control-flow exception "
            "(st.stop/st.rerun); falling back to default error UI",
            exc_info=True,
        )
        # The original exception should still be shown in the UI
        mock_show.assert_called_once_with(test_exception)

    @patch("streamlit.error_util._LOGGER")
    @patch("streamlit.error_util.show_uncaught_app_exception")
    @patch("streamlit.error_util._log_uncaught_app_exception")
    def test_handler_raising_rerun_exception_is_logged(
        self, mock_log: MagicMock, mock_show: MagicMock, mock_logger: MagicMock
    ):
        """Test that RerunException from handler is logged and default UI is shown."""

        def handler_that_reruns(exc: Exception) -> bool | None:
            raise RerunException(RerunData())

        self.ctx.on_script_error = handler_that_reruns
        test_exception = ValueError("original error")

        def test_func():
            raise test_exception

        exec_func_with_error_handling(test_func, self.ctx)

        # Control-flow exceptions use warning-level logging with exc_info for debugging
        mock_logger.warning.assert_called_once_with(
            "on_script_error handler raised a control-flow exception "
            "(st.stop/st.rerun); falling back to default error UI",
            exc_info=True,
        )
        # The original exception should still be shown in the UI
        mock_show.assert_called_once_with(test_exception)
