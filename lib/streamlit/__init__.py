# -*- coding: future_fstrings -*-

# Copyright 2018 Streamlit Inc. All rights reserved.

"""Exports everything that should be visible to Streamlit users.

The functions in this package wrap member functions of DeltaGenerator, as well
as from any namespace within DeltaGenerator. What they do is get the
DeltaGenerator from the singleton connection object (in streamlit.connection)
and then call the corresponding function on that DeltaGenerator.
"""

# NOTE: You'll see lots of "noqa: F821" in this file. That's because we
# manually mess with the local namespace so the linter can't know that some
# identifiers actually exist in the namespace.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

# Give the package a version.
import pkg_resources
__version__ = pkg_resources.require("streamlit")[0].version

# Must be at the top, to avoid circular dependency.
from streamlit import logger
from streamlit import config
logger.set_log_level(config.get_option('global.logLevel').upper())
logger.init_tornado_logs()
LOGGER = logger.get_logger('root')

import contextlib
import functools
import os
import re
import sys
import textwrap
import threading
import traceback
import types

from streamlit.DeltaConnection import DeltaConnection
from streamlit.DeltaGenerator import DeltaGenerator, EXPORT_FLAG
from streamlit.caching import cache  # Just for export.
from streamlit.util import escape_markdown


this_module = sys.modules[__name__]

# This delta generator has no queue so it can't send anything out on a
# connection.
_NULL_DELTA_GENERATOR = DeltaGenerator(None)

def _wrap_delta_generator_method(method):
    @functools.wraps(method)
    def wrapped_method(*args, **kwargs):
        # Only output if the config allows us to.
        if config.get_option('client.displayEnabled'):
            connection = DeltaConnection.get_connection()
            delta_generator = connection.get_delta_generator()
        else:
            delta_generator = _NULL_DELTA_GENERATOR

        return method(delta_generator, *args, **kwargs)
    return wrapped_method

for name in dir(DeltaGenerator):
    member = getattr(DeltaGenerator, name)

    if hasattr(member, EXPORT_FLAG):
        method = member
        # We introduce this level of indirection to wrap 'method' in a closure.
        setattr(this_module, name, _wrap_delta_generator_method(method))


def write(*args):
    """Write arguments to the report.

    Unlike other streamlit functions, write() has some unique properties:

        1. You can pass in multiple arguments, all of which will be written.
        2. Its behavior depends on the input types as follows.
        3. It returns None, so it's "slot" in the report cannot be reused.

    Parameters
    ----------
    *args : any
        One or many objects to print to the Report.

    Arguments are handled as follows:

        - write(string)     : Prints the formatted Markdown string.
        - write(data_frame) : Displays the DataFrame as a table.
        - write(error)      : Prints an exception specially.
        - write(func)       : Displays information about a function.
        - write(module)     : Displays infomration about the module.
        - write(obj)        : The default is to print str(obj).

    Examples
    --------
    ::
        write('Hello, *World!*')
        write('1 + 1 = ', 2)
        write('This is a DataFrame', data_frame, 'No, really!!')

    """
    DATAFRAME_LIKE_TYPES = (
        'DataFrame',
        'Series',
        'Index',
        'ndarray',
    )

    HELP_TYPES = (
        types.FunctionType,
        types.ModuleType,
    )

    try:
        string_buffer = []

        def flush_buffer():
            if string_buffer:
                markdown(' '.join(string_buffer))  # noqa: F821
                string_buffer[:] = []

        for arg in args:
            if isinstance(arg, string_types):  # noqa: F821
                string_buffer.append(arg)
            elif type(arg).__name__ in DATAFRAME_LIKE_TYPES:
                flush_buffer()
                dataframe(arg)  # noqa: F821
            elif isinstance(arg, Exception):
                flush_buffer()
                exception(arg)  # noqa: F821
            elif isinstance(arg, HELP_TYPES):
                flush_buffer()
                help(arg)
            else:
                string_buffer.append('`%s`' % escape_markdown(str(arg)))

        flush_buffer()

    except Exception:
        _, exc, exc_tb = sys.exc_info()
        exception(exc, exc_tb)  # noqa: F821


@contextlib.contextmanager
def spinner(text):
    """Temporarily displays a message while executing a block of code.

    Parameters
    ----------
    text : str
        A message to display while executing that block

    Examples
    --------
    ::
        with st.spinner('Wait for it...'):
            time.sleep(5)
        st.success('Done!')

    """
    try:
        # Set the message 0.1 seconds in the future to avoid annoying flickering
        # if this spinner runs too quickly.
        DELAY_SECS = 0.1
        message = empty()  # noqa: F821
        display_message = True
        display_message_lock = threading.Lock()

        def set_message():
            with display_message_lock:
                if display_message:
                    message.warning(str(text))

        threading.Timer(DELAY_SECS, set_message).start()

        # Yield control back to the context.
        yield
    finally:
        with display_message_lock:
            display_message = False
        message.empty()


@contextlib.contextmanager
def echo():
    """Render the given code, then execute it.

    Example
    -------
    ::
        with st.echo():
            st.write('This code will be printed')

    """
    from streamlit.compatibility import running_py3
    code = empty()  # noqa: F821
    try:
        spaces = re.compile('\s*')
        frame = traceback.extract_stack()[-3]
        if running_py3():
            filename, start_line = frame.filename, frame.lineno
        else:
            filename, start_line = frame[:2]
        yield
        if running_py3():
            end_line = traceback.extract_stack()[-3].lineno
        else:
            end_line = traceback.extract_stack()[-3][1]
        lines_to_display = []
        with open(filename) as source_file:
            source_lines = source_file.readlines()
            lines_to_display.extend(source_lines[start_line:end_line])
            initial_spaces = spaces.match(lines_to_display[0]).end()
            for line in source_lines[end_line:]:
                if spaces.match(line).end() < initial_spaces:
                    break
                lines_to_display.append(line)
        lines_to_display = textwrap.dedent(''.join(lines_to_display))
        code.markdown(f'```\n{lines_to_display}\n```')

    except FileNotFoundError as err:  # noqa: F821
        code.warning(f'Unable to display code. {str(err)}')
