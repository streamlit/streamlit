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

"""Streamlit.

How to use Streamlit in 3 seconds:

    1. Write an app
    >>> import streamlit as st
    >>> st.write(anything_you_want)

    2. Run your app
    $ streamlit run my_script.py

    3. Use your app
    A new tab will open on your browser. That's your Streamlit app!

    4. Modify your code, save it, and watch changes live on your browser.

Take a look at the other commands in this module to find out what else
Streamlit can do:

    >>> dir(streamlit)

Or try running our "Hello World":

    $ streamlit hello

For more detailed info, see https://streamlit.io/docs.
"""

# IMPORTANT: Prefix with an underscore anything that the user shouldn't see.

# NOTE: You'll see lots of "noqa: F821" in this file. That's because we
# manually mess with the local namespace so the linter can't know that some
# identifiers actually exist in the namespace.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import (
    setup_2_3_shims as _setup_2_3_shims,
    is_running_py3 as _is_running_py3,
)

_setup_2_3_shims(globals())

# Must be at the top, to avoid circular dependency.
from streamlit import logger as _logger
from streamlit import config as _config

_LOGGER = _logger.get_logger("root")

# Give the package a version.
import pkg_resources as _pkg_resources
import uuid as _uuid
import subprocess
import platform
import os

# This used to be pkg_resources.require('streamlit') but it would cause
# pex files to fail. See #394 for more details.
__version__ = _pkg_resources.get_distribution("streamlit").version

# Deterministic Unique Streamlit User ID
# The try/except is needed for python 2/3 compatibility
try:

    if (
        platform.system() == "Linux"
        and os.path.isfile("/etc/machine-id") == False
        and os.path.isfile("/var/lib/dbus/machine-id") == False
    ):
        print("Generate machine-id")
        subprocess.run(["sudo", "dbus-uuidgen", "--ensure"])

    machine_id = _uuid.getnode()
    if os.path.isfile("/etc/machine-id"):
        with open("/etc/machine-id", "r") as f:
            machine_id = f.read()
    elif os.path.isfile("/var/lib/dbus/machine-id"):
        with open("/var/lib/dbus/machine-id", "r") as f:
            machine_id = f.read()

    __installation_id__ = str(_uuid.uuid5(_uuid.NAMESPACE_DNS, str(machine_id)))

except UnicodeDecodeError:
    __installation_id__ = str(
        _uuid.uuid5(_uuid.NAMESPACE_DNS, str(_uuid.getnode()).encode("utf-8"))
    )

import contextlib as _contextlib
import re as _re
import sys as _sys
import textwrap as _textwrap
import threading as _threading
import traceback as _traceback
import types as _types
import json as _json
import numpy as _np

from streamlit.util import functools_wraps as _functools_wraps
from streamlit import code_util as _code_util
from streamlit import env_util as _env_util
from streamlit import string_util as _string_util
from streamlit import type_util as _type_util
from streamlit import source_util as _source_util
from streamlit.ReportThread import get_report_ctx as _get_report_ctx
from streamlit.ReportThread import add_report_ctx as _add_report_ctx
from streamlit.DeltaGenerator import DeltaGenerator as _DeltaGenerator
from streamlit.errors import StreamlitAPIException

# Modules that the user should have access to.
from streamlit.caching import cache  # noqa: F401

# Delta generator with no queue so it can't send anything out.
_NULL_DELTA_GENERATOR = _DeltaGenerator(None)

# This is set to True inside cli._main_run(), and is False otherwise.
# If False, we should assume that DeltaGenerator functions are effectively
# no-ops, and adapt gracefully.
_is_running_with_streamlit = False


def _set_log_level():
    _logger.set_log_level(_config.get_option("global.logLevel").upper())
    _logger.init_tornado_logs()


# Make this file only depend on config option in an asynchronous manner. This
# avoids a race condition when another file (such as a test file) tries to pass
# in an alternative config.
_config.on_config_parsed(_set_log_level)


def _with_dg(method):
    @_functools_wraps(method)
    def wrapped_method(*args, **kwargs):
        ctx = _get_report_ctx()
        dg = ctx.main_dg if ctx is not None else _NULL_DELTA_GENERATOR
        return method.__get__(dg)(*args, **kwargs)

    return wrapped_method


