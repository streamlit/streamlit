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

# we use session_state to store the callback function value
# instead of using st.write directly in the button callback,
# because we have observed that the button-click is sometimes not
# dispatched correctly when the rerun from the textArea's onBlur event
# is too fast which leads to a changing number of elements per rerun (because the
# callback's write would disappear briefly).
default_input = "Input: "
if "btn_callback" not in st.session_state:
    st.session_state.btn_callback = default_input

st.write(st.session_state.btn_callback)
# reset to harden the test against reruns
st.session_state.btn_callback = default_input

st.header("Widget State - Heavy Usage Test")
# Test for https://github.com/streamlit/streamlit/issues/4836

number = st.number_input("test", value=0, step=1)
st.write(number)

if number:
    time.sleep(1)

st.header("Widget State - Redisplayed Widget Test")
# Test for https://github.com/streamlit/streamlit/issues/3512

if st.checkbox("Display widgets"):
    if st.checkbox("Show hello"):
        st.write("hello")

    if st.checkbox("Show goodbye", key="c3"):
        st.write("goodbye")

st.header("Test for input change & button click in one motion")
# Test for https://github.com/streamlit/streamlit/issues/10007


def btn_callback():
    st.session_state.btn_callback = f"Input: {st.session_state['key1']}"


txt = st.text_area("Type something into the text area", key="key1")
st.button("Submit text_area", on_click=btn_callback)
st.write(f"Res: {txt}")

st.divider()

st.subheader("Test `showWidgetBorder` behavior")

disabled = st.checkbox("Disable widgets", value=False)

# Widgets with expected showWidgetBorder behavior:
with st.container(key="widget_container"):
    col1, col2, col3 = st.columns(3)
    with col1:
        st.selectbox("st.selectbox", ["option 1", "option 2"], disabled=disabled)
        st.multiselect("st.multiselect", ["option 1", "option 2"], disabled=disabled)
        st.file_uploader("st.file_uploader", type=["png", "jpg"], disabled=disabled)
    with col2:
        st.number_input("st.number_input", disabled=disabled)
        st.text_input("st.text_input", disabled=disabled)
        st.text_area("st.text_area", disabled=disabled)
    with col3:
        st.time_input("st.time_input", disabled=disabled)
        st.date_input("st.date_input", disabled=disabled)
        st.chat_input("st.chat_input", disabled=disabled)
        st.audio_input("st.audio_input", disabled=disabled)
