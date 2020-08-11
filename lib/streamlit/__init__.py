# Copyright 2018-2020 Streamlit Inc.
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

For more detailed info, see https://docs.streamlit.io.
"""

# IMPORTANT: Prefix with an underscore anything that the user shouldn't see.

# NOTE: You'll see lots of "noqa: F821" in this file. That's because we
# manually mess with the local namespace so the linter can't know that some
# identifiers actually exist in the namespace.

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
from typing import Any, List, Tuple, Type

# This used to be pkg_resources.require('streamlit') but it would cause
# pex files to fail. See #394 for more details.
__version__ = _pkg_resources.get_distribution("streamlit").version

# Deterministic Unique Streamlit User ID
if (
    platform.system() == "Linux"
    and os.path.isfile("/etc/machine-id") == False
    and os.path.isfile("/var/lib/dbus/machine-id") == False
):
    print("Generate machine-id")
    subprocess.run(["sudo", "dbus-uuidgen", "--ensure"])

machine_id = str(_uuid.getnode())
if os.path.isfile("/etc/machine-id"):
    with open("/etc/machine-id", "r") as f:
        machine_id = f.read()
elif os.path.isfile("/var/lib/dbus/machine-id"):
    with open("/var/lib/dbus/machine-id", "r") as f:
        machine_id = f.read()

__installation_id__ = str(_uuid.uuid5(_uuid.NAMESPACE_DNS, machine_id))


import contextlib as _contextlib
import re as _re
import sys as _sys
import textwrap as _textwrap
import threading as _threading
import traceback as _traceback
import types as _types
import json as _json
import numpy as _np
import urllib.parse as _parse

from streamlit import code_util as _code_util
from streamlit import env_util as _env_util
from streamlit import source_util as _source_util
from streamlit import string_util as _string_util
from streamlit import type_util as _type_util
from streamlit.delta_generator import DeltaGenerator as _DeltaGenerator
from streamlit.report_thread import add_report_ctx as _add_report_ctx
from streamlit.report_thread import get_report_ctx as _get_report_ctx
from streamlit.script_runner import StopException
from streamlit.errors import StreamlitAPIException
from streamlit.proto import BlockPath_pb2 as _BlockPath_pb2
from streamlit.proto import ForwardMsg_pb2 as _ForwardMsg_pb2

# Modules that the user should have access to. These are imported with "as"
# syntax pass mypy checking with implicit_reexport disabled.
from streamlit.caching import cache as cache  # noqa: F401

# This is set to True inside cli._main_run(), and is False otherwise.
# If False, we should assume that DeltaGenerator functions are effectively
# no-ops, and adapt gracefully.
_is_running_with_streamlit = False


def _update_logger():
    _logger.set_log_level(_config.get_option("logger.level").upper())
    _logger.update_formatter()
    _logger.init_tornado_logs()


# Make this file only depend on config option in an asynchronous manner. This
# avoids a race condition when another file (such as a test file) tries to pass
# in an alternative config.
_config.on_config_parsed(_update_logger, True)


_main = _DeltaGenerator(container=_BlockPath_pb2.BlockPath.MAIN)
sidebar = _DeltaGenerator(container=_BlockPath_pb2.BlockPath.SIDEBAR)

# DeltaGenerator methods:

altair_chart = _main.altair_chart  # noqa: E221
area_chart = _main.area_chart  # noqa: E221
audio = _main.audio  # noqa: E221
balloons = _main.balloons  # noqa: E221
bar_chart = _main.bar_chart  # noqa: E221
bokeh_chart = _main.bokeh_chart  # noqa: E221
button = _main.button  # noqa: E221
checkbox = _main.checkbox  # noqa: E221
code = _main.code  # noqa: E221
dataframe = _main.dataframe  # noqa: E221
date_input = _main.date_input  # noqa: E221
deck_gl_chart = _main.deck_gl_chart  # noqa: E221
pydeck_chart = _main.pydeck_chart  # noqa: E221
empty = _main.empty  # noqa: E221
error = _main.error  # noqa: E221
exception = _main.exception  # noqa: E221
file_uploader = _main.file_uploader  # noqa: E221
graphviz_chart = _main.graphviz_chart  # noqa: E221
header = _main.header  # noqa: E221
help = _main.help  # noqa: E221
image = _main.image  # noqa: E221
info = _main.info  # noqa: E221
json = _main.json  # noqa: E221
latex = _main.latex  # noqa: E221
line_chart = _main.line_chart  # noqa: E221
map = _main.map  # noqa: E221
markdown = _main.markdown  # noqa: E221
multiselect = _main.multiselect  # noqa: E221
number_input = _main.number_input  # noqa: E221
plotly_chart = _main.plotly_chart  # noqa: E221
progress = _main.progress  # noqa: E221
pyplot = _main.pyplot  # noqa: E221
radio = _main.radio  # noqa: E221
selectbox = _main.selectbox  # noqa: E221
slider = _main.slider  # noqa: E221
subheader = _main.subheader  # noqa: E221
success = _main.success  # noqa: E221
table = _main.table  # noqa: E221
text = _main.text  # noqa: E221
text_area = _main.text_area  # noqa: E221
text_input = _main.text_input  # noqa: E221
time_input = _main.time_input  # noqa: E221
title = _main.title  # noqa: E221
vega_lite_chart = _main.vega_lite_chart  # noqa: E221
video = _main.video  # noqa: E221
warning = _main.warning  # noqa: E221
beta_color_picker = _main.beta_color_picker  # noqa: E221

# Config

get_option = _config.get_option
from streamlit.commands.page_config import beta_set_page_config


def set_option(key, value):
    """Set config option.

    Currently, only the following config options can be set within the script itself:
        * client.caching
        * client.displayEnabled
        * deprecation.*

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
)  # type: Tuple[Type[Any], ...]