def _reset(main_dg, sidebar_dg):
    main_dg._reset()
    sidebar_dg._reset()
    global sidebar
    sidebar = sidebar_dg
    _get_report_ctx().widget_ids_this_run.clear()


# Sidebar
sidebar = _NULL_DELTA_GENERATOR

# DeltaGenerator methods:

altair_chart = _with_dg(_DeltaGenerator.altair_chart)  # noqa: E221
area_chart = _with_dg(_DeltaGenerator.area_chart)  # noqa: E221
audio = _with_dg(_DeltaGenerator.audio)  # noqa: E221
balloons = _with_dg(_DeltaGenerator.balloons)  # noqa: E221
bar_chart = _with_dg(_DeltaGenerator.bar_chart)  # noqa: E221
bokeh_chart = _with_dg(_DeltaGenerator.bokeh_chart)  # noqa: E221
button = _with_dg(_DeltaGenerator.button)  # noqa: E221
checkbox = _with_dg(_DeltaGenerator.checkbox)  # noqa: E221
code = _with_dg(_DeltaGenerator.code)  # noqa: E221
dataframe = _with_dg(_DeltaGenerator.dataframe)  # noqa: E221
date_input = _with_dg(_DeltaGenerator.date_input)  # noqa: E221
deck_gl_chart = _with_dg(_DeltaGenerator.deck_gl_chart)  # noqa: E221
empty = _with_dg(_DeltaGenerator.empty)  # noqa: E221
error = _with_dg(_DeltaGenerator.error)  # noqa: E221
exception = _with_dg(_DeltaGenerator.exception)  # noqa: E221
file_uploader = _with_dg(_DeltaGenerator.file_uploader)  # noqa: E221
graphviz_chart = _with_dg(_DeltaGenerator.graphviz_chart)  # noqa: E221
header = _with_dg(_DeltaGenerator.header)  # noqa: E221
help = _with_dg(_DeltaGenerator.help)  # noqa: E221
image = _with_dg(_DeltaGenerator.image)  # noqa: E221
info = _with_dg(_DeltaGenerator.info)  # noqa: E221
json = _with_dg(_DeltaGenerator.json)  # noqa: E221
latex = _with_dg(_DeltaGenerator.latex)  # noqa: E221
line_chart = _with_dg(_DeltaGenerator.line_chart)  # noqa: E221
map = _with_dg(_DeltaGenerator.map)  # noqa: E221
markdown = _with_dg(_DeltaGenerator.markdown)  # noqa: E221
multiselect = _with_dg(_DeltaGenerator.multiselect)  # noqa: E221
number_input = _with_dg(_DeltaGenerator.number_input)  # noqa: E221
plotly_chart = _with_dg(_DeltaGenerator.plotly_chart)  # noqa: E221
progress = _with_dg(_DeltaGenerator.progress)  # noqa: E221
pyplot = _with_dg(_DeltaGenerator.pyplot)  # noqa: E221
radio = _with_dg(_DeltaGenerator.radio)  # noqa: E221
selectbox = _with_dg(_DeltaGenerator.selectbox)  # noqa: E221
slider = _with_dg(_DeltaGenerator.slider)  # noqa: E221
subheader = _with_dg(_DeltaGenerator.subheader)  # noqa: E221
success = _with_dg(_DeltaGenerator.success)  # noqa: E221
table = _with_dg(_DeltaGenerator.table)  # noqa: E221
text = _with_dg(_DeltaGenerator.text)  # noqa: E221
text_area = _with_dg(_DeltaGenerator.text_area)  # noqa: E221
text_input = _with_dg(_DeltaGenerator.text_input)  # noqa: E221
time_input = _with_dg(_DeltaGenerator.time_input)  # noqa: E221
title = _with_dg(_DeltaGenerator.title)  # noqa: E221
vega_lite_chart = _with_dg(_DeltaGenerator.vega_lite_chart)  # noqa: E221
video = _with_dg(_DeltaGenerator.video)  # noqa: E221
warning = _with_dg(_DeltaGenerator.warning)  # noqa: E221

# Config

get_option = _config.get_option


