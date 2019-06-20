# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import threading

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)

REPORT_CONTEXT_ATTR_NAME = 'streamlit_report_ctx'


class ReportThread(threading.Thread):
    """Extends threading.Thread with a ReportContext member"""
    def __init__(self, report_ctx, target=None, name=None):
        super(ReportThread, self).__init__(target=target, name=name)
        self.streamlit_report_ctx = report_ctx


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
    if ctx is None:
        LOGGER.warning('Thread \'%s\': missing ReportContext' % thread.name)
    return ctx
