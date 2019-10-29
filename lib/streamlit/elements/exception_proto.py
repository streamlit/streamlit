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

import os
import sys
import traceback

import streamlit
from streamlit.errors import StreamlitAPIException
from streamlit.logger import get_logger

LOGGER = get_logger(__name__)

# Extract the streamlit package path
_streamlit_dir = os.path.dirname(streamlit.__file__)
# Make it absolute, and ensure there's a trailing path separator
_streamlit_dir = os.path.join(os.path.realpath(_streamlit_dir), "")


def marshall(exception_proto, exception, exception_traceback=None):
    """Marshalls an Exception.proto message.

    Parameters
    ----------
    exception_proto : Exception.proto
        The Exception protobuf to fill out

    exception : BaseException
        The exception whose data we're extracting

    exception_traceback : traceback or None
        An optional alternate traceback to use. If this is None, the traceback
        will be extracted from the exception.
    """
    exception_proto.type = type(exception).__name__

    # If this is a StreamlitAPIException, we prune all Streamlit entries
    # from the exception's stack trace.
    is_api_exception = isinstance(exception, StreamlitAPIException)

    stack_trace = _get_stack_trace(
        exception, exception_traceback, strip_streamlit_stack_entries=is_api_exception
    )

    exception_proto.stack_trace.extend(stack_trace)

    try:
        if isinstance(exception, SyntaxError):
            # SyntaxErrors have additional fields (filename, text, lineno,
            # offset) that we can use for a nicely-formatted message telling
            # the user what to fix.
            exception_proto.message = _format_syntax_error_message(exception)
        else:
            exception_proto.message = str(exception)
            exception_proto.message_is_markdown = is_api_exception
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
                "str_exception_tb": "\n".join(_get_stack_trace(str_exception)),
            }
        )


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
    if exception.text:
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
    # If a few edge cases, SyntaxErrors don't have all these nice fields. So we
    # have a fall back here.
    # Example edge case error message: encoding declaration in Unicode string
    return str(exception)


def _is_in_streamlit_package(file):
    """True if the given file is part of the streamlit package."""
    return (
        os.path.commonprefix([os.path.realpath(file), _streamlit_dir]) == _streamlit_dir
    )


def _get_stackframe_filename(frame):
    """Return the filename component of a traceback frame."""
    # Python 3 has a frame.filename variable, but frames in
    # Python 2 are just tuples. This code works in both versions.
    return frame[0]


def _get_stack_trace(
    exception, exception_traceback=None, strip_streamlit_stack_entries=False
):
    """Get the stack trace for the given exception.

    Parameters
    ----------
    exception : BaseException
        The exception to extract the traceback from

    exception_traceback : traceback or None
        An optional alternate traceback to use. If this is None, the traceback
        will be extracted from the exception.

    strip_streamlit_stack_entries : bool
        If True, all traceback entries that are in the Streamlit package
        will be removed from the list. We do this for exceptions that result
        from incorrect usage of Streamlit APIs, so that the user doesn't see
        a bunch of noise about ScriptRunner, DeltaGenerator, etc.

    Returns
    -------
    list
        The exception traceback as a list of strings

    """
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
        if strip_streamlit_stack_entries:
            extracted_traceback = [
                frame
                for frame in extracted_traceback
                if not _is_in_streamlit_package(_get_stackframe_filename(frame))
            ]
        stack_trace = traceback.format_list(extracted_traceback)

    return stack_trace
