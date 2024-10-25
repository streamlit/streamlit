# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# isort: skip_file

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

import os as _os

# Set Matplotlib backend to avoid a crash.
# The default Matplotlib backend crashes Python on OSX when run on a thread
# that's not the main thread, so here we set a safer backend as a fix.
# This fix is OS-independent. We didn't see a good reason to make this
# Mac-only. Consistency within Streamlit seemed more important.
# IMPORTANT: This needs to run on top of all imports before any other
# import of matplotlib could happen.
_os.environ["MPLBACKEND"] = "Agg"


# Must be at the top, to avoid circular dependency.
from streamlit import logger as _logger
from streamlit import config as _config
from streamlit.deprecation_util import deprecate_func_name as _deprecate_func_name
from streamlit.version import STREAMLIT_VERSION_STRING as _STREAMLIT_VERSION_STRING

# Give the package a version.
__version__ = _STREAMLIT_VERSION_STRING

# DeltaGenerator methods:
# We initialize them here so that it is clear where they are instantiated.
# Further, it helps us to break circular imports because the DeltaGenerator
# imports the different elements but some elements also require DeltaGenerator
# functions such as the dg_stack. Now, elements that require DeltaGenerator functions
# can import the singleton module.
from streamlit.delta_generator_singletons import (
    DeltaGeneratorSingleton as _DeltaGeneratorSingleton,
)
from streamlit.delta_generator import DeltaGenerator as _DeltaGenerator
from streamlit.elements.lib.mutable_status_container import (
    StatusContainer as _StatusContainer,
)
from streamlit.elements.lib.dialog import Dialog as _Dialog

# instantiate the DeltaGeneratorSingleton
_dg_singleton = _DeltaGeneratorSingleton(
    delta_generator_cls=_DeltaGenerator,
    status_container_cls=_StatusContainer,
    dialog_container_cls=_Dialog,
)
_main = _dg_singleton._main_dg
sidebar = _dg_singleton._sidebar_dg
_event = _dg_singleton._event_dg
_bottom = _dg_singleton._bottom_dg


from streamlit.elements.dialog_decorator import (
    dialog_decorator as _dialog_decorator,
    experimental_dialog_decorator as _experimental_dialog_decorator,
)
from streamlit.runtime.caching import (
    cache_resource as _cache_resource,
    cache_data as _cache_data,
    cache as _cache,
)
from streamlit.runtime.connection_factory import (
    connection_factory as _connection,
)
from streamlit.runtime.fragment import (
    experimental_fragment as _experimental_fragment,
    fragment as _fragment,
)
from streamlit.runtime.metrics_util import gather_metrics as _gather_metrics
from streamlit.runtime.secrets import secrets_singleton as _secrets_singleton
from streamlit.runtime.context import ContextProxy as _ContextProxy
from streamlit.runtime.state import (
    SessionStateProxy as _SessionStateProxy,
    QueryParamsProxy as _QueryParamsProxy,
)
from streamlit.user_info import UserInfoProxy as _UserInfoProxy
from streamlit.commands.experimental_query_params import (
    get_query_params as _get_query_params,
    set_query_params as _set_query_params,
)

import streamlit.column_config as _column_config

# Modules that the user should have access to. These are imported with the "as" syntax
# and the same name; note that renaming the import with "as" does not make it an
# explicit export. In this case, you should import it with an underscore to make clear
# that it is internal and then assign it to a variable with the new intended name.
# You can check the export behavior by running 'mypy --strict example_app.py', which
# disables implicit_reexport, where you use the respective command in the example_app.py
# Streamlit app.

from streamlit.commands.echo import echo as echo
from streamlit.commands.logo import logo as logo
from streamlit.commands.navigation import navigation as navigation
from streamlit.navigation.page import Page as Page
from streamlit.elements.spinner import spinner as spinner

from streamlit.commands.page_config import set_page_config as set_page_config
from streamlit.commands.execution_control import (
    stop as stop,
    rerun as rerun,
    switch_page as switch_page,
)


