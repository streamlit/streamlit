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

import numpy as np
import pandas as pd

import streamlit as st

st.header("Chat: pre-filled prompts")

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
    ["Hello!", "How are you?", "This is a really long text! 🚀"]
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


def get_styler(styler):
    if st.session_state.highlighted:
        styler.set_caption("highlights")
        styler.background_gradient(axis=None, vmin=-2, vmax=2, cmap="YlGnBu")
    return styler


@st.dialog("filter")
def df_filter(col_size):
    to_filter_columns = st.multiselect(
        "Filter dataframe on", st.session_state.df.columns
    )
    if st.button("Filter"):
        st.session_state.to_filter_columns = to_filter_columns
        st.session_state.df = st.session_state.df[st.session_state.to_filter_columns]
        st.rerun()


st.header("Dataframe")

row, col = 10, 10
if "df" not in st.session_state:
    st.session_state.df = pd.DataFrame(
        np.random.randn(row, col), columns=("col %d" % i for i in range(col))
    )
if "highlighted" not in st.session_state:
    st.session_state.highlighted = False

with st.container():
    df_trigger = st.triggers([":material/refresh:", "Add Row", "Highlight"])
    st.dataframe(st.session_state.df.style.pipe(get_styler))

    if df_trigger:
        if df_trigger == ":material/refresh:":
            st.session_state.df = pd.DataFrame(
                np.random.randn(row, col), columns=("col %d" % i for i in range(col))
            )

        elif df_trigger == "Show filter":
            if "filter" not in st.session_state:
                df_filter(col)
                st.session_state.filter = True
            else:
                del st.session_state.filter

        elif df_trigger == "Highlight":
            st.session_state.highlighted = not st.session_state.highlighted

        elif df_trigger == "Add Row":
            row = np.random.randn(1, col)
            st.session_state.df.loc[-1] = row[0]
            st.session_state.df.index = st.session_state.df.index + 1
            st.session_state.df = st.session_state.df.sort_index()

        st.rerun()
