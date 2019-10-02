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
from __future__ import print_function, division, unicode_literals, \
    absolute_import
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

# This used to be pkg_resources.require('streamlit') but it would cause
# pex files to fail. See #394 for more details.
__version__ = _pkg_resources.get_distribution("streamlit").version

# Deterministic Unique Streamlit User ID
# The try/except is needed for python 2/3 compatibility
try:
    __installation_id__ = str(
        _uuid.uuid5(_uuid.NAMESPACE_DNS, str(_uuid.getnode())))
except UnicodeDecodeError:
    __installation_id__ = str(
        _uuid.uuid5(_uuid.NAMESPACE_DNS, str(_uuid.getnode()).encode("utf-8"))
    )

import functools as _functools
import sys as _sys
import textwrap as _textwrap
import types as _types

from streamlit import util as _util
from streamlit.ReportThread import get_report_ctx
from streamlit.DeltaGenerator import DeltaGenerator as _DeltaGenerator

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
    @_functools.wraps(method)
    def wrapped_method(*args, **kwargs):
        ctx = get_report_ctx()
        dg = ctx.main_dg if ctx is not None else _NULL_DELTA_GENERATOR
        return method(dg, *args, **kwargs)

    return wrapped_method


def _reset(main_dg, sidebar_dg):
    main_dg._reset()
    sidebar_dg._reset()
    global sidebar
    sidebar = sidebar_dg


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
graphviz_chart = _with_dg(_DeltaGenerator.graphviz_chart)  # noqa: E221
header = _with_dg(_DeltaGenerator.header)  # noqa: E221
help = _with_dg(_DeltaGenerator.help)  # noqa: E221
image = _with_dg(_DeltaGenerator.image)  # noqa: E221
info = _with_dg(_DeltaGenerator.info)  # noqa: E221
json = _with_dg(_DeltaGenerator.json)  # noqa: E221
line_chart = _with_dg(_DeltaGenerator.line_chart)  # noqa: E221
map = _with_dg(_DeltaGenerator.map)  # noqa: E221
markdown = _with_dg(_DeltaGenerator.markdown)  # noqa: E221
multiselect = _with_dg(_DeltaGenerator.multiselect)  # noqa: E221
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
write = _with_dg(_DeltaGenerator.write)  # noqa: E221
show = _with_dg(_DeltaGenerator.show)  # noqa: E221
spinner = _with_dg(_DeltaGenerator.spinner)  # noqa: E221
echo = _with_dg(_DeltaGenerator.echo)  # noqa: E221

_text_exception = _with_dg(_DeltaGenerator._text_exception)  # noqa: E221

# Config
set_option = _config.set_option
get_option = _config.get_option

# Special methods:

_DATAFRAME_LIKE_TYPES = (
    "DataFrame",  # pandas.core.frame.DataFrame
    "Index",  # pandas.core.indexes.base.Index
    "Series",  # pandas.core.series.Series
    "Styler",  # pandas.io.formats.style.Styler
    "ndarray",  # numpy.ndarray
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
