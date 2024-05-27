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

CAT_IMAGE = "https://images.unsplash.com/photo-1552933529-e359b2477252?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=950&q=80"
LOREM_IPSUM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."

# Get first element after title/header
c1, c2, c3 = st.columns(3)

c1.write("Foo")
c2.write("Bar")
c3.write("Baz")

c1, c2, c3 = st.columns(3)

# We use longer text here because movement should
# be considered a large change in the screenshot comparison
c3.write("Some long text to write")

if st.button("Layout should not shift when this is pressed"):
    st.write("Pressed!")

# Same-width columns
c1, c2, c3 = st.columns(3)
c1.image(CAT_IMAGE)
c2.image(CAT_IMAGE)
c3.image(CAT_IMAGE)


# Variable-width columns
for c in st.columns((1, 2, 3, 4)):
    c.image(CAT_IMAGE)

# Various column gaps
c4, c5, c6 = st.columns(3, gap="small")
c4.image(CAT_IMAGE)
c5.image(CAT_IMAGE)
c6.image(CAT_IMAGE)

c7, c8, c9 = st.columns(3, gap="medium")
c7.image(CAT_IMAGE)
c8.image(CAT_IMAGE)
c9.image(CAT_IMAGE)

c10, c11, c12 = st.columns(3, gap="large")
c10.image(CAT_IMAGE)
c11.image(CAT_IMAGE)
c12.image(CAT_IMAGE)

st.subheader("Nested columns")

if st.button("Nested columns - one level"):
    col1, col2 = st.columns(2, gap="large")
    with col1:
        subcol1, subcol2 = st.columns(2, gap="medium")
        subcol1.write(LOREM_IPSUM)
        subcol2.write(LOREM_IPSUM)
        st.write("")
        st.write(LOREM_IPSUM)

    with col2:
        subcol1, subcol2 = st.columns(2, gap="medium")
        subcol1.write(LOREM_IPSUM)
        subcol2.write(LOREM_IPSUM)

        st.write("")
        subcol1, subcol2 = st.columns(2, gap="medium")
        subcol1.write(LOREM_IPSUM)
        subcol2.write(LOREM_IPSUM)

if st.button("Nested columns - two levels"):
    col1, col2 = st.columns(2)
    with col1:
        subcol1, subcol2 = st.columns(2)
        with subcol1:
            subcol1.write(LOREM_IPSUM)
            subsubcol1, subsubcol2 = st.columns(2)
            subsubcol1.write(LOREM_IPSUM)
            subsubcol2.write(LOREM_IPSUM)
        subcol2.write(LOREM_IPSUM)
        st.write(LOREM_IPSUM)

if st.button("Nested columns - in sidebar"):
    with st.sidebar:
        col1, col2 = st.columns(2)
        col1.text_input("Text input 1")
        col2.text_input("Text input 2")
        col3, col4 = col1.columns(2)
        col3.text_input("Text input 3")
        col4.text_input("Text input 4")
        st.text_input("Text input 5")
