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

# keep the sidebar collapsed by default to prevent render flakiness
st.set_page_config(initial_sidebar_state="collapsed")
sidebar_markdown = """# I am a header

## I am a subheader

### I am a subsubheader

I am some body text

[I am a link](https://google.com)

Foo `bar` baz"""

with st.sidebar:
    st.caption(sidebar_markdown)

st.caption("This is a caption!")
st.caption(
    "This is a caption that contains <div>html</div> inside it!", unsafe_allow_html=True
)
st.caption("This is a caption with a help tooltip", help="This is some help tooltip!")

st.caption(
    """:material/chevron_right:  This is a caption that contains a bunch of interesting markdown:

# heading 1

## heading 2

### heading 3

#### heading 4

##### heading 5

###### heading 6

 * unordered list item 1
 * unordered list item 2
 * unordered list item 3

 1. ordered list item 1
 1. ordered list item 2
 1. ordered list item 3

 This is a *caption* that contains **markdown inside it**!

 This line contains <div>html</div>!
"""
)
