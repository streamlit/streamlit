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

"""Utility functions to use in our tests."""
import threading
import unittest

from streamlit import config
from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.ReportQueue import ReportQueue
from streamlit.ReportThread import REPORT_CONTEXT_ATTR_NAME
from streamlit.ReportThread import ReportContext
from streamlit.widgets import Widgets
from streamlit.proto.BlockPath_pb2 import BlockPath


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


class DeltaGeneratorTestCase(unittest.TestCase):
    def setUp(self, override_root=True):
        self.report_queue = ReportQueue()

        if override_root:
            main_dg = self.new_delta_generator()
            sidebar_dg = self.new_delta_generator(container=BlockPath.SIDEBAR)
            setattr(
                threading.current_thread(),
                REPORT_CONTEXT_ATTR_NAME,
                ReportContext(
                    main_dg=main_dg, sidebar_dg=sidebar_dg, widgets=Widgets()
                ),
            )

    def tearDown(self):
        self.report_queue._clear()
        if hasattr(threading.current_thread(), REPORT_CONTEXT_ATTR_NAME):
            delattr(threading.current_thread(), REPORT_CONTEXT_ATTR_NAME)

    def new_delta_generator(self, *args, **kwargs):
        def enqueue_fn(msg):
            self.report_queue.enqueue(msg)
            return True

        if len(args) > 0:
            enqueue = args[0]
            args = args[1:]
        elif "enqueue" in kwargs:
            enqueue = kwargs.pop("enqueue")
        else:
            enqueue = enqueue_fn

        return DeltaGenerator(enqueue, *args, **kwargs)

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
        return self.report_queue._queue[index].delta
