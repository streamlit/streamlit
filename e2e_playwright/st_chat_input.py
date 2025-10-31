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

import streamlit as st
from streamlit import config, runtime

# Set file max upload size to 1MB
config.set_option("server.maxUploadSize", 1)

v1 = st.container().chat_input("Chat input 1 (inline)", key="chat_input_1")
st.write("Chat input 1 (inline) - value:", v1)

col1, _ = st.columns(2)

v2 = col1.chat_input(
    "Chat input 2 (in column, disabled)",
    accept_file=True,
    disabled=True,
    key="chat_input_2",
)
st.write("Chat input 2 (in column, disabled) - value:", v2)

if st.button("Set Value"):
    st.session_state["chat_input_3"] = "Hello, world!"

if runtime.exists():
    st.write(
        "Chat input 3 - session state value before execution:",
        st.session_state.get("chat_input_3"),
    )

    def on_submit():
        st.markdown("chat input submitted")

    v3 = st.container().chat_input(
        "Chat input 3 (callback)", key="chat_input_3", on_submit=on_submit
    )
    st.write(
        "Chat input 3 (callback) - session state value:",
        st.session_state["chat_input_3"],
    )
    st.write("Chat input 3 (callback) - return value:", v3)


v4 = st.container().chat_input(
    "Chat input 4 (single file)", accept_file=True, file_type="txt", key="chat_input_4"
)
st.write("Chat input 4 (single file) - value:", v4)

v5 = st.container().chat_input(
    "Chat input 5 (multiple files)", accept_file="multiple", key="chat_input_5"
)
st.write("Chat input 5 (multiple files) - value:", v5)

v6 = st.container().chat_input(
    "Chat input 7 (width=300px)", width=300, key="chat_input_7"
)
v7 = st.container().chat_input(
    "Chat input 8 (width='stretch')", width="stretch", key="chat_input_8"
)


v8 = st.chat_input(
    "Chat input 8 (bottom, max_chars, long placeholder) "
    "This is a very long placeholder text that should span multiple lines "
    "and cause the chat input to grow vertically to accommodate all the "
    "text properly when displayed in the UI",
    max_chars=200,
    key="chat_input_8_bottom",
)
st.write("Chat input 8 (bottom, max_chars) - value:", v8)

# Directory upload tests
v9 = st.container().chat_input(
    "Chat input 9 (directory upload)", accept_file="directory", key="chat_input_9"
)
st.write("Chat input 9 (directory upload) - value:", v9)

v10 = st.container().chat_input(
    "Chat input 10 (directory upload disabled)",
    accept_file="directory",
    disabled=True,
    key="chat_input_10",
)
st.write("Chat input 10 (directory upload disabled) - value:", v10)

# Dynamic chat input example
st.markdown("Dynamic chat input:")

if st.toggle("Update chat input props"):
    dyn_val = st.container().chat_input(
        "Updated dynamic chat input",
        key="dynamic_chat_input_with_key",
        width=300,
        on_submit=lambda a, param: print(
            f"Updated chat input - callback triggered: {a} {param}"
        ),
        args=("Updated chat arg",),
        kwargs={"param": "updated kwarg param"},
        # Whitelisted params:
        max_chars=200,
        accept_file=False,
        file_type=["txt"],
    )
    st.write("Updated chat input value:", dyn_val)
else:
    dyn_val = st.container().chat_input(
        "Initial dynamic chat input",
        key="dynamic_chat_input_with_key",
        width="stretch",
        on_submit=lambda a, param: print(
            f"Initial chat input - callback triggered: {a} {param}"
        ),
        args=("Initial chat arg",),
        kwargs={"param": "initial kwarg param"},
        # Whitelisted params:
        max_chars=200,
        accept_file=False,
        file_type=["txt"],
    )
    st.write("Initial chat input value:", dyn_val)

v11 = st.container().chat_input(
    "Chat input 11 (audio recording)",
    accept_file="multiple",
    accept_audio=True,
    key="chat_input_11",
)
st.write("Chat input 11 (audio recording) - value:", v11)
if v11:
    st.write("  - text:", v11.text)
    st.write("  - audio:", v11.audio)
    st.write("  - files:", v11.files)
    if v11.audio:
        st.audio(v11.audio)
    if v11.files:
        for file in v11.files:
            st.write(f"  - file: {file.name}")

# Audio only (no file upload)
v12 = st.container().chat_input(
    "Chat input 12 (audio only)",
    accept_audio=True,
    key="chat_input_12",
)
st.write("Chat input 12 (audio only) - value:", v12)
if v12:
    st.write("  - text:", v12.text)
    st.write("  - audio:", v12.audio)
    if v12.audio:
        st.audio(v12.audio)

# Audio with disabled state
v13 = st.container().chat_input(
    "Chat input 13 (audio disabled)",
    accept_audio=True,
    disabled=True,
    key="chat_input_13",
)
st.write("Chat input 13 (audio disabled) - value:", v13)

# Audio in sidebar
with st.sidebar:
    st.subheader("Sidebar Audio Input")
    v14 = st.chat_input(
        "Chat input 14 (sidebar audio)",
        accept_audio=True,
        key="chat_input_14",
    )
    st.write("Chat input 14 (sidebar audio) - value:", v14)
    if v14:
        st.write("  - text:", v14.text)
        st.write("  - audio:", v14.audio)
        if v14.audio:
            st.audio(v14.audio)

# Audio in columns
st.subheader("Audio in Columns")
col_a, col_b = st.columns(2)
with col_a:
    v15 = st.chat_input(
        "Chat input 15 (column audio)",
        accept_audio=True,
        key="chat_input_15",
    )
    st.write("Chat input 15 (column audio) - value:", v15)
    if v15:
        st.write("  - text:", v15.text)
        st.write("  - audio:", v15.audio)

with col_b:
    v16 = st.chat_input(
        "Chat input 16 (w/ files)",
        accept_audio=True,
        accept_file="multiple",
        key="chat_input_16",
    )
    st.write("Chat input 16 (w/ files) - value:", v16)
