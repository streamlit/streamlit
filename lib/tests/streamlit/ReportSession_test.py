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
    @patch("streamlit.ReportSession.config")
    @patch("streamlit.ReportSession.Report")
    @patch("streamlit.ReportSession.LocalSourcesWatcher")
    def test_enqueue_without_tracer(self, _1, _2, patched_config):
        """Make sure we try to handle execution control requests.
        """
        def get_option(name):
            if name == "server.runOnSave":
                # Just to avoid starting the watcher for no reason.
                return False
            if name == "client.displayEnabled":
                return True
            if name == "runner.installTracer":
                return False
            raise RuntimeError("Unexpected argument to get_option: %s" % name)

        patched_config.get_option.side_effect = get_option

        rs = ReportSession(None, "", "")
        mock_script_runner = MagicMock()
        mock_script_runner._install_tracer = ScriptRunner._install_tracer
        rs._scriptrunner = mock_script_runner

        rs.enqueue({"dontcare": 123})

        func = mock_script_runner.maybe_handle_execution_control_request

        # Expect func to be called only once, inside enqueue().
        func.assert_called_once()

    @patch("streamlit.ReportSession.config")
    @patch("streamlit.ReportSession.Report")
    @patch("streamlit.ReportSession.LocalSourcesWatcher")
    def test_enqueue_with_tracer(self, _1, _2, patched_config):
        """Make sure there is no lock contention when tracer is on.

        When the tracer is set up, we want
        maybe_handle_execution_control_request to be executed only once. There
        was a bug in the past where it was called twice: once from the tracer
        and once from the enqueue function. This caused a lock contention.
        """
        def get_option(name):
            if name == "server.runOnSave":
                # Just to avoid starting the watcher for no reason.
                return False
            if name == "client.displayEnabled":
                return True
            if name == "runner.installTracer":
                return True
            raise RuntimeError("Unexpected argument to get_option: %s" % name)

        patched_config.get_option.side_effect = get_option

        rs = ReportSession(None, "", "")
        mock_script_runner = MagicMock()
        rs._scriptrunner = mock_script_runner

        rs.enqueue({"dontcare": 123})

        func = mock_script_runner.maybe_handle_execution_control_request

        # In reality, outside of a testing environment func should be called
        # once. But in this test we're actually not installing a tracer here,
        # since Report is mocked. So the correct behavior here if to func to
        # never be called. If you ever see if being called once here it's
        # likely because there's a bug in the enqueue function, which should
        # skip func when installTracer is on.
        func.assert_not_called()
