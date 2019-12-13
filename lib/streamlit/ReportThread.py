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
        # (DeltaGenerator) The main DeltaGenerator for the report
        "main_dg",
        # (DeltaGenerator) The sidebar DeltaGenerator for the report
        "sidebar_dg",
        # (Widgets) The Widgets state object for the report
        "widgets",
        # (_WidgetIDSet) The set of widget IDs that have been assigned in the
        # current report run. This set is cleared at the start of each run.
        "widget_ids_this_run",
        # (UploadedFileManager) Object that manages files uploaded by this user.
        "uploaded_file_mgr",
    ],
)


class _WidgetIDSet(object):
    """Stores a set of widget IDs. Safe to mutate from multiple threads."""

    def __init__(self):
        self._lock = threading.Lock()
        self._items = set()

    def clear(self):
        """Clears all items in the set."""
        with self._lock:
            self._items.clear()

    def add(self, item):
        """Adds an item to the set.

        Parameters
        ----------
        item : Any
            The item to add.

        Returns
        -------
        bool
            True if the item was added, and False if it was already in
            the set.

        """
        with self._lock:
            if item in self._items:
                return False
            self._items.add(item)
            return True


REPORT_CONTEXT_ATTR_NAME = "streamlit_report_ctx"


class ReportThread(threading.Thread):
    """Extends threading.Thread with a ReportContext member"""

    def __init__(
        self,
        main_dg,
        sidebar_dg,
        widgets,
        target=None,
        name=None,
        uploaded_file_mgr=None,
    ):
        super(ReportThread, self).__init__(target=target, name=name)
        self.streamlit_report_ctx = ReportContext(
            main_dg, sidebar_dg, widgets, _WidgetIDSet(), uploaded_file_mgr
        )


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
