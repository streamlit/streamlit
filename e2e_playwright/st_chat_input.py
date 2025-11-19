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

# Get chat input key to display from query params
# If no key is specified, show all chat inputs
key = st.query_params.get("key")

if key is None or key == "inline":
    inline_value = st.container().chat_input("Chat input (inline)", key="inline")
    st.write("inline - value:", inline_value)

if key is None or key == "disabled_with_file":
    col1, _ = st.columns(2)
    disabled_value = col1.chat_input(
        "Chat input (in column, disabled)",
        accept_file=True,
        disabled=True,
        key="disabled_with_file",
    )
    st.write("disabled_with_file - value:", disabled_value)

if key is None or key == "callback":
    if st.button("Set Value"):
        st.session_state["callback"] = "Hello, world!"

    if runtime.exists():
        st.write(
            "callback - session state value before execution:",
            st.session_state.get("callback"),
        )

        def on_submit():
            st.markdown("chat input submitted")

        callback_value = st.container().chat_input(
            "Chat input (callback)", key="callback", on_submit=on_submit
        )
        st.write(
            "callback - session state value:",
            st.session_state["callback"],
        )
        st.write("callback - return value:", callback_value)

if key is None or key == "single_file":
    single_file_value = st.container().chat_input(
        "Chat input (single file)",
        accept_file=True,
        file_type="txt",
        key="single_file",
    )
    st.write("single_file - value:", single_file_value)

if key is None or key == "multiple_files":
    multiple_files_value = st.container().chat_input(
        "Chat input (multiple files)", accept_file="multiple", key="multiple_files"
    )
    st.write("multiple_files - value:", multiple_files_value)

if key is None or key == "width_300":
    width_300_value = st.container().chat_input(
        "Chat input (width=300px)", width=300, key="width_300"
    )

if key is None or key == "width_stretch":
    width_stretch_value = st.container().chat_input(
        "Chat input (width='stretch')", width="stretch", key="width_stretch"
    )

if key is None or key == "bottom_max_chars":
    bottom_value = st.chat_input(
        "Chat input (bottom, max_chars, long placeholder) "
        "This is a very long placeholder text that should span multiple lines "
        "and cause the chat input to grow vertically to accommodate all the "
        "text properly when displayed in the UI",
        max_chars=200,
        key="bottom_max_chars",
    )
    st.write("bottom_max_chars - value:", bottom_value)

if key is None or key == "directory":
    directory_value = st.container().chat_input(
        "Chat input (directory upload)", accept_file="directory", key="directory"
    )
    st.write("directory - value:", directory_value)

if key is None or key == "directory_disabled":
    directory_disabled_value = st.container().chat_input(
        "Chat input (directory upload disabled)",
        accept_file="directory",
        disabled=True,
        key="directory_disabled",
    )
    st.write("directory_disabled - value:", directory_disabled_value)

if key is None or key == "dynamic":
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

if key is None or key == "audio_with_files":
    audio_with_files_value = st.container().chat_input(
        "Chat input (audio recording)",
        accept_file="multiple",
        accept_audio=True,
        key="audio_with_files",
    )

    if audio_with_files_value:
        st.write(f"audio_with_files - text: {audio_with_files_value.text}")
        st.write(
            f"audio_with_files - audio: {audio_with_files_value.audio.name if audio_with_files_value.audio else None}"
        )
        file_count = (
            len(audio_with_files_value.files) if audio_with_files_value.files else 0
        )
        st.write(f"audio_with_files - files: {file_count} files")

        if audio_with_files_value.audio:
            st.audio(audio_with_files_value.audio)

if key is None or key == "audio_only":
    audio_only_value = st.container().chat_input(
        "Chat input (audio only)",
        accept_audio=True,
        key="audio_only",
    )

    if audio_only_value:
        st.write(f"audio_only - text: {audio_only_value.text}")
        st.write(
            f"audio_only - audio: {audio_only_value.audio.name if audio_only_value.audio else None}"
        )

        if audio_only_value.audio:
            st.audio(audio_only_value.audio)

if key is None or key == "audio_disabled":
    audio_disabled_value = st.container().chat_input(
        "Chat input (audio disabled)",
        accept_audio=True,
        disabled=True,
        key="audio_disabled",
    )

    if audio_disabled_value:
        st.write(f"audio_disabled - text: {audio_disabled_value.text}")
        st.write(
            f"audio_disabled - audio: {audio_disabled_value.audio.name if audio_disabled_value.audio else None}"
        )

        if audio_disabled_value.audio:
            st.audio(audio_disabled_value.audio)

if key is None or key == "audio_column":
    st.subheader("Audio in Columns")
    col_a, col_b = st.columns(2)
    with col_a:
        audio_column_a_value = st.chat_input(
            "Chat input (column audio)",
            accept_audio=True,
            key="audio_column_a",
        )

        if audio_column_a_value:
            st.write(f"audio_column_a - text: {audio_column_a_value.text}")
            st.write(
                f"audio_column_a - audio: {audio_column_a_value.audio.name if audio_column_a_value.audio else None}"
            )

            if audio_column_a_value.audio:
                st.audio(audio_column_a_value.audio)

    with col_b:
        audio_column_b_value = st.chat_input(
            "Chat input (w/ files)",
            accept_audio=True,
            accept_file="multiple",
            key="audio_column_b",
        )

        if audio_column_b_value:
            st.write(f"audio_column_b - text: {audio_column_b_value.text}")
            st.write(
                f"audio_column_b - audio: {audio_column_b_value.audio.name if audio_column_b_value.audio else None}"
            )
            st.write(
                f"audio_column_b - files: {len(audio_column_b_value.files) if audio_column_b_value.files else 0} files"
            )

            if audio_column_b_value.audio:
                st.audio(audio_column_b_value.audio)
