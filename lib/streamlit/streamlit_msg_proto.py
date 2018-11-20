# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from streamlit import protobuf

# setup logging
from streamlit.logger import get_logger
LOGGER = get_logger()


def new_report_msg(report_id, cwd, command_line, source_file_path):
    """Build message indicating a new report is starting.

    Parameters
    ----------
    report_id : uuid
        ID of the new report
    cwd : str
        The current working directory from which this report was launched.
    command_line : list of strings
        The command line arguments used to launch the report.
    source_file_path: string
        Full path of the file that initiated the new report.

    """
    msg = protobuf.ForwardMsg()
    msg.new_report.id = str(report_id)
    msg.new_report.cwd = cwd
    msg.new_report.command_line.extend(command_line)
    msg.new_report.source_file_path = source_file_path
    return msg


def new_exception_delta_msg(id, type, message=None, stack_trace=None):
    """Build message indicating an exception.

    Parameters
    ----------
    id : int
        The delta ID.
    type : str
        The error type.
    message : str | None
        The error message.
    stack_trace : list of str | None
        Multi-line errors, split by line.

    """
    msg = protobuf.ForwardMsg()
    msg.delta.id = id
    msg.delta.new_element.exception.type = type

    if message is not None:
        msg.delta.new_element.exception.message = message

    if stack_trace is not None:
        msg.delta.new_element.exception.stack_trace.extend(stack_trace)

    return msg
