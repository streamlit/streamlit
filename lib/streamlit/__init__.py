# Copyright 2018 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

"""Streamlit. Data Science, reimagined.

How to use Streamlit in 3 seconds:

    1. Write your code
    >>> import streamlit as st
    >>> st.write(anything_you_want)

    2. Run your code
    $ streamlit run my_script.py

    3. Visualize your code
    A new tab will open on your browser. That's your Streamlit report!

    4. Modify your code, save it, and watch changes live on your browser.

Take a look at the other commands in this module to find out what else
Streamlit can do:

    >>> dir(streamlit)

Or try running our "Hello World":

    $ streamlit hello

For more detailed info, see https://streamlit.io/secret/docs.
"""

# IMPORTANT: Prefix with an underscore anything that the user shouldn't see.

# NOTE: You'll see lots of "noqa: F821" in this file. That's because we
# manually mess with the local namespace so the linter can't know that some
# identifiers actually exist in the namespace.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims as _setup_2_3_shims, is_running_py3 as _is_running_py3
_setup_2_3_shims(globals())

# Must be at the top, to avoid circular dependency.
from streamlit import logger as _logger
from streamlit import config as _config
_LOGGER = _logger.get_logger('root')

# Give the package a version.
import pkg_resources as _pkg_resources
import uuid as _uuid

# This used to be pkg_resources.require('streamlit') but it would cause
# pex files to fail. See #394 for more details.
__version__ = _pkg_resources.get_distribution('streamlit').version

# Deterministic Unique Streamlit User ID
# The try/except is needed for python 2/3 compatibility
try:
    __installation_id__ = str(_uuid.uuid5(_uuid.NAMESPACE_DNS, str(_uuid.getnode())))
except UnicodeDecodeError:
    __installation_id__ = str(_uuid.uuid5(_uuid.NAMESPACE_DNS, str(_uuid.getnode()).encode('utf-8')))

import contextlib as _contextlib
import functools as _functools
import re as _re
import sys as _sys
import textwrap as _textwrap
import threading as _threading
import traceback as _traceback
import types as _types

from streamlit import code_util as _code_util
from streamlit import util as _util
from streamlit.DeltaGenerator import DeltaGenerator as _DeltaGenerator

# Modules that the user should have access to.
from streamlit.caching import cache  # noqa: F401


# Delta generator with no queue so it can't send anything out.
_NULL_DELTA_GENERATOR = _DeltaGenerator(None)

# Root delta generator for this Streamlit report.
# This gets overwritten in bootstrap.py and in tests.
_delta_generator = _NULL_DELTA_GENERATOR


def _set_log_level():
    _logger.set_log_level(_config.get_option('global.logLevel').upper())
    _logger.init_tornado_logs()


# Make this file only depend on config option in an asynchronous manner. This
# avoids a race condition when another file (such as a test file) tries to pass
# in an alternatve config.
_config.on_config_parsed(_set_log_level)


def _with_dg(method):
    @_functools.wraps(method)
    def wrapped_method(*args, **kwargs):
        if _delta_generator is _NULL_DELTA_GENERATOR:
            _maybe_print_repl_warning()

        return method(_delta_generator, *args, **kwargs)
    return wrapped_method


# DeltaGenerator methods:

