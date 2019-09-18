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

import threading
from collections import namedtuple

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)

ReportContext = namedtuple(
    "ReportContext",
    [
        # The main DeltaGenerator for the report
        "main_dg",
        # The sidebar DeltaGenerator for the report
        "sidebar_dg",
        # The Widgets state object for the report
        "widgets",
    ],
)

REPORT_CONTEXT_ATTR_NAME = "streamlit_report_ctx"


class ReportThread(threading.Thread):
    """Extends threading.Thread with a ReportContext member"""

    def __init__(self, main_dg, sidebar_dg, widgets, target=None, name=None):
        super(ReportThread, self).__init__(target=target, name=name)
        self.streamlit_report_ctx = ReportContext(main_dg, sidebar_dg, widgets)


def add_report_ctx(thread):
    """Adds the current ReportContext to a newly-created thread.

    This should be called from this thread's parent thread,
    before the new thread starts.

    Parameters
    ----------
    thread : threading.Thread
        The thread to attach the current ReportContext to.

    Returns
    -------
    threading.Thread
        The same thread that was passed in, for chaining.

    """
    ctx = get_report_ctx()
    if ctx is not None:
        setattr(thread, REPORT_CONTEXT_ATTR_NAME, ctx)
    return thread


def get_report_ctx():
    """
    Returns
    -------
    ReportContext | None
        The current thread's ReportContext, or None if it doesn't have one.

    """
    thread = threading.current_thread()
    ctx = getattr(thread, REPORT_CONTEXT_ATTR_NAME, None)
    if ctx is None and streamlit._is_running_with_streamlit:
        # Only warn about a missing ReportContext if we were started
        # via `streamlit run`. Otherwise, the user is likely running a
        # script "bare", and doesn't need to be warned about streamlit
        # bits that are irrelevant when not connected to a report.
        LOGGER.warning("Thread '%s': missing ReportContext" % thread.name)
    return ctx


# Avoid circular dependencies in Python 2
import streamlit