def set_option(key, value):
    """Set config option.

    Currently, only two config options can be set within the script itself:
        * client.caching
        * client.displayEnabled

    Calling with any other options will raise StreamlitAPIException.

    Run `streamlit config show` in the terminal to see all available options.

    Parameters
    ----------
    key : str
        The config option key of the form "section.optionName". To see all
        available options, run `streamlit config show` on a terminal.

    value
        The new value to assign to this config option.

    """
    opt = _config._config_options[key]
    if opt.scriptable:
        _config.set_option(key, value)
        return

    raise StreamlitAPIException(
        "{key} cannot be set on the fly. Set as command line option, e.g. streamlit run script.py --{key}, or in config.toml instead.".format(
            key=key
        )
    )


# Special methods:

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


def write(*args, **kwargs):
    """Write arguments to the app.

    This is the swiss-army knife of Streamlit commands. It does different
    things depending on what you throw at it.

    Unlike other Streamlit commands, write() has some unique properties:

        1. You can pass in multiple arguments, all of which will be written.
        2. Its behavior depends on the input types as follows.
        3. It returns None, so it's "slot" in the App cannot be reused.

    Parameters
    ----------
    *args : any
        One or many objects to print to the App.

        Arguments are handled as follows:

            - write(string)     : Prints the formatted Markdown string, with
              support for LaTeX expression and emoji shortcodes.
              See docs for st.markdown for more.
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
            - write(sympy_expr) : Prints SymPy expression using LaTeX.

    unsafe_allow_html : bool
        This is a keyword-only argument that defaults to False.

        By default, any HTML tags found in strings will be escaped and
        therefore treated as pure text. This behavior may be turned off by
        setting this argument to True.

        That said, *we strongly advise* against it*. It is hard to write secure
        HTML, so by using this argument you may be compromising your users'
        security. For more information, see:

        https://github.com/streamlit/streamlit/issues/152

        *Also note that `unsafe_allow_html` is a temporary measure and may be
        removed from Streamlit at any time.*

        If you decide to turn on HTML anyway, we ask you to please tell us your
        exact use case here:

        https://discuss.streamlit.io/t/96

        This will help us come up with safe APIs that allow you to do what you
        want.

    Example
    -------

    Its simplest use case is to draw Markdown-formatted text, whenever the
    input is a string:

    >>> write('Hello, *World!* :sunglasses:')

    .. output::
       https://share.streamlit.io/0.50.2-ZWk9/index.html?id=Pn5sjhgNs4a8ZbiUoSTRxE
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
    # Python2 doesn't support this syntax
    #   def write(*args, unsafe_allow_html=False)
    # so we do this instead:
    unsafe_allow_html = kwargs.get("unsafe_allow_html", False)

    try:
        string_buffer = []

        def flush_buffer():
            if string_buffer:
                markdown(
                    " ".join(string_buffer), unsafe_allow_html=unsafe_allow_html
                )  # noqa: F821
                string_buffer[:] = []

        for arg in args:
            # Order matters!
            if isinstance(arg, string_types):  # noqa: F821
                string_buffer.append(arg)
            elif _type_util.is_dataframe_like(arg):
                flush_buffer()
                if len(_np.shape(arg)) > 2:
                    text(arg)
                else:
                    dataframe(arg)  # noqa: F821
            elif isinstance(arg, Exception):
                flush_buffer()
                exception(arg)  # noqa: F821
            elif isinstance(arg, _HELP_TYPES):
                flush_buffer()
                help(arg)
            elif _type_util.is_altair_chart(arg):
                flush_buffer()
                altair_chart(arg)
            elif _type_util.is_type(arg, "matplotlib.figure.Figure"):
                flush_buffer()
                pyplot(arg)
            elif _type_util.is_plotly_chart(arg):
                flush_buffer()
                plotly_chart(arg)
            elif _type_util.is_type(arg, "bokeh.plotting.figure.Figure"):
                flush_buffer()
                bokeh_chart(arg)
            elif _type_util.is_graphviz_chart(arg):
                flush_buffer()
                graphviz_chart(arg)
            elif _type_util.is_sympy_expession(arg):
                flush_buffer()
                latex(arg)
            elif _type_util.is_keras_model(arg):
                from tensorflow.python.keras.utils import vis_utils

                flush_buffer()
                dot = vis_utils.model_to_dot(arg)
                graphviz_chart(dot.to_string())
            elif (type(arg) in dict_types) or (isinstance(arg, list)):  # noqa: F821
                flush_buffer()
                json(arg)
            elif _type_util.is_namedtuple(arg):
                flush_buffer()
                json(_json.dumps(arg._asdict()))
            else:
                string_buffer.append("`%s`" % str(arg).replace("`", "\\`"))

        flush_buffer()

    except Exception:
        _, exc, exc_tb = _sys.exc_info()
        exception(exc, exc_tb)  # noqa: F821


def show(*args):
    """Write arguments to your app for debugging purposes.

    Show() has similar properties to write():

        1. You can pass in multiple arguments, all of which will be debugged.
        2. It returns None, so it's "slot" in the app cannot be reused.

    Parameters
    ----------
    *args : any
        One or many objects to debug in the App.

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
            warning("`show` not enabled in the shell")
            return

        # Parse arguments from the line
        line = lines[0].split("show", 1)[1]
        inputs = _code_util.get_method_args_from_code(args, line)

        # Escape markdown and add deltas
        for idx, input in enumerate(inputs):
            escaped = _string_util.escape_markdown(input)

            markdown("**%s**" % escaped)
            write(args[idx])

    except Exception:
        _, exc, exc_tb = _sys.exc_info()
        exception(exc, exc_tb)  # noqa: F821


