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

with st.echo("below"):
    triggered_value = st.triggers(
        "st.triggers",
        [
            ":material/star: Hello hello!",
            "Foobar",
            "Icon in the end: :material/rocket:",
        ],
        key="trigger_select",
    )

    st.write(f"Clicked: {triggered_value}")

st.divider()

st.header("Chat")

# Initialize chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

chat_container = st.container()

# Display chat messages from history on app rerun
for message in st.session_state.messages:
    role = message["role"]
    content = message["content"]

    with chat_container.chat_message(role):
        st.markdown(content)
    if role == "user":
        with chat_container.chat_message("agent"):
            res = "I did not get that"
            if content == "Hello!":
                res = "Hello back :)"
            elif content == "How are you?":
                res = "I am fine! How are you?"
            elif content == "This is a really long text! 🚀":
                res = "I have seen longer texts than that 🤔"
            st.markdown(res)

tr = chat_container.triggers(
    "Triggers", ["Hello!", "How are you?", "This is a really long text! 🚀"]
)
if tr:
    st.session_state.messages.append({"role": "user", "content": tr})
    st.rerun()
# React to user input
if prompt := chat_container.chat_input("What is up?"):
    # Display user message in chat message container
    #   with chat_container.chat_message("user"):
    #       st.markdown(prompt)
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt})
    st.rerun()
