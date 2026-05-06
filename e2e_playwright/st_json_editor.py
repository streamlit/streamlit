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

import streamlit as st

st.subheader("Basic JSON Editor (dict)")
config = st.json_editor(
    {
        "name": "Test Config",
        "version": 1,
        "settings": {
            "enabled": True,
            "timeout": 30,
        },
    },
    key="dict_editor",
)
st.write("Dict result type:", type(config).__name__)
st.write("Dict result:", config)

st.subheader("JSON Editor (list)")
items = st.json_editor(
    ["item1", "item2", "item3"],
    key="list_editor",
)
st.write("List result type:", type(items).__name__)
st.write("List result:", items)

st.subheader("JSON Editor (string)")
json_str = st.json_editor(
    '{"raw": "json string"}',
    key="string_editor",
)
st.write("String result type:", type(json_str).__name__)
st.write("String result:", json_str)

st.subheader("Disabled JSON Editor")
st.json_editor(
    {"readonly": True, "value": 42},
    disabled=True,
    key="disabled_editor",
)

st.subheader("JSON Editor with height")
st.json_editor(
    {"key": "value"},
    height=200,
    key="height_editor",
)

st.subheader("Empty JSON Editor")
empty = st.json_editor(
    {},
    key="empty_editor",
)
st.write(f"Empty result: {empty}")

st.subheader("JSON Editor with callback")
if "callback_count" not in st.session_state:
    st.session_state.callback_count = 0


def on_change():
    st.session_state.callback_count += 1


st.json_editor(
    {"callback_test": True},
    on_change=on_change,
    key="callback_editor",
)
st.write("Callback count:", st.session_state.callback_count)
