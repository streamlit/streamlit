# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import time

import streamlit as st

st.header("Page 6")

with st.sidebar:
    st.write("Sidebar")
    color = st.color_picker("Pick a color")
    st.write("You picked:", color)
    st.divider()
    st.text_area("Some random text:", height=500)

# add a sleep timer to simulate a slow loading page. This allows us for example
# to simulate navigating away from a partially loaded page
time.sleep(5)
st.write("Finished sleeping for 5 seconds.")
