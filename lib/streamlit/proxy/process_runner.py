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
import re

import streamlit as st
from streamlit import protobuf
from streamlit import compatibility
from streamlit.DeltaConnection import DeltaConnection
from streamlit.streamlit_msg_proto import new_report_msg
from streamlit.util import get_local_id, build_report_id

from streamlit.logger import get_logger
LOGGER = get_logger()


def run_outside_proxy_process(cmd_in, cwd=None):
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
    if compatibility.running_py3():
        unicode_str = str
    else:
        unicode_str = unicode

    if type(cmd_in) in string_types or type(cmd_in) == unicode_str: # noqa: F821
        # Split string around whitespaces, but respect quotes.
        cmd_list = shlex.split(cmd_in)
    else:
        cmd_list = _to_list_of_str(cmd_in)

    cmd = [sys.executable, '-m', 'streamlit', 'run'] + cmd_list

    _run_with_error_handler(cmd, cwd)


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
    _run_with_error_handler(cmd, cwd)


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


def _run_with_error_handler(cmd, cwd=None):
    process = subprocess.Popen(
            cmd,
            cwd=cwd,
            stderr=subprocess.PIPE)

    # Wait for the process to end and grab all data from stderr.
    # (We use this instead of .wait() because .communicate() grabs *all data*
    # rather than just a small buffer worth)
    stdout, stderr = process.communicate()

    stderr_str = _to_str(stderr)

    if process.returncode != 0 and _is_syntax_error(stderr_str):
        print(stderr_str, file=sys.stderr)

        parsed_err = _parse_exception_text(stderr_str)

        # This part of the code line needs to be done in a process separate
        # from the Proxy process, since st.foo creates WebSocket connection.

        if parsed_err:
            stack_trace, exception_type, message = parsed_err
            st._text_exception(
                exception_type, message, stack_trace.split('\n'))
        else:
            st.error(stderr_str)


def _to_list_of_str(the_list):
    return [_to_str(x) for x in the_list]


def _to_str(x):
    if type(x) is bytes:
        return x.decode('utf-8')
    else:
        return x


# These are all compilation errors in Python.
# See: https://docs.python.org/3/library/exceptions.html
_SYNTAX_ERROR_RE = (
    re.compile('^(SyntaxError|IndentationError|TabError): ', re.MULTILINE))


def _is_syntax_error(err_str):
    return _SYNTAX_ERROR_RE.search(err_str) is not None


# RegEx used for parsing an Exception's printout into its proper fields.
# See: https://docs.python.org/3/library/exceptions.html
_EXCEPTION_PARSER_ER = re.compile(
    '(.*)^(SyntaxError|IndentationError|TabError): (.*)',
    re.MULTILINE|re.DOTALL)


def _parse_exception_text(err_str):
    matches = _EXCEPTION_PARSER_ER.match(err_str)
    return matches.groups()
