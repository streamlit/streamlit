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

import importlib.util
import sys

import streamlit as st

lazy_loaded_modules = [
    "altair",
    "bokeh",
    "graphviz",
    "matplotlib",
    "numpy",
    "pandas",
    # Pillow is lazy-loaded, but it gets imported by plotly,
    # which we have to import in case it is installed to correctly
    # configure the Streamlit theme. So, we cannot test this here.
    # "PIL",
    "pyarrow",
    "pydeck",
    "rich",
    "tenacity",
    # Internal modules:
    "streamlit.emojis",
    "streamlit.external",
    "streamlit.vendor.pympler",
    # Requires `server.fileWatcherType` to be configured with `none` or `poll`:
    "watchdog",
    "streamlit.watcher.event_based_path_watcher",
]


for module in lazy_loaded_modules:
    if module in sys.modules:
        label = "imported"
    elif importlib.util.find_spec(module) is not None:
        label = "not loaded"
    else:
        label = "not found"

    st.write(
        f"**{module}**:",
        label,
    )


if st.button("Import lazy loaded modules"):
    for module in lazy_loaded_modules:
        __import__(module)
    st.rerun()
