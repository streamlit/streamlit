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

import sys

import streamlit as st

lazy_loaded_modules = [
    "bokeh",
    "tenacity",
    "rich",
    "pydeck",
    "altair",
    "graphviz",
    "streamlit.emojis",
    "streamlit.external",
    # TODO(lukasmasuch): Lazy load more packages:
    # "streamlit.hello",
    # "streamlit.vendor.pympler",
    # "streamlit.watcher.event_based_path_watcher",
    # "pandas",
    # "pyarrow",
    # "numpy",
    # "matplotlib",
    # "plotly",
    # "pillow",
    # "watchdog",
]

for module in lazy_loaded_modules:
    loaded = module in sys.modules
    st.write(f"**{module}**:", ("loaded" if loaded else "not loaded"))