def _update_logger() -> None:
    _logger.set_log_level(_config.get_option("logger.level").upper())
    _logger.update_formatter()
    _logger.init_tornado_logs()


# Make this file only depend on config option in an asynchronous manner. This
# avoids a race condition when another file (such as a test file) tries to pass
# in an alternative config.
_config.on_config_parsed(_update_logger, True)

secrets = _secrets_singleton

altair_chart = _main.altair_chart
area_chart = _main.area_chart
audio = _main.audio
audio_input = _main.audio_input
balloons = _main.balloons
bar_chart = _main.bar_chart
bokeh_chart = _main.bokeh_chart
button = _main.button
caption = _main.caption
camera_input = _main.camera_input
chat_message = _main.chat_message
chat_input = _main.chat_input
checkbox = _main.checkbox
code = _main.code
columns = _main.columns
tabs = _main.tabs
container = _main.container
dataframe = _main.dataframe
data_editor = _main.data_editor
date_input = _main.date_input
divider = _main.divider
download_button = _main.download_button
expander = _main.expander
feedback = _main.feedback
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
html = _main.html
image = _main.image
info = _main.info
json = _main.json
latex = _main.latex
line_chart = _main.line_chart
link_button = _main.link_button
map = _main.map
markdown = _main.markdown
metric = _main.metric
multiselect = _main.multiselect
number_input = _main.number_input
page_link = _main.page_link
pills = _main.pills
plotly_chart = _main.plotly_chart
popover = _main.popover
progress = _main.progress
pyplot = _main.pyplot
radio = _main.radio
scatter_chart = _main.scatter_chart
selectbox = _main.selectbox
select_slider = _main.select_slider
segmented_control = _main.segmented_control
slider = _main.slider
snow = _main.snow
subheader = _main.subheader
success = _main.success
table = _main.table
text = _main.text
text_area = _main.text_area
text_input = _main.text_input
toggle = _main.toggle
time_input = _main.time_input
title = _main.title
vega_lite_chart = _main.vega_lite_chart
video = _main.video
warning = _main.warning
write = _main.write
write_stream = _main.write_stream
color_picker = _main.color_picker
status = _main.status

# Events - Note: these methods cannot be called directly on sidebar
# (ex: st.sidebar.toast)
toast = _event.toast

# Config
# We add the metrics tracking here, since importing
# gather_metrics in config causes a circular dependency
get_option = _gather_metrics("get_option", _config.get_option)
set_option = _gather_metrics("set_option", _config.set_user_option)

# Session State
session_state = _SessionStateProxy()

query_params = _QueryParamsProxy()

context = _ContextProxy()

# Caching
cache_data = _cache_data
cache_resource = _cache_resource
# `st.cache` is deprecated and should be removed soon
cache = _cache

# Namespaces
column_config = _column_config

# Connection
connection = _connection

# Fragment and dialog
dialog = _dialog_decorator
fragment = _fragment

# Experimental APIs
experimental_audio_input = _main.experimental_audio_input
experimental_dialog = _experimental_dialog_decorator
experimental_fragment = _experimental_fragment
experimental_user = _UserInfoProxy()

_EXPERIMENTAL_QUERY_PARAMS_DEPRECATE_MSG = "Refer to our [docs page](https://docs.streamlit.io/develop/api-reference/caching-and-state/st.query_params) for more information."

experimental_get_query_params = _deprecate_func_name(
    _get_query_params,
    "experimental_get_query_params",
    "2024-04-11",
    _EXPERIMENTAL_QUERY_PARAMS_DEPRECATE_MSG,
    name_override="query_params",
)
experimental_set_query_params = _deprecate_func_name(
    _set_query_params,
    "experimental_set_query_params",
    "2024-04-11",
    _EXPERIMENTAL_QUERY_PARAMS_DEPRECATE_MSG,
    name_override="query_params",
)


# make it possible to call streamlit.components.v1.html etc. by importing it here
# import in the very end to avoid partially-initialized module import errors, because
# streamlit.components.v1 also uses some streamlit imports
import streamlit.components.v1  # noqa: F401
