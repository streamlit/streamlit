# Copyright 2018-2020 Streamlit Inc.
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

"""Utility functions to use in our tests."""
import functools
import sys
import threading
import unittest

from streamlit import config
from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.ReportQueue import ReportQueue
from streamlit.ReportThread import REPORT_CONTEXT_ATTR_NAME
from streamlit.ReportThread import ReportContext
from streamlit.ReportThread import add_report_ctx
from streamlit.ReportThread import get_report_ctx
from streamlit.ReportThread import _WidgetIDSet
from streamlit.widgets import Widgets
from streamlit.proto.BlockPath_pb2 import BlockPath
from streamlit.UploadedFileManager import UploadedFileManager


def build_mock_config_get_option(overrides_dict):
    orig_get_option = config.get_option

    def mock_config_get_option(name):
        if name in overrides_dict:
            return overrides_dict[name]
        return orig_get_option(name)

    return mock_config_get_option


def build_mock_config_is_manually_set(overrides_dict):
    orig_is_manually_set = config.is_manually_set

    def mock_config_is_manually_set(name):
        if name in overrides_dict:
            return overrides_dict[name]
        return orig_is_manually_set(name)

    return mock_config_is_manually_set


def requires_tensorflow(func):
    """Decorator indicating that a TestCase or test requires Tensorflow."""

    @functools.wraps(func)
    def inner(*args, **kwargs):
        version = sys.version_info
        if version.major == 3 and version.minor > 7:
            args[0].skipTest(
                "Requires Tensorflow, which doesn't support Python %d.%d"
                % (version.major, version.minor)
            )
        func(*args, **kwargs)

    return inner


class DeltaGeneratorTestCase(unittest.TestCase):
    def setUp(self, override_root=True):
        self.report_queue = ReportQueue()
        self.override_root = override_root
        self.orig_report_ctx = None

        if self.override_root:
            self.orig_report_ctx = get_report_ctx()
            add_report_ctx(
                threading.current_thread(),
                ReportContext(
                    session_id="test session id",
                    enqueue=self.report_queue.enqueue,
                    widgets=Widgets(),
                    widget_ids_this_run=_WidgetIDSet(),
                    uploaded_file_mgr=UploadedFileManager(),
                ),
            )

    def tearDown(self):
        self.clear_queue()
        if self.override_root:
            add_report_ctx(threading.current_thread(), self.orig_report_ctx)

    def get_message_from_queue(self, index=-1):
        """Get a ForwardMsg proto from the queue, by index.

        Returns
        -------
        ForwardMsg
        """
        return self.report_queue._queue[index]

    def get_delta_from_queue(self, index=-1):
        """Get a Delta proto from the queue, by index.

        Returns
        -------
        Delta
        """
        deltas = self.get_all_deltas_from_queue()
        return deltas[index]

    def get_all_deltas_from_queue(self):
        """Return all the delta messages in our ReportQueue"""
        return [msg.delta for msg in self.report_queue._queue if msg.HasField("delta")]

    def clear_queue(self):
        self.report_queue._clear()
