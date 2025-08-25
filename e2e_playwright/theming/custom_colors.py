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

st.set_page_config(initial_sidebar_state="expanded", layout="wide")

st.header("Custom Colors :rainbow[App]")


def page1():
    pass


def page2():
    pass


st.navigation(
    [
        st.Page(page1, title="Page 1", icon=":material/home:"),
        st.Page(page2, title="Page 2", icon=":material/settings:"),
    ]
)


@st.dialog("My Dialog")
def my_dialog():
    st.write("Hello World")


col1, col2, col3 = st.columns(3)

with col1:
    if st.button("Open Dialog", width="stretch"):
        my_dialog()
    st.segmented_control(
        "Segmented Control",
        options=["Option 1", "Option 2"],
        default="Option 1",
        label_visibility="collapsed",
    )
    st.button("Primary Button", type="primary")
    st.divider()
    st.code("# st.code\na = 1234")
    st.chat_input("Chat Input")
    st.multiselect(
        "Multiselect",
        options=["Option 1", "Option 2", "Option 3"],
        default=["Option 1"],
        label_visibility="collapsed",
    )
    st.json(
        {
            "name": "Kevin",
            "age": 7,
            "breed": "Welsh Corgi",
        }
    )

with col2:
    with st.expander("Expander", expanded=True):
        st.write("Chat Message avatars (main colors):")
        user_message = st.chat_message(name="User")
        user_message.write("Hello Kevin!")
        assistant_message = st.chat_message(name="Assistant")
        assistant_message.write("Hello :dog:")

with col3:
    st.subheader("Dividers (Main Colors):")
    st.subheader("Red test", divider="red")
    st.subheader("Orange test", divider="orange")
    st.subheader("Yellow test", divider="yellow")
    st.subheader("Green test", divider="green")
    st.subheader("Blue test", divider="blue")
    st.subheader("Violet test", divider="violet")
    st.subheader("Gray test", divider="gray")

with st.sidebar:
    st.header("Dividers (Main Colors):")
    st.subheader("Red test", divider="red")
    st.subheader("Orange test", divider="orange")
    st.subheader("Yellow test", divider="yellow")
    st.subheader("Green test", divider="green")
    st.subheader("Blue test", divider="blue")
    st.subheader("Violet test", divider="violet")
    st.subheader("Gray test", divider="gray")
