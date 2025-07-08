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

if "messages" not in st.session_state:
    st.session_state.messages = []

# A count to record the index of dialog
if "count" not in st.session_state:
    st.session_state.count = 0

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

uploaded_files = st.sidebar.file_uploader(label="Upload", accept_multiple_files=True)

for file in uploaded_files:
    st.sidebar.write(file.name)

if prompt := st.chat_input("What is up?"):
    # Display user message in chat message container
    with st.chat_message("user"):
        st.markdown(prompt)
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt})
    st.session_state.count += 1

    # Sleep one second here to simulate the process of assistant.
    time.sleep(1)
    with st.chat_message("assistant"):
        assistant = f"Good at {st.session_state.count}"
        st.markdown(assistant)
    # Add assistant message to chat history
    st.session_state.messages.append({"role": "assistant", "content": assistant})
