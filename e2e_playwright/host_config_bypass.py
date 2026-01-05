# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""Test app for host config bypass feature."""

import streamlit as st


def page1():
    pass


def page2():
    pass


def page3():
    pass


pages = {
    "General": [
        st.Page(page1, title="Home", icon=":material/home:"),
        st.Page(page2, title="Data visualizations", icon=":material/monitoring:"),
    ],
    "Admin": [st.Page(page3, title="Settings", icon=":material/settings:")],
}


pg = st.navigation(pages)
pg.run()

st.subheader("Connection status test", divider="gray")

st.slider("Slider", value=50, min_value=0, max_value=100)

st.multiselect(
    "Multiselect",
    default=["Option 1", "Option 2"],
    options=["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"],
)

# Add a button to verify interactivity
st.write("Button:")
if st.button("Click me"):
    st.write("Button clicked!")

with st.sidebar:
    st.metric("Temperature", "70 °F", "1.2 °F")
    st.metric("Wind", "9 mph", "-8%")