@_contextlib.contextmanager
def spinner(text="In progress..."):
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
    import streamlit.caching as caching

    display_message_lock = None

    # @st.cache optionally uses spinner for long-running computations.
    # Normally, streamlit warns the user when they call st functions
    # from within an @st.cache'd function. But we do *not* want to show
    # these warnings for spinner's message, so we create and mutate this
    # message delta within the "suppress_cached_st_function_warning"
    # context.
    with caching.suppress_cached_st_function_warning():
        message = empty()

    try:
        # Set the message 0.1 seconds in the future to avoid annoying
        # flickering if this spinner runs too quickly.
        DELAY_SECS = 0.1
        display_message = True
        display_message_lock = _threading.Lock()

        def set_message():
            with display_message_lock:
                if display_message:
                    with caching.suppress_cached_st_function_warning():
                        message.warning(str(text))

        _add_report_ctx(_threading.Timer(DELAY_SECS, set_message)).start()

        # Yield control back to the context.
        yield
    finally:
        if display_message_lock:
            with display_message_lock:
                display_message = False
        with caching.suppress_cached_st_function_warning():
            message.empty()


_SPACES_RE = _re.compile("\\s*")


@_contextlib.contextmanager
def echo():
    """Use in a `with` block to draw some code on the app, then execute it.

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
        frame = _traceback.extract_stack()[-3]
        if _is_running_py3():
            end_line = frame.lineno
        else:
            end_line = frame[1]
        lines_to_display = []
        with _source_util.open_python_file(filename) as source_file:
            source_lines = source_file.readlines()
            lines_to_display.extend(source_lines[start_line:end_line])
            initial_spaces = _SPACES_RE.match(lines_to_display[0]).end()
            for line in source_lines[end_line:]:
                indentation = _SPACES_RE.match(line).end()
                # The != 1 is because we want to allow '\n' between sections.
                if indentation != 1 and indentation < initial_spaces:
                    break
                lines_to_display.append(line)
        lines_to_display = _textwrap.dedent("".join(lines_to_display))
        code.code(lines_to_display, "python")

    except FileNotFoundError as err:  # noqa: F821
        code.warning("Unable to display code. %s" % err)


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

        if _env_util.is_repl():
            _LOGGER.warning(
                _textwrap.dedent(
                    """

                Will not generate Streamlit app

                  To generate an app, use Streamlit in a file and run it with:
                  $ streamlit run [FILE_NAME] [ARGUMENTS]

                """
                )
            )

        elif _config.get_option("global.showWarningOnDirectExecution"):
            script_name = _sys.argv[0]

            _LOGGER.warning(
                _textwrap.dedent(
                    """

                Will not generate Streamlit App

                  To generate an App, run this file with:
                  $ streamlit run %s [ARGUMENTS]

                """
                ),
                script_name,
            )
