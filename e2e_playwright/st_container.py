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

container = st.container(key="first container")

st.write("Line 1")
container.write("Line 2")
with container:
    "Line 3"
st.write("Line 4")

# Ensure widget states persist when React nodes shift
if st.button("Step 2: Press me"):
    st.header("Pressed!")
c = st.container()
if c.checkbox("Step 1: Check me"):
    c.title("Checked!")

with st.container(border=True, key="container_with_border_and_text"):
    st.markdown(
        "This is inside a container with a border. And it doesn't overflow "
        "the borders if the text requires multiple lines."
    )
    st.button("Stretch full width", width="stretch")

with st.container(height=200, key="container_with_scroll_container"):
    st.markdown("This is inside a scrolling container.")
    st.text_input("Widget in scroll container")

    for i in range(10):
        st.markdown(f"Message {i}")

empty_container = st.container(height=100, key="empty_container")

if st.button("Add message"):
    empty_container.chat_message("user").write("Hello world")

with st.container(height=200, key="container_with_chat_messages"):
    for i in range(10):
        st.chat_message("user").write(f"Message {i}")

# Test that an empty container with a border is rendered.
with st.container(border=True, key="container_with_border_and_empty_container"):
    st.container(border=True)

# Test that an empty container with height is rendered.
with st.container(
    border=True, key="container_with_border_and_empty_container_with_height"
):
    st.container(height=200)

# Test that an empty container without height or border is not rendered.
with st.container(
    border=True,
    key="container_with_border_and_empty_container_without_height_or_border",
):
    st.container()

with st.container(
    height=200, border=True, key="nested_containers_with_height_overflow"
):
    st.write("Inside container 1")
    with st.container(height=250, border=True):
        st.write("Inside container 2")

with st.container(height=200, border=True, key="nested_containers_with_no_overflow"):
    st.write("Inside container 3")
    with st.container(border=True):
        st.write("Inside container 4")

code = """
def hello():
    print("Hello, Streamlit!")
"""

with st.container(width=200, border=True, key="container_with_fixed_width"):
    st.write("fixed 200px width container")
    st.code(code)

with st.container(width="stretch", border=True, key="container_with_stretch_width"):
    st.write("stretch width container")
    st.code(code)

with st.container(
    border=True, height=300, key="container_with_stretch_height_container_inside"
):
    with st.container(height="stretch", border=True):
        st.write("stretch height container")

with st.container(
    border=True, height=300, key="container_with_content_height_container_inside"
):
    with st.container(height="content", border=True):
        st.write("content height container")

col1, col2 = st.columns(2)

with col1:
    with st.container(height=200, border=True):
        st.write("Inside container 5")
    with st.container(border=True):
        st.write("Inside container 6")

with col2:
    with st.container(border=True):
        st.write("Inside container 7")
    with st.container(height=100, border=True):
        st.write("Inside container 8")
