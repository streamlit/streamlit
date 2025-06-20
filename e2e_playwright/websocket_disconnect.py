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

from datetime import date, time

import streamlit as st


# Make a MPA to verify that sidebar page nav links
# are also disabled when the websocket disconnects.
def page1():
    pass


def page2():
    pass


st.navigation([page1, page2])

st.subheader("Widgets should be disabled")

options = ("female", "male")

w1 = st.checkbox("I am human", True)

w2 = st.slider("Age", 0, 100, 25, 1)
st.write("Value 1:", w2)

w3 = st.text_area("Comments", "Streamlit is awesomeness!")

w4 = st.button("Click me")

w5 = st.radio("Gender", options, 1)

w6 = st.text_input("Text input widget", "i iz input")

w7 = st.selectbox("Options", options, 1)

w8 = st.time_input("Set an alarm for", time(8, 45))

w9 = st.date_input("A date to celebrate", date(2019, 7, 6))

st.subheader("Non-widget elements should not be disabled")

st.link_button("Link Button", "https://streamlit.io")

tab1, tab2 = st.tabs(["Tab 1", "Tab 2"])

with tab1:
    st.write("Hello")

with tab2:
    st.write("World")

st.expander("Expander").write("Hello")
