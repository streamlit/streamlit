# Copyright 2018-2021 Streamlit Inc.
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

# Must be at the top, to avoid circular dependency.
from streamlit import logger as _logger
from streamlit import config as _config
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.secrets import Secrets, SECRETS_FILE_LOC

_LOGGER = _logger.get_logger("root")

# Give the package a version.
import pkg_resources as _pkg_resources
from typing import List

# This used to be pkg_resources.require('streamlit') but it would cause
# pex files to fail. See #394 for more details.
__version__ = _pkg_resources.get_distribution("streamlit-nightly").version

import contextlib as _contextlib
import re as _re
import sys as _sys
import textwrap as _textwrap
import threading as _threading
import traceback as _traceback
import urllib.parse as _parse

import click as _click

from streamlit import code_util as _code_util
from streamlit import env_util as _env_util
from streamlit import source_util as _source_util
from streamlit import string_util as _string_util
from streamlit.delta_generator import DeltaGenerator as _DeltaGenerator
from streamlit.report_thread import add_report_ctx as _add_report_ctx
from streamlit.report_thread import get_report_ctx as _get_report_ctx
from streamlit.script_runner import StopException
from streamlit.script_runner import RerunException as _RerunException
from streamlit.script_request_queue import RerunData as _RerunData
from streamlit.errors import StreamlitAPIException
from streamlit.proto import ForwardMsg_pb2 as _ForwardMsg_pb2

# Modules that the user should have access to. These are imported with "as"
# syntax pass mypy checking with implicit_reexport disabled.
from streamlit.caching import cache as cache

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


_main = _DeltaGenerator(root_container=RootContainer.MAIN)
sidebar = _DeltaGenerator(root_container=RootContainer.SIDEBAR, parent=_main)

secrets = Secrets(SECRETS_FILE_LOC)

# DeltaGenerator methods:

altair_chart = _main.altair_chart
area_chart = _main.area_chart
audio = _main.audio
balloons = _main.balloons
bar_chart = _main.bar_chart
bokeh_chart = _main.bokeh_chart
button = _main.button
caption = _main.caption
checkbox = _main.checkbox
code = _main.code
columns = _main.columns
container = _main.container
dataframe = _main.dataframe
date_input = _main.date_input
expander = _main.expander
pydeck_chart = _main.pydeck_chart
empty = _main.empty
error = _main.error
exception = _main.exception
file_uploader = _main.file_uploader
form = _main.form
form_submit_button = _main.form_submit_button
graphviz_chart = _main.graphviz_chart
header = _main.header
help = _main.help
image = _main.image
info = _main.info
json = _main.json
latex = _main.latex
line_chart = _main.line_chart
map = _main.map
markdown = _main.markdown
multiselect = _main.multiselect
number_input = _main.number_input
plotly_chart = _main.plotly_chart
progress = _main.progress
pyplot = _main.pyplot
radio = _main.radio
selectbox = _main.selectbox
select_slider = _main.select_slider
slider = _main.slider
subheader = _main.subheader
success = _main.success
table = _main.table
text = _main.text
text_area = _main.text_area
text_input = _main.text_input
time_input = _main.time_input
title = _main.title
vega_lite_chart = _main.vega_lite_chart
video = _main.video
warning = _main.warning
write = _main.write
color_picker = _main.color_picker

# Legacy
_legacy_dataframe = _main._legacy_dataframe
_legacy_table = _main._legacy_table
_legacy_altair_chart = _main._legacy_altair_chart
_legacy_area_chart = _main._legacy_area_chart
_legacy_bar_chart = _main._legacy_bar_chart
_legacy_line_chart = _main._legacy_line_chart
_legacy_vega_lite_chart = _main._legacy_vega_lite_chart

# Apache Arrow
_arrow_dataframe = _main._arrow_dataframe
_arrow_table = _main._arrow_table
_arrow_altair_chart = _main._arrow_altair_chart
_arrow_area_chart = _main._arrow_area_chart
_arrow_bar_chart = _main._arrow_bar_chart
_arrow_line_chart = _main._arrow_line_chart
_arrow_vega_lite_chart = _main._arrow_vega_lite_chart

# Config
get_option = _config.get_option
from streamlit.commands.page_config import set_page_config

# Session State

from streamlit.state.session_state import LazySessionState

session_state = LazySessionState()


# Beta APIs

beta_container = _main.beta_container
beta_expander = _main.beta_expander
beta_columns = _main.beta_columns


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
    opt = _config._config_options_template[key]
    if opt.scriptable:
        _config.set_option(key, value)
        return

    raise StreamlitAPIException(
        "{key} cannot be set on the fly. Set as command line option, e.g. streamlit run script.py --{key}, or in config.toml instead.".format(
            key=key
        )
    )


def experimental_show(*args):
    """Write arguments and *argument names* to your app for debugging purposes.

    Show() has similar properties to write():

        1. You can pass in multiple arguments, all of which will be debugged.
        2. It returns None, so it's "slot" in the app cannot be reused.

    Note: This is an experimental feature. See
    https://docs.streamlit.io/en/latest/api.html#pre-release-features for more information.

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
        placeholder = empty()
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
_use_warning_has_been_displayed = False


def _maybe_print_use_warning():
    """Print a warning if Streamlit is imported but not being run with `streamlit run`.
    The warning is printed only once.
    """
    global _use_warning_has_been_displayed

    if not _use_warning_has_been_displayed:
        _use_warning_has_been_displayed = True

        warning = _click.style("Warning:", bold=True, fg="yellow")

        if _env_util.is_repl():
            _LOGGER.warning(
                f"\n  {warning} to view a Streamlit app on a browser, use Streamlit in a file and\n  run it with the following command:\n\n    streamlit run [FILE_NAME] [ARGUMENTS]"
            )

        elif not _is_running_with_streamlit and _config.get_option(
            "global.showWarningOnDirectExecution"
        ):
            script_name = _sys.argv[0]

            _LOGGER.warning(
                f"\n  {warning} to view this Streamlit app on a browser, run it with the following\n  command:\n\n    streamlit run {script_name} [ARGUMENTS]"
            )


def stop():
    """Stops execution immediately.

    Streamlit will not run any statements after `st.stop()`.
    We recommend rendering a message to explain why the script has stopped.
    When run outside of Streamlit, this will raise an Exception.

    Example
    -------

    >>> name = st.text_input('Name')
    >>> if not name:
    >>>   st.warning('Please input a name.')
    >>>   st.stop()
    >>> st.success('Thank you for inputting a name.')

    """
    raise StopException()


def experimental_rerun():
    """Rerun the script immediately.

    When `st.experimental_rerun()` is called, the script is halted - no
    more statements will be run, and the script will be queued to re-run
    from the top.

    If this function is called outside of Streamlit, it will raise an
    Exception.
    """

    raise _RerunException(_RerunData(None))
