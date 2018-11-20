# -*- coding: future_fstrings -*-
# Copyright 2018 Streamlit Inc. All rights reserved.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import os
import subprocess
import sys
import shlex

from streamlit import protobuf
from streamlit.DeltaConnection import DeltaConnection
from streamlit.streamlit_msg_proto import new_report_msg
from streamlit.util import get_local_id, build_report_id

from streamlit.logger import get_logger
LOGGER = get_logger()


def run_outside_proxy_process(cmd_in, cwd=None, source_file_path=None):
    """Open a subprocess that will call `streamlit run` on a script.

    Parameters
    ----------
    cmd : str | sequence of str
        See the args parameter of Python's subprocess.Popen for more info.

    cwd : str | None
        The current working directory for this process.

    source_file_path : str | None
        The full path to the script that is being executed. This is used so we
        can extract the name of the report.

    """

    if type(cmd_in) in string_types or type(cmd_in) == unicode: # noqa: F821
        cmd_list = shlex.split(cmd_in)
    else:
        cmd_list = _to_list_of_str(cmd_in)

    cmd = [sys.executable, '-m', 'streamlit', 'run'] + cmd_list

    LOGGER.debug("RUN OUTSIDE PROXY PROCESS:")
    LOGGER.debug("RUN OUTSIDE PROXY PROCESS: cmd_in=%s", cmd_in)
    LOGGER.debug("RUN OUTSIDE PROXY PROCESS: cwd=%s", cwd)
    LOGGER.debug("RUN OUTSIDE PROXY PROCESS: source_file_path=%s", source_file_path)
    LOGGER.debug("RUN OUTSIDE PROXY PROCESS: cmd_list=%s", cmd_list)
    LOGGER.debug("RUN OUTSIDE PROXY PROCESS: cmd=%s", cmd)

    _run_with_error_handler(cmd, cwd, source_file_path)


def run_assuming_outside_proxy_process(cmd, cwd=None, source_file_path=None):
    """Execute a command in a subprocess.

    This must be called on a separate process from the one that is running the
    Proxy.

    Parameters
    ----------
    cmd : str | sequence of str
        See the args parameter of Python's subprocess.Popen for more info.

    cwd : str | None
        The current working directory for this process.

    source_file_path : str | None
        The full path to the script that is being executed. This is used so we
        can extract the name of the report.
    """
    _run_with_error_handler(cmd, cwd, source_file_path)


def run_streamlit_command(cmd):
    """Run a Streamlit command, like "help".

    Parameters
    ----------
    cmd : str
        The command to run. Example: "help", "kill_proxy", etc.

    """
    # For some reason, Strealit commands must be run on a Shell. But they're
    # trustworthy, so we let them.
    subprocess.Popen(f'streamlit {cmd}', shell=True)


def _run_with_error_handler(cmd, cwd=None, source_file_path=None):
    # Convert cmd to a list.
    # (Sometimes it's a RepeatedScalarContainer proto)
    cmd = [x for x in cmd]

    process = subprocess.Popen(
            cmd,
            cwd=cwd,
            stderr=subprocess.PIPE)

    # Wait for the process to end and grab all data from stderr.
    # (We use this instead of .wait() because .communicate() grabs *all data*
    # rather than just a small buffer worth)
    stdout, stderr = process.communicate()

    if process.returncode != 0:
        print(stderr, file=sys.stderr)

        if source_file_path:
            err_str = _to_str(stderr)
            # This line needs to be done in a process separate from the Proxy
            # process, since it creates WebSocket connection.
            _print_error_to_report(source_file_path, err_str)


def _print_error_to_report(source_file_path, err_msg):
    filename_w_ext = os.path.basename(source_file_path)
    filename = os.path.splitext(filename_w_ext)[0]

    con = DeltaConnection.get_connection(filename)

    # TODO: Only do this when client.displayEnabled. Need new config first.
    con.set_enabled(True)

    dg = con.get_delta_generator()
    dg.error(err_msg)


def _to_list_of_str(the_list):
    return [_to_str(x) for x in the_list]


def _to_str(x):
    if type(x) is bytes:
        return x.decode('utf-8')
    else:
        return x
