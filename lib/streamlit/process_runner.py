# Copyright 2018 Streamlit Inc. All rights reserved.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import subprocess
import sys
import shlex
import re

from streamlit import compatibility
from streamlit import util

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

# A standard system error message looks like the following:
# * "python: can't open file 'script.py': [Errno 2] No such file or directory"
# * "python: can't open file 'script.py': [Errno 13] Permission denied"
# The regex below creates a python regex named match to extract the
# following:
# * errno - 'Errno 2'
# * errmsg - 'No such file or directory'
# * msg - '"python: can't open file 'script.py'"
_ERRNO_RE = re.compile(
    r'(?P<msg>.*):.*\[(?P<errno>Errno [0-9]+)] (?P<errmsg>.*)')


def run_handling_errors_in_subprocess(cmd_in, cwd=None):
    """Run cmd_in in subprocess that opens another subprocess and shows errors.

    Parameters
    ----------
    cmd_in : str or sequence of str
        See the args parameter of Python's subprocess.Popen for more info.

    cwd : str or None
        The current working directory for this process.

    """
    if compatibility.running_py3():
        unicode_str = str
    else:
        unicode_str = unicode  # noqa: F821

    if (type(cmd_in) in string_types  # noqa: F821
            or type(cmd_in) == unicode_str):
        if sys.platform == 'win32':
            # Windows is special
            # https://stackoverflow.com/questions/33560364/python-windows-parsing-command-lines-with-shlex
            cmd_list = [cmd_in]
        else:
            # Split string around whitespaces, but respect quotes.
            cmd_list = shlex.split(cmd_in)
    else:
        cmd_list = _to_list_of_str(cmd_in)

    # The error handler gets added by 'streamlit run'.
    cmd = [sys.executable, '-m', 'streamlit', 'run'] + cmd_list

    # Wait is needed so that the proxy can cleanup after the command is
    # run which is usually a rerun script.  Without the wait, the
    # subprocess turns into a zombie process.
    p = subprocess.Popen(cmd, cwd=cwd)
    p.wait()


def run_handling_errors_in_this_process(cmd, cwd=None):
    """Run cmd in a subprocess and show errors in Streamlit.

    This must be called on a separate process from the one that is running the
    Proxy.

    Parameters
    ----------
    cmd : str or sequence of str
        See the args parameter of Python's subprocess.Popen for more info.

    cwd : str or None
        The current working directory for this process.

    """
    process = subprocess.Popen(cmd, cwd=cwd, stderr=subprocess.PIPE)

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

    if process.returncode != 0 and len(stderr_str) > 0:
        # Catch errors that are output by Python when parsing the script. In
        # particular, here we look for errors that have a traceback.
        if (_TRACE_FILE_LINE_RE.search(stderr_str)
                # Only parse errors that were not handled by Streamlit already.
                and util.EXCEPTHOOK_IDENTIFIER_STR not in stderr_str):

            parsed_err = _parse_exception_text(stderr_str)

            # This part of the code needs to be done in a process separate from
            # the Proxy process, since st.foo creates WebSocket connection.

            if parsed_err:
                import streamlit as st
                exc_type, exc_message, exc_tb = parsed_err
                st._text_exception(exc_type, exc_message, exc_tb)
            else:
                # If we couldn't find the exception type, then maybe the script
                # just returns an error code and prints something to stderr. So
                # let's not replace the report with the contents of stderr
                # because that would be annoying.
                pass

        # Catch errors that are output by the Python interpreter when it
        # encounters OS-level issues when it tries to open the script itself.
        # These always look like:
        # "python: some message: [Errno some-number] some message".
        else:
            m = _ERRNO_RE.match(stderr_str)
            if m:
                import streamlit as st
                st._text_exception(
                    m.group('errno'), m.group('errmsg'), [m.group('msg')])


def run_python_module(module, *args):
    """Run a Python module's main function in a subprocess.

    Parameters
    ----------
    module : str
        The fully-qualified module name, like 'streamlit' or 'streamlit.proxy'.
    *args : tuple of str
        The arguments to pass when running the module, if any.

    """
    executable = sys.executable

    # When running as a pex file (https://github.com/pantsbuild/pex),
    # sys.executable won't be able to find streamlit.proxy or any module
    # that's not in the system python.
    if util.is_pex():
        executable = sys.path[0]
        LOGGER.debug('Running as a pex file: %s', executable)

    cmd = [executable, '-m', module] + list(args)
    subprocess.Popen(cmd)


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