altair_chart    = _with_dg(_DeltaGenerator.altair_chart)  # noqa: E221
area_chart      = _with_dg(_DeltaGenerator.area_chart)  # noqa: E221
audio           = _with_dg(_DeltaGenerator.audio)  # noqa: E221
balloons        = _with_dg(_DeltaGenerator.balloons)  # noqa: E221
bar_chart       = _with_dg(_DeltaGenerator.bar_chart)  # noqa: E221
bokeh_chart     = _with_dg(_DeltaGenerator.bokeh_chart)  # noqa: E221
code            = _with_dg(_DeltaGenerator.code)  # noqa: E221
dataframe       = _with_dg(_DeltaGenerator.dataframe)  # noqa: E221
deck_gl_chart   = _with_dg(_DeltaGenerator.deck_gl_chart)  # noqa: E221
empty           = _with_dg(_DeltaGenerator.empty)  # noqa: E221
error           = _with_dg(_DeltaGenerator.error)  # noqa: E221
exception       = _with_dg(_DeltaGenerator.exception)  # noqa: E221
graphviz_chart  = _with_dg(_DeltaGenerator.graphviz_chart)  # noqa: E221
header          = _with_dg(_DeltaGenerator.header)  # noqa: E221
help            = _with_dg(_DeltaGenerator.help)  # noqa: E221
image           = _with_dg(_DeltaGenerator.image)  # noqa: E221
info            = _with_dg(_DeltaGenerator.info)  # noqa: E221
json            = _with_dg(_DeltaGenerator.json)  # noqa: E221
line_chart      = _with_dg(_DeltaGenerator.line_chart)  # noqa: E221
map             = _with_dg(_DeltaGenerator.map)  # noqa: E221
markdown        = _with_dg(_DeltaGenerator.markdown)  # noqa: E221
plotly_chart    = _with_dg(_DeltaGenerator.plotly_chart)  # noqa: E221
progress        = _with_dg(_DeltaGenerator.progress)  # noqa: E221
pyplot          = _with_dg(_DeltaGenerator.pyplot)  # noqa: E221
subheader       = _with_dg(_DeltaGenerator.subheader)  # noqa: E221
success         = _with_dg(_DeltaGenerator.success)  # noqa: E221
table           = _with_dg(_DeltaGenerator.table)  # noqa: E221
text            = _with_dg(_DeltaGenerator.text)  # noqa: E221
title           = _with_dg(_DeltaGenerator.title)  # noqa: E221
vega_lite_chart = _with_dg(_DeltaGenerator.vega_lite_chart)  # noqa: E221
video           = _with_dg(_DeltaGenerator.video)  # noqa: E221
warning         = _with_dg(_DeltaGenerator.warning)  # noqa: E221

_native_chart   = _with_dg(_DeltaGenerator._native_chart)  # noqa: E221
_text_exception = _with_dg(_DeltaGenerator._text_exception)  # noqa: E221
_reset          = _with_dg(_DeltaGenerator._reset)  # noqa: E221

# Config
set_option = _config.set_option
get_option = _config.get_option


# Special methods:

_DATAFRAME_LIKE_TYPES = (
    'DataFrame',  # pandas.core.frame.DataFrame
    'Index',  # pandas.core.indexes.base.Index
    'Series',  # pandas.core.series.Series
    'Styler',  # pandas.io.formats.style.Styler
    'ndarray',  # numpy.ndarray
)

_HELP_TYPES = (
    _types.BuiltinFunctionType,
    _types.BuiltinMethodType,
    _types.FunctionType,
    _types.MethodType,
    _types.ModuleType,
)


if not _is_running_py3():
    _HELP_TYPES = list(_HELP_TYPES)
    _HELP_TYPES.append(_types.ClassType)
    _HELP_TYPES.append(_types.InstanceType)
    _HELP_TYPES = tuple(_HELP_TYPES)


