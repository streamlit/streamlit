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

import unittest

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
