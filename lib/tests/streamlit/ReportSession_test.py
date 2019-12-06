# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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

import sys
import copy
import unittest
from mock import MagicMock, patch

from streamlit import config
from streamlit.ReportSession import ReportSession
from streamlit.ScriptRunner import ScriptRunner


class ReportSessionTest(unittest.TestCase):
    @patch("streamlit.ReportSession.Report")
    @patch("streamlit.ReportSession.LocalSourcesWatcher")
    def test_enqueue_without_tracer(self, patched_Report, patched_Watcher):
        """Make sure we try to handle execution control requests.
        """
        orig_option = config.get_option("runner.installTracer")
        orig_tracer = sys.gettrace()

        config.set_option("runner.installTracer", False)

        rs = ReportSession(None, "", "")
        mock_script_runner = MagicMock()
        mock_script_runner._install_tracer = ScriptRunner._install_tracer
        rs._scriptrunner = mock_script_runner

        rs.enqueue({"dontcare": 123})

        func = mock_script_runner.maybe_handle_execution_control_request
        func.assert_called_once()

        # Clean up.
        sys.settrace(orig_tracer)
        config.set_option("runner.installTracer", orig_option)

    @patch("streamlit.ReportSession.Report")
    @patch("streamlit.ReportSession.LocalSourcesWatcher")
    def test_enqueue_with_tracer(self, patched_Report, patched_Watcher):
        """Make sure there is no lock contention when tracer is on.
        """
        orig_option = config.get_option("runner.installTracer")
        orig_tracer = sys.gettrace()

        config.set_option("runner.installTracer", True)

        rs = ReportSession(None, "", "")
        mock_script_runner = MagicMock()
        rs._scriptrunner = mock_script_runner

        # ScriptRunner._install_tracer(rs._scriptrunner)
        rs.enqueue({"dontcare": 123})

        func = mock_script_runner.maybe_handle_execution_control_request
        func.assert_called_once()

        # Clean up.
        sys.settrace(orig_tracer)
        config.set_option("runner.installTracer", orig_option)