def write(*args):
    """Write arguments to the report.

    This is the swiss-army knife of Streamlit commands. It does different
    things depending on what you throw at it.

    Unlike other Streamlit commands, write() has some unique properties:

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
        - write(module)     : Displays information about the module.
        - write(dict)       : Displays dict in an interactive widget.
        - write(obj)        : The default is to print str(obj).
        - write(mpl_fig)    : Displays a Matplotlib figure.
        - write(altair)     : Displays an Altair chart.
        - write(keras)      : Displays a Keras model.
        - write(graphviz)   : Displays a Graphviz graph.
        - write(plotly_fig) : Displays a Plotly figure.
        - write(bokeh_fig)  : Displays a Bokeh figure.

    Example
    -------

    Its simplest use case is to draw Markdown-formatted text, whenever the
    input is a string:

    >>> write('Hello, *World!*')

    .. output::
       https://share.streamlit.io/0.25.0-2JkNY/index.html?id=DUJaq97ZQGiVAFi6YvnihF
       height: 50px

    As mentioned earlier, `st.write()` also accepts other data formats, such as
    numbers, data frames, styled data frames, and assorted objects:

    >>> st.write(1234)
    >>> st.write(pd.DataFrame({
    ...     'first column': [1, 2, 3, 4],
    ...     'second column': [10, 20, 30, 40],
    ... }))

    .. output::
       https://share.streamlit.io/0.25.0-2JkNY/index.html?id=FCp9AMJHwHRsWSiqMgUZGD
       height: 250px

    Finally, you can pass in multiple arguments to do things like:

    >>> st.write('1 + 1 = ', 2)
    >>> st.write('Below is a DataFrame:', data_frame, 'Above is a dataframe.')

    .. output::
       https://share.streamlit.io/0.25.0-2JkNY/index.html?id=DHkcU72sxYcGarkFbf4kK1
       height: 300px

    Oh, one more thing: `st.write` accepts chart objects too! For example:

    >>> import pandas as pd
    >>> import numpy as np
    >>> import altair as alt
    >>>
    >>> df = pd.DataFrame(
    ...     np.random.randn(200, 3),
    ...     columns=['a', 'b', 'c'])
    ...
    >>> c = alt.Chart(df).mark_circle().encode(
    ...     x='a', y='b', size='c', color='c')
    >>>
    >>> st.write(c)

    .. output::
       https://share.streamlit.io/0.25.0-2JkNY/index.html?id=8jmmXR8iKoZGV4kXaKGYV5
       height: 200px

    """
    try:
        string_buffer = []

        def flush_buffer():
            if string_buffer:
                markdown(' '.join(string_buffer))  # noqa: F821
                string_buffer[:] = []

        for arg in args:
            # Order matters!
            if isinstance(arg, string_types):  # noqa: F821
                string_buffer.append(arg)
            elif type(arg).__name__ in _DATAFRAME_LIKE_TYPES:
                flush_buffer()
                dataframe(arg)  # noqa: F821
            elif isinstance(arg, Exception):
                flush_buffer()
                exception(arg)  # noqa: F821
            elif isinstance(arg, _HELP_TYPES):
                flush_buffer()
                help(arg)
            elif _util.is_altair_chart(arg):
                flush_buffer()
                altair_chart(arg)
            elif _util.is_type(arg, 'matplotlib.figure.Figure'):
                flush_buffer()
                pyplot(arg)
            elif _util.is_plotly_chart(arg):
                flush_buffer()
                plotly_chart(arg)
            elif _util.is_type(arg, 'bokeh.plotting.figure.Figure'):
                flush_buffer()
                bokeh_chart(arg)
            elif _util.is_graphviz_chart(arg):
                flush_buffer()
                graphviz_chart(arg)
            elif util.is_keras_model(arg):
                from tensorflow.python.keras.utils import vis_utils
                flush_buffer()
                dot = vis_utils.model_to_dot(arg)
                graphviz_chart(dot.to_string())
            elif type(arg) in dict_types:  # noqa: F821
                flush_buffer()
                json(arg)
            else:
                string_buffer.append('`%s`' % _util.escape_markdown(str(arg)))

        flush_buffer()

    except Exception:
        _, exc, exc_tb = _sys.exc_info()
        exception(exc, exc_tb)  # noqa: F821


