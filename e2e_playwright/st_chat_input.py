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

import streamlit as st
from streamlit import runtime

v1 = st.container().chat_input("Chat input 1 (inline)")
st.write("Chat input 1 (inline) - value:", v1)

col1, _ = st.columns(2)

v2 = col1.chat_input("Chat input 2 (in column, disabled)", disabled=True)
st.write("Chat input 2 (in column, disabled) - value:", v2)

if runtime.exists():

    def on_submit():
        st.text("chat input submitted")

    st.container().chat_input(
        "Chat input 3 (callback)", key="chat_input_3", on_submit=on_submit
    )
    st.write("Chat input 3 (callback) - value:", st.session_state.get("chat_input_3"))

v4 = st.chat_input("Chat input 4 (bottom, max_chars)", max_chars=200)
st.write("Chat input 4 (bottom, max_chars) - value:", v4)
