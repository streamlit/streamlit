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

st.title("This title is awesome!")
st.title("This title is awesome too!", help="Some help tooltip", anchor="awesome-title")
st.title("`Code` - Title with hidden Anchor", anchor=False)
st.title("a [link](#test)")
# Foreign language titles and anchors
st.title("日本語タイトル")
st.title("その他の邦題", anchor="アンカー")

st.header("This header is awesome!")
st.header("This header is awesome too!", anchor="awesome-header")
st.header("This header with hidden anchor is awesome tooooo!", anchor=False)
st.header("header with help", help="Some help tooltip")
st.header("header with help and hidden anchor", help="Some help tooltip", anchor=False)

st.subheader("This subheader is awesome!")
st.subheader("This subheader is awesome too!", anchor="awesome-subheader")
st.subheader("`Code` - Subheader without Anchor")
st.subheader(
    """`Code` - Subheader with Anchor [test_link](href)""",
    anchor="subheader",
)
st.subheader("Subheader with hidden Anchor", anchor=False)
st.subheader("Subheader with help", help="Some help tooltip")
st.subheader(
    "Subheader with help and hidden anchor", help="Some help tooltip", anchor=False
)

# Test dividers
colors = ["blue", "gray", "green", "grey", "orange", "rainbow", "red", "violet"]
lorem_ipsum_text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit"
# Headers with specified color
for color in colors:
    st.header(f"{color.capitalize()} Header Divider:", divider=color)
    st.write(lorem_ipsum_text)
# Subheaders with specified color
for color in colors:
    st.subheader(f"{color.capitalize()} Subheader Divider:", divider=color)
    st.write(lorem_ipsum_text)
