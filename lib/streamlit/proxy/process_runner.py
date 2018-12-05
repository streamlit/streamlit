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

from streamlit import compatibility
from streamlit import protobuf
from streamlit import util
from streamlit.DeltaConnection import DeltaConnection

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


# String that Python prints at the beginning of a trace dump. This is not
# guaranteed to be present in all exceptions.
_TRACE_START_STR = 'Traceback (most recent call last):'


# When an exception prints to stderr, the printed traceback contains lines
# like:
#   File "foo/bar.py", line 30
#   File "foo/bar.py", line 30, in module foo
# This RegEx matches those, in multiline strings.
# NOTE: these kinds of lines seem to print out for all exceptions.
_TRACE_FILE_LINE_RE = re.compile('^  File ".*", line [0-9]+', re.MULTILINE)


# RegEx that matches strings that look like "Foo: bar boz"
# This RegEx is meant to be used in single-line strings.
_EXCEPTION_LINE_RE = re.compile('([A-Z][A-Za-z0-9]+): (.*)')


def run_outside_proxy_process(cmd_in, cwd=None):
    """Open a subprocess that will call `streamlit run` on a script.

    Parameters
    ----------
    cmd : str or sequence of str
        See the args parameter of Python's subprocess.Popen for more info.

    cwd : str or None
        The current working directory for this process.

    source_file_path : str or None
        The full path to the script that is being executed. This is used so we
        can extract the name of the report.

    """
    if compatibility.running_py3():
        unicode_str = str
    else:
        unicode_str = unicode

    if (type(cmd_in) in string_types  # noqa: F821
            or type(cmd_in) == unicode_str):
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
    cmd : str or sequence of str
        See the args parameter of Python's subprocess.Popen for more info.

    cwd : str or None
        The current working directory for this process.

    source_file_path : str or None
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

    # Always forward stderr and stdout to the user-visible stderr and stdout.
    # TODO: Forward this info live, as the process runs. Right now we only
    # forward it when the process ends.

    if stdout:
        print(_to_str(stdout), file=sys.stdout)

    if stderr:
        print(stderr_str, file=sys.stderr)

    if (process.returncode != 0 and len(stderr_str) > 0
            # Look for magic string to check whether stderr has exception.
            and _TRACE_FILE_LINE_RE.search(stderr_str)
            # Only parse exceptions that were not handled by Streamlit already.
            and util.EXCEPTHOOK_IDENTIFIER_STR not in stderr_str):

        parsed_err = _parse_exception_text(stderr_str)

        # This part of the code needs to be done in a process separate from the
        # Proxy process, since st.foo creates WebSocket connection.

        if parsed_err:
            import streamlit as st
            exc_type, exc_message, exc_tb = parsed_err
            st._text_exception(exc_type, exc_message, exc_tb)
        else:
            # If we couldn't find the exception type, then maybe the script
            # just returns an error code and prints something to stderr. So
            # let's not replace the report with the contents of stderr because
            # that would be annoying.
            pass


def _to_list_of_str(the_list):
    return [_to_str(x) for x in the_list]


def _to_str(x):
    if type(x) is bytes:
        return x.decode('utf-8')
    else:
        return x


def _parse_exception_text(err_str):
    """Get the exception info from a string captured from stderr.

    Parameters
    ----------
    err_str : str
        A string captured from stderr.

    Returns
    -------
    tuple
        A 3-tuple with the following components:
        str
            The type of the exception. Example: 'SyntaxError'.
        str
            The exception description.
        list of str
            The traceback, split into lines of text.

    """
    err_lines = err_str.splitlines()

    # Find the first line of the exception text.
    try:
        i = err_lines.index(_TRACE_START_STR)
        err_lines = err_lines[i + 1:]
    except ValueError:
        # This error gets thrown when .index() does not find the element.
        pass

    last_line_match = None

    # Find the last line of the exception text.
    for i, line in enumerate(err_lines):
        last_line_match = _EXCEPTION_LINE_RE.match(line)
        if last_line_match:
            break

    if last_line_match is None:
        return None

    # Finally, parse exception text.
    type_str, message_str = last_line_match.groups()
    traceback_lines = err_lines[:i]

    return type_str, message_str, traceback_lines