def write(*args, **kwargs):
    """Write arguments to the app.

    This is the Swiss Army knife of Streamlit commands: it does different
    things depending on what you throw at it. Unlike other Streamlit commands,
    write() has some unique properties:

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

        **Also note that `unsafe_allow_html` is a temporary measure and may be
        removed from Streamlit at any time.**

        If you decide to turn on HTML anyway, we ask you to please tell us your
        exact use case here:
        https://discuss.streamlit.io/t/96 .

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
    ...     x='a', y='b', size='c', color='c', tooltip=['a', 'b', 'c'])
    >>>
    >>> st.write(c)

    .. output::
       https://share.streamlit.io/0.25.0-2JkNY/index.html?id=8jmmXR8iKoZGV4kXaKGYV5
       height: 200px

    """
    try:
        string_buffer = []  # type: List[str]
        unsafe_allow_html = kwargs.get("unsafe_allow_html", False)

        def flush_buffer():
            if string_buffer:
                markdown(
                    " ".join(string_buffer), unsafe_allow_html=unsafe_allow_html,
                )  # noqa: F821
                string_buffer[:] = []

        for arg in args:
            # Order matters!
            if isinstance(arg, str):
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
            elif isinstance(arg, (dict, list)):
                flush_buffer()
                json(arg)
            elif _type_util.is_namedtuple(arg):
                flush_buffer()
                json(_json.dumps(arg._asdict()))
            elif _type_util.is_pydeck(arg):
                flush_buffer()
                pydeck_chart(arg)
            else:
                string_buffer.append("`%s`" % str(arg).replace("`", "\\`"))

        flush_buffer()

    except Exception as exc:
        exception(exc)


def experimental_show(*args):
    """Write arguments and *argument names* to your app for debugging purposes.

    Show() has similar properties to write():

        1. You can pass in multiple arguments, all of which will be debugged.
        2. It returns None, so it's "slot" in the app cannot be reused.

    Note: This is an experimental feature. See
    https://docs.streamlit.io/en/latest/pre_release_features.html for more information.

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
    >>> st.experimental_show(dataframe)

    Notes
    -----

    This is an experimental feature with usage limitations:

    - The method must be called with the name `show`.
    - Must be called in one line of code, and only once per line.
    - When passing multiple arguments the inclusion of `,` or `)` in a string
    argument may cause an error.

    """
    if not args:
        return

    try:
        import inspect

        # Get the calling line of code
        current_frame = inspect.currentframe()
        if current_frame is None:
            warning("`show` not enabled in the shell")
            return
        lines = inspect.getframeinfo(current_frame.f_back)[3]

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
        exception(exc)


