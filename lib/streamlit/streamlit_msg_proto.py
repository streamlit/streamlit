# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from streamlit import protobuf


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
