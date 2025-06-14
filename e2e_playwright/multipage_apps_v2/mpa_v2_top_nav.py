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

from typing import Any, Literal

import streamlit as st


# Define page functions inline
def page1():
    st.header("Page 1")
    st.write("Page 1 Content")


def page2():
    st.header("Page 2")
    st.write("Page 2 Content")


def page3():
    st.header("Page 3")
    st.write("Page 3 Content")


def page4():
    st.header("Page 4")
    st.write("Page 4 Content")


def page5():
    st.header("Page 5")
    st.write("Page 5 Content")


# Configuration checkboxes
test_overflow = st.checkbox("Test Overflow (5 pages)", key="test_overflow")
test_sections = st.checkbox("Test Sections", key="test_sections")
test_hidden = st.checkbox("Test Hidden Navigation", key="test_hidden")
test_switching = st.checkbox("Test Navigation Switching", key="test_switching")

# Initialize navigation position in session state
if "nav_position" not in st.session_state:
    st.session_state.nav_position = "sidebar" if not test_hidden else "hidden"

# Show navigation switching controls
if test_switching:
    col1, col2, col3 = st.columns(3)
    with col1:
        if st.button("Switch to Top Nav"):
            st.session_state.nav_position = "top"
            st.rerun()
    with col2:
        if st.button("Switch to Sidebar"):
            st.session_state.nav_position = "sidebar"
            st.rerun()
    with col3:
        if st.button("Switch to Hidden"):
            st.session_state.nav_position = "hidden"
            st.rerun()

# Define pages based on test configuration
pages: Any  # Will be either a list or dict of pages
if test_overflow:
    # Create 5 pages for overflow testing
    pages = [
        st.Page(page1, title="Page 1", icon="📄"),
        st.Page(page2, title="Page 2", icon="📄"),
        st.Page(page3, title="Page 3", icon="📄"),
        st.Page(page4, title="Page 4", icon="📄"),
        st.Page(page5, title="Page 5", icon="📄"),
    ]
elif test_sections:
    # Create pages with sections
    pages = {
        "Section A": [
            st.Page(page1, title="Page 1"),
            st.Page(page2, title="Page 2"),
        ],
        "Section B": [
            st.Page(page3, title="Page 3"),
            st.Page(page4, title="Page 4"),
        ],
    }
else:
    # Default 3 pages
    pages = [
        st.Page(page1, title="Page 1", icon="🏠"),
        st.Page(page2, title="Page 2", icon="📊"),
        st.Page(page3, title="Page 3", icon="🔧"),
    ]

position: Literal["sidebar", "hidden", "top"] = "top"
# Determine position
if test_hidden:
    position = "hidden"
elif test_switching:
    position = st.session_state.nav_position
else:
    position = "top"

# Create navigation
pg = st.navigation(pages, position=position)
pg.run()