def experimental_get_query_params():
    """Return the query parameters that is currently showing in the browser's URL bar.

    Returns
    -------
    dict
      The current query parameters as a dict. "Query parameters" are the part of the URL that comes
      after the first "?".

    Example
    -------

    Let's say the user's web browser is at
    `http://localhost:8501/?show_map=True&selected=asia&selected=america`.
    Then, you can get the query parameters using the following:

    >>> st.experimental_get_query_params()
    {"show_map": ["True"], "selected": ["asia", "america"]}

    Note that the values in the returned dict are *always* lists. This is
    because we internally use Python's urllib.parse.parse_qs(), which behaves
    this way. And this behavior makes sense when you consider that every item
    in a query string is potentially a 1-element array.

    """
    ctx = _get_report_ctx()
    if ctx is None:
        return ""
    return _parse.parse_qs(ctx.query_string)


def experimental_set_query_params(**query_params):
    """Set the query parameters that are shown in the browser's URL bar.

    Parameters
    ----------
    **query_params : dict
        The query parameters to set, as key-value pairs.

    Example
    -------

    To point the user's web browser to something like
    "http://localhost:8501/?show_map=True&selected=asia&selected=america",
    you would do the following:

    >>> st.experimental_set_query_params(
    ...     show_map=True,
    ...     selected=["asia", "america"],
    ... )

    """
    ctx = _get_report_ctx()
    if ctx is None:
        return
    ctx.query_string = _parse.urlencode(query_params, doseq=True)
    msg = _ForwardMsg_pb2.ForwardMsg()
    msg.page_info_changed.query_string = ctx.query_string
    ctx.enqueue(msg)


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
def echo(code_location="above"):
    """Use in a `with` block to draw some code on the app, then execute it.

    Parameters
    ----------
    code_location : "above" or "below"
        Whether to show the echoed code before or after the results of the
        executed code block.

    Example
    -------

    >>> with st.echo():
    >>>     st.write('This code will be printed')

    """
    if code_location == "below":
        show_code = code
        show_warning = warning
    else:
        placeholder = empty()  # noqa: F821
        show_code = placeholder.code
        show_warning = placeholder.warning

    try:
        frame = _traceback.extract_stack()[-3]
        filename, start_line = frame.filename, frame.lineno
        yield
        frame = _traceback.extract_stack()[-3]
        end_line = frame.lineno
        lines_to_display = []  # type: List[str]
        with _source_util.open_python_file(filename) as source_file:
            source_lines = source_file.readlines()
            lines_to_display.extend(source_lines[start_line:end_line])
            match = _SPACES_RE.match(lines_to_display[0])
            initial_spaces = match.end() if match else 0
            for line in source_lines[end_line:]:
                match = _SPACES_RE.match(line)
                indentation = match.end() if match else 0
                # The != 1 is because we want to allow '\n' between sections.
                if indentation != 1 and indentation < initial_spaces:
                    break
                lines_to_display.append(line)
        line_to_display = _textwrap.dedent("".join(lines_to_display))

        show_code(line_to_display, "python")

    except FileNotFoundError as err:
        show_warning("Unable to display code. %s" % err)


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


def stop():
    """Stops excecution immediately. Streamlit will not run any statements
    after `st.stop()`. We recommend rendering an informational message that
    would explain the stop in execution. When run outside of Streamlit, it
    will raise an Exception

    Example
    -------

    >>> name = st.text_input('Name')
    >>> if not name:
    >>>   st.warning('Please input a name.')
    >>>   st.stop()
    >>> st.success('Thank you for inputting a name.')

    """
    raise StopException()
