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

import sys
import traceback

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


def _format_syntax_error_message(exception):
    """Returns a nicely formatted SyntaxError message that emulates
    what the Python interpreter outputs, e.g.:

    > File "raven.py", line 3
    >   st.write('Hello world!!'))
    >                            ^
    > SyntaxError: invalid syntax

    Parameters
    ----------
    exception : SyntaxError

    Returns
    -------
    str

    """
    return (
        'File "%(filename)s", line %(lineno)d\n'
        "  %(text)s\n"
        "  %(caret_indent)s^\n"
        "%(errname)s: %(msg)s"
        % {
            "filename": exception.filename,
            "lineno": exception.lineno,
            "text": exception.text.rstrip(),
            "caret_indent": " " * max(exception.offset - 1, 0),
            "errname": type(exception).__name__,
            "msg": exception.msg,
        }
    )


def marshall(exception_proto, exception, exception_traceback=None):
    """Marshalls an Exception.proto message.

    Parameters
    ----------
    exception_proto : Exception.proto
        The Exception protobuf to fill out

    exception : BaseException
        The exception whose data we're extracting

    exception_traceback : Exception Traceback or None
        If None or False, does not show display the trace. If True,
        tries to capture a trace automatically. If a Traceback object,
        displays the given traceback.
    """
    exception_proto.type = type(exception).__name__

    stack_trace = get_stack_trace(exception, exception_traceback)
    exception_proto.stack_trace.extend(stack_trace)

    try:
        if isinstance(exception, SyntaxError):
            # SyntaxErrors have additional fields (filename, text, lineno,
            # offset) that we can use for a nicely-formatted message telling
            # the user what to fix.
            exception_proto.message = _format_syntax_error_message(exception)
        else:
            exception_proto.message = str(exception)
    except Exception as str_exception:
        # Sometimes the exception's __str__/__unicode__ method itself
        # raises an error.
        exception_proto.message = ""
        LOGGER.warning(
            """

Streamlit was unable to parse the data from an exception in the user's script.
This is usually due to a bug in the Exception object itself. Here is some info
about that Exception object, so you can report a bug to the original author:

Exception type:
  %(etype)s

Problem:
  %(str_exception)s

Traceback:
%(str_exception_tb)s

        """
            % {
                "etype": type(exception).__name__,
                "str_exception": str_exception,
                "str_exception_tb": "\n".join(get_stack_trace(str_exception)),
            }
        )


def get_stack_trace(exception, exception_traceback=None):
    # Get and extract the traceback for the exception.
    if exception_traceback is not None:
        extracted_traceback = traceback.extract_tb(exception_traceback)
    elif hasattr(exception, "__traceback__"):
        # This is the Python 3 way to get the traceback.
        extracted_traceback = traceback.extract_tb(exception.__traceback__)
    else:
        # Hack for Python 2 which will extract the traceback as long as this
        # method was called on the exception as it was caught, which is
        # likely what the user would do.
        _, live_exception, live_traceback = sys.exc_info()
        if exception == live_exception:
            extracted_traceback = traceback.extract_tb(live_traceback)
        else:
            extracted_traceback = None

    # Format the extracted traceback and add it to the protobuf element.
    if extracted_traceback is None:
        stack_trace = [
            "Cannot extract the stack trace for this exception. "
            "Try calling exception() within the `catch` block."
        ]
    else:
        stack_trace = traceback.format_list(extracted_traceback)

    return stack_trace
