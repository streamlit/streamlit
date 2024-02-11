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
    "watchdog",
    "matplotlib",
    "pandas",
    "pyarrow",
    "streamlit.emojis",
    "streamlit.external",
    "streamlit.vendor.pympler",
    "streamlit.watcher.event_based_path_watcher",
    # TODO(lukasmasuch): Lazy load more packages:
    # "streamlit.hello",
    # "numpy",
    # "plotly",
    # "pillow",
]

for module in lazy_loaded_modules:
    loaded = module in sys.modules
    st.write(f"**{module}**:", ("imported" if loaded else "not loaded"))

if st.button("Import lazy loaded modules"):
    for module in lazy_loaded_modules:
        __import__(module)
    st.rerun()
