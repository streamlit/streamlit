# Copyright 2018 Streamlit Inc. All rights reserved.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from streamlit import __version__
from streamlit import config
from streamlit import protobuf


def _marshall_session_state(proto_session_state, report_state):
    """Fills out a SessionState protobuf message with the
    values from the given ReportState

    Parameters
    ----------
    proto_session_state : SessionState protobuf message
    report_state : ReportState (from ReportSession)
    """
    proto_session_state.run_on_save = report_state.run_on_save


def initialize_msg(report_state):
    """Builds a ForwardMsg.initialize message to be sent when a
    web browser initially connects to the Proxy

    Parameters
    ----------
    report_state : ReportState
        The initial ReportState for this report
    """
    msg = protobuf.ForwardMsg()
    msg.initialize.sharing_enabled = (
        config.get_option('global.sharingMode') != 'off')
    msg.initialize.gather_usage_stats = (
        config.get_option('browser.gatherUsageStats'))
    msg.initialize.streamlit_version = __version__

    _marshall_session_state(msg.initialize.session_state, report_state)
    return msg


def new_report_msg(report_id, cwd, command_line, source_file_path):
    """Build a ForwardMsg.new_report message. This is sent to
    a connected web browser when its report is re-run.

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


def session_state_changed_msg(state):
    """Builds ForwardMessage.session_state_changed message. This is
    sent to a connected web browser when any session-related state
    is changed.

    Parameters
    ----------
    state : ReportState
        a ReportState (from ReportSession)
    """
    msg = protobuf.ForwardMsg()
    _marshall_session_state(msg.session_state_changed, state)
    return msg
