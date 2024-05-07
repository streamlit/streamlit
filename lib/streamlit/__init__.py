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

from streamlit.delta_generator import (
    main_dg as _main_dg,
    sidebar_dg as _sidebar_dg,
    event_dg as _event_dg,
    bottom_dg as _bottom_dg,
)
from streamlit.elements.dialog_decorator import (
    # rename so that it is available as st.dialog
    dialog_decorator as experimental_dialog,
)
from streamlit.runtime.caching import (
    cache_resource as _cache_resource,
    cache_data as _cache_data,
    experimental_singleton as _experimental_singleton,
    experimental_memo as _experimental_memo,
)
from streamlit.runtime.connection_factory import (
    connection_factory as _connection,
)
from streamlit.runtime.fragment import fragment as _fragment
from streamlit.runtime.metrics_util import gather_metrics as _gather_metrics
from streamlit.runtime.secrets import secrets_singleton as _secrets_singleton
from streamlit.runtime.state import (
    SessionStateProxy as _SessionStateProxy,
    QueryParamsProxy as _QueryParamsProxy,
)
from streamlit.user_info import UserInfoProxy as _UserInfoProxy
from streamlit.commands.experimental_query_params import (
    get_query_params as _get_query_params,
    set_query_params as _set_query_params,
)

# Modules that the user should have access to. These are imported with "as"
# syntax pass mypy checking with implicit_reexport disabled.

import streamlit.column_config as _column_config
from streamlit.echo import echo as echo
from streamlit.runtime.legacy_caching import cache as _cache
from streamlit.commands.logo import logo as logo
from streamlit.elements.spinner import spinner as spinner
from streamlit.commands.page_config import set_page_config as set_page_config
from streamlit.commands.execution_control import (
    stop as stop,
    rerun as rerun,
    experimental_rerun as _experimental_rerun,
    switch_page as switch_page,
)

# We add the metrics tracking for caching here,
# since the actual cache function calls itself recursively
cache = _gather_metrics("cache", _cache)


def _update_logger() -> None:
    _logger.set_log_level(_config.get_option("logger.level").upper())
    _logger.update_formatter()
    _logger.init_tornado_logs()


# Make this file only depend on config option in an asynchronous manner. This
# avoids a race condition when another file (such as a test file) tries to pass
# in an alternative config.
_config.on_config_parsed(_update_logger, True)


secrets = _secrets_singleton

# DeltaGenerator methods:
_main = _main_dg
sidebar = _sidebar_dg
_event = _event_dg
_bottom = _bottom_dg

altair_chart = _main.altair_chart
area_chart = _main.area_chart
audio = _main.audio
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
plotly_chart = _main.plotly_chart
popover = _main.popover
progress = _main.progress
pyplot = _main.pyplot
radio = _main.radio
scatter_chart = _main.scatter_chart
selectbox = _main.selectbox
select_slider = _main.select_slider
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

# Events - Note: these methods cannot be called directly on sidebar (ex: st.sidebar.toast)
toast = _event.toast

# Config
# We add the metrics tracking here, since importing
# gather_metrics in config causes a circular dependency
get_option = _gather_metrics("get_option", _config.get_option)
set_option = _gather_metrics("set_option", _config.set_user_option)

# Session State
session_state = _SessionStateProxy()

query_params = _QueryParamsProxy()

# Caching
cache_data = _cache_data
cache_resource = _cache_resource

# Namespaces
column_config = _column_config

# Connection
connection = _connection

# Experimental APIs
experimental_fragment = _fragment
experimental_memo = _experimental_memo
experimental_singleton = _experimental_singleton
experimental_user = _UserInfoProxy()

_EXPERIMENTAL_QUERY_PARAMS_DEPRECATE_MSG = "Refer to our [docs page](https://docs.streamlit.io/library/api-reference/utilities/st.query_params) for more information."

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
experimental_rerun = _experimental_rerun
experimental_data_editor = _main.experimental_data_editor
experimental_connection = _deprecate_func_name(
    connection, "experimental_connection", "2024-04-01", name_override="connection"
)
