# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""Test app for st.navigation with expanded parameter."""

import streamlit as st


# Create 10 page functions
def page_1():
    st.header("Page 1")


def page_2():
    st.header("Page 2")


def page_3():
    st.header("Page 3")


def page_4():
    st.header("Page 4")


def page_5():
    st.header("Page 5")


def page_6():
    st.header("Page 6")


def page_7():
    st.header("Page 7")


def page_8():
    st.header("Page 8")


def page_9():
    st.header("Page 9")


def page_10():
    st.header("Page 10")


pages = [
    page_1,
    page_2,
    page_3,
    page_4,
    page_5,
    page_6,
    page_7,
    page_8,
    page_9,
    page_10,
]

# Use expanded=3 to show only 3 pages initially
# With 10 pages and expanded=3, the collapse threshold is 5 (3 + 2)
# Since 10 > 5, this should show "View 7 more" button
st.sidebar.write("Sidebar content")

st.navigation(pages, expanded=3).run()