def show(*args):
    """Write arguments to your report for debugging purposes.

    Show() has similar properties to write():

        1. You can pass in multiple arguments, all of which will be debugged.
        2. It returns None, so it's "slot" in the report cannot be reused.

    Parameters
    ----------
    *args : any
        One or many objects to debug in the Report.

    Example
    -------

    >>> dataframe = pd.DataFrame({
    ...     'first column': [1, 2, 3, 4],
    ...     'second column': [10, 20, 30, 40],
    ... }))
    >>> st.show(dataframe)

    Notes
    -----
    This is an experimental feature with usage limitations.

    - The method must be called with the name `show`
    - Must be called in one line of code, and only once per line
    - When passing multiple arguments the inclusion of `,` or `)` in a string
    argument may cause an error.

    """
    if not args:
        return

    try:
        import inspect
        # Get the calling line of code
        previous_frame = inspect.currentframe().f_back
        lines = inspect.getframeinfo(previous_frame)[3]

        if not lines:
            warning('`show` not enabled in the shell')
            return

        # Parse arguments from the line
        line = lines[0].split('show', 1)[1]
        inputs = _code_util.get_method_args_from_code(args, line)

        # Escape markdown and add deltas
        for idx, input in enumerate(inputs):
            escaped = _util.escape_markdown(input)

            markdown('**%s**' % escaped)
            write(args[idx])

    except Exception:
        _, exc, exc_tb = _sys.exc_info()
        exception(exc, exc_tb)  # noqa: F821


@_contextlib.contextmanager
def spinner(text='In progress...'):
    """Temporarily displays a message while executing a block of code.

    Parameters
    ----------
    text : str
        A message to display while executing that block

    Example
    -------

    >>> with st.spinner('Wait for it...'):
    >>>     time.sleep(5)
    >>> st.success('Done!')

    """
    try:
        # Set the message 0.1 seconds in the future to avoid annoying
        # flickering if this spinner runs too quickly.
        DELAY_SECS = 0.1
        message = empty()  # noqa: F821
        display_message = True
        display_message_lock = _threading.Lock()

        def set_message():
            with display_message_lock:
                if display_message:
                    message.warning(str(text))

        _threading.Timer(DELAY_SECS, set_message).start()

        # Yield control back to the context.
        yield
    finally:
        with display_message_lock:
            display_message = False
        message.empty()


_SPACES_RE = _re.compile('\\s*')


@_contextlib.contextmanager
def echo():
    """Use in a `with` block to draw some code on the report, then execute it.

    Example
    -------

    >>> with st.echo():
    >>>     st.write('This code will be printed')

    """
    code = empty()  # noqa: F821
    try:
        frame = _traceback.extract_stack()[-3]
        if _is_running_py3():
            filename, start_line = frame.filename, frame.lineno
        else:
            filename, start_line = frame[:2]
        yield
        if _is_running_py3():
            end_line = _traceback.extract_stack()[-3].lineno
        else:
            end_line = _traceback.extract_stack()[-3][1]
        lines_to_display = []
        with open(filename) as source_file:
            source_lines = source_file.readlines()
            lines_to_display.extend(source_lines[start_line:end_line])
            initial_spaces = _SPACES_RE.match(lines_to_display[0]).end()
            for line in source_lines[end_line:]:
                if _SPACES_RE.match(line).end() < initial_spaces:
                    break
                lines_to_display.append(line)
        lines_to_display = _textwrap.dedent(''.join(lines_to_display))
        code.code(lines_to_display, 'python')

    except FileNotFoundError as err:  # noqa: F821
        code.warning('Unable to display code. %s' % err)


def _transparent_write(*args):
    """This is just st.write, but returns the arguments you passed to it."""
    write(*args)
    if len(args) == 1:
        return args[0]
    return args


# We want to show a warning when the user runs a Streamlit script without
# 'streamlit run', but we need to make sure the warning appears only once no
# matter how many times __init__ gets loaded.
_repl_warning_has_been_displayed = False


def _maybe_print_repl_warning():
    global _repl_warning_has_been_displayed

    if not _repl_warning_has_been_displayed:
        _repl_warning_has_been_displayed = True

        if _util.is_repl():
            _LOGGER.warning(_textwrap.dedent('''

                Will not generate Streamlit report

                  To generate report, use Streamlit in a file and run it with:
                  $ streamlit run [FILE_NAME] [ARGUMENTS]

                '''))

        elif _config.get_option('global.showWarningOnDirectExecution'):
            script_name = _sys.argv[0]

            _LOGGER.warning(_textwrap.dedent('''

                Will not generate Streamlit report

                  To generate report, run this file with:
                  $ streamlit run %s [ARGUMENTS]

                '''), script_name)
