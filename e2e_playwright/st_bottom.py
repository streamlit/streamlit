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

"""Test app for st.bottom container."""

import streamlit as st

# Test basic components in bottom container
with st.bottom:
    st.text("Bottom text 1")
    st.button("Bottom button", key="bottom_btn")

# Test multiple with st.bottom blocks accumulate
with st.bottom:
    st.text("Bottom text 2")

# Test direct attribute access
st.bottom.markdown("**Bottom markdown**")

# Test columns in bottom
with st.bottom:
    col1, col2 = st.columns(2)
    with col1:
        st.text("Column 1 in bottom")
    with col2:
        st.text("Column 2 in bottom")

# Test chat_input inside st.bottom (should render inline)
with st.bottom:
    bottom_chat = st.chat_input("Chat in bottom", key="chat_in_bottom")
    if bottom_chat:
        st.write(f"Bottom chat value: {bottom_chat}")

# Main content
st.title("st.bottom Test App")
st.write("This is main content above the bottom container.")

# Add some content to make the page scrollable
for i in range(5):
    st.text(f"Main content line {i + 1}")

# Test chat_input in main (should auto-position to bottom)
main_chat = st.chat_input("Chat in main", key="chat_in_main")
if main_chat:
    st.write(f"Main chat value: {main_chat}")
