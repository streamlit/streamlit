# -*- coding: future_fstrings -*-

"""Exports everything that should be visible to Streamlit users.

The functions in this package wrap member functions of DeltaGenerator, as well
as from any namespace within DeltaGenerator. What they do is get the
DeltaGenerator from the singleton connection object (in streamlit.connection)
and then call the corresponding function on that DeltaGenerator.
"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

# Give the package a version.
import pkg_resources
__version__ = pkg_resources.require("streamlit")[0].version

from . import logger
logger.set_log_level(config.get_option('log_level').upper())
logger.init_tornado_logs()
LOGGER = logger.get_logger('root')

# Python libraries we need.
import contextlib
import functools
import numpy as np
import os
import pandas as pd
import re
import sys
import textwrap
import threading
import traceback
import types

# Import some files directly from this module
from streamlit.caching import cache
from streamlit.DeltaGenerator import DeltaGenerator, EXPORT_TO_IO_FLAG, _VegaLite
from streamlit.Connection import Connection
from streamlit.util import escape_markdown
# import streamlit as st
# from streamlit import config
# from types import SimpleNamespace


this_module = sys.modules[__name__]

def _wrap_delta_generator_method(method):
    @functools.wraps(method)
    def wrapped_method(*args, **kwargs):
        dg = Connection.get_connection().get_delta_generator()
        return method(dg, *args, **kwargs)
    return wrapped_method

for name in dir(DeltaGenerator):
    member = getattr(DeltaGenerator, name)

    if hasattr(member, EXPORT_TO_IO_FLAG):
        method = member
        # We introduce this level of indirection to wrap 'method' in a closure.
        setattr(this_module, name, _wrap_delta_generator_method(method))

    if isinstance(member, _VegaLite):
        orig_ns = member
        ns = _VegaLite()
        setattr(this_module, name, ns)

        for subname in dir(orig_ns):
            if subname.startswith('_'):
                continue
            method = getattr(orig_ns, subname)
            setattr(ns, subname, _wrap_delta_generator_method(method))

def write(*args):
    """Writes its arguments to the Report.

    Prints its arguments to the current Report. Unlike other streamlit
    functions, write() has two unique properties:

        1. You can pass in multiple arguments, all of which will be written.
        2. It's behavior depends on the input types as follows.

    Args
    ----
    *args : any
        One or many objects to print to the Report.

    Arguments are handled as follows:

        - write(string)     : Prints the formatted Markdown string.
        - write(data_frame) : Displays the DataFrame as a table.
        - write(error)      : Prints an exception specially.
        - write(func)       : Displays information about a function.
        - write(module)     : Displays infomration about the module.
        - write(obj)        : The default is to print str(obj).

    Returns
    -------
    If *one* argument is passed, write() returns a DeltaGenerator
    which allows you to overwrite this element.

    IF *multiple* arguments are passed, write() returns none.

    Examples
    --------
    These are examples of writing things::

        write('Hello, *World!*')
        write('1 + 1 = ', 2)
        write('This is a DataFrame', data_frame, 'No, really!!')
    """
    DATAFRAME_LIKE_TYPES = (
        pd.DataFrame,
        pd.Series,
        pd.Index,
        np.ndarray,
    )

    HELP_TYPES = (
        types.FunctionType,
        types.ModuleType,
    )

    # return markdown(*args)
    try:
        string_buffer = []
        def flush_buffer():
            if string_buffer:
                markdown(' '.join(string_buffer))
                string_buffer[:] = []

        for arg in args:
            if isinstance(arg, string_types):
                string_buffer.append(arg)
            elif isinstance(arg, DATAFRAME_LIKE_TYPES):
                flush_buffer()
                dataframe(arg)
            elif isinstance(arg, Exception):
                flush_buffer()
                exception(arg)
            elif isinstance(arg, HELP_TYPES):
                flush_buffer()
                help(arg)
            else:
                string_buffer.append('`%s`' % escape_markdown(str(arg)))

        flush_buffer()
    except:
        _, exc, exc_tb = sys.exc_info()
        exception(exc, exc_tb)

@contextlib.contextmanager
def spinner(text):
    """Temporarily displays a message while executing a block of code.

    Args
    ----
    text : string
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
        message = empty()
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
    code = empty()
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
    except FileNotFoundError as err:
        code.warning(f'Unable to display code. {str(err)}')

# This is a necessary (but not sufficient) condition to establish that this
# is the proxy process.
#
# For whatever reason, sys.argv[0] is different based on python version.
# * Python 2.7 = '-c'
# * Python 3.6 = '-m'
_this_may_be_proxy = False
if sys.argv[0] in ('-m', '-c'):
    _this_may_be_proxy = True

# Test whether this is the 'streamlit' command.
_this_may_be_streamlit_command = os.path.split(sys.argv[0])[1] == 'streamlit'

# In order to log all exceptions etc to the streamlit report after
# `import streamlit` we establish the proxy by calling get_connection().
# If there's any chance that this is the proxy (i.e. _this_may_be_proxy) or the
# streamlit command (i.e. _this_may_be_streamlit_command), then we skip this
# step.
#
# Overcautiously skipping this step isn't fatal in general as it simply implies
# that the connection may be established later.
if not (_this_may_be_proxy or _this_may_be_streamlit_command):
    Connection.get_connection().get_delta_generator()

### DEPRECATION WARNING ###
# Everything below this point exists TEMPORARILY to emulate the old io
# module and to emit a deprecation warning in case someone uses it.
def _IO_show_warning(func):
    @functools.wraps(func)
    def wrapped(io_obj, *args, **kwargs):
        if not io_obj._emitted_deprecation_warning:
            error('The io package is deprecated. '
                'Please import streamlit as follows:\nimport streamlit as st')
            io_obj._emitted_deprecation_warning = True
        func(*args, **kwargs)
    return wrapped

class _IO(object):
    """THIS CLAASS WILL BE REMOVED SOON. It exists to mimic the old io
    package and print a deprecation error."""
    def __init__(self):
        self._emitted_deprecation_warning = False

    text = _IO_show_warning(text)
    markdown = _IO_show_warning(markdown)
    json = _IO_show_warning(json)
    title = _IO_show_warning(title)
    header = _IO_show_warning(header)
    subheader = _IO_show_warning(subheader)
    error = _IO_show_warning(error)
    warning = _IO_show_warning(warning)
    info = _IO_show_warning(info)
    success = _IO_show_warning(success)
    help = _IO_show_warning(help)
    exception = _IO_show_warning(exception)
    dataframe = _IO_show_warning(dataframe)
    chart = _IO_show_warning(
        lambda *args: error('Private method "chart" was removed'))
    image = _IO_show_warning(image)
    img = _IO_show_warning(img)
    progress = _IO_show_warning(progress)
    link = _IO_show_warning(link)
    empty = _IO_show_warning(empty)
    map = _IO_show_warning(map)
    table = _IO_show_warning(table)
    write = _IO_show_warning(write)
    echo = _IO_show_warning(lambda *args: error('Please use st.echo()'))
    spinner = _IO_show_warning(lambda *args: error('Please use st.spinner()'))
    area_chart = _IO_show_warning(area_chart)
    bar_chart = _IO_show_warning(bar_chart)
    line_chart = _IO_show_warning(line_chart)

# This class is a pseudo-package which exists to emit deprecation warnings.
io = _IO()
