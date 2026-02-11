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

from __future__ import annotations

from typing import TYPE_CHECKING

import streamlit as st

if TYPE_CHECKING:
    from streamlit.navigation.page import StreamlitPage

# Check for query parameter to determine navigation position
nav_position = st.query_params.get("nav_position", "sidebar")

# Check for query parameter to test single visible page scenario
single_visible = st.query_params.get("single_visible", "false") == "true"

# Check for query parameter to test sections with all hidden pages
test_hidden_section = st.query_params.get("test_hidden_section", "false") == "true"


def about():
    st.header("About Page")


def detail():
    st.header("Detail Page")
    st.write("This is a hidden page accessible via URL or page_link")


def admin():
    st.header("Admin Page")


def settings():
    st.header("Settings Page")


# Define page objects first so they can be referenced
about_page = st.Page(about, title="About")
detail_page = st.Page(detail, title="Detail", visibility="hidden")
admin_page = st.Page(admin, title="Admin", visibility="hidden")


def home():
    st.header("Home Page")
    st.page_link(detail_page, label="Go to Detail Page")
    if st.button("Switch to Admin"):
        st.switch_page(admin_page)


home_page = st.Page(home, title="Home", default=True)

pages: list[StreamlitPage] | dict[str, list[StreamlitPage]]
if single_visible:
    # Only home page is visible, all others are hidden
    about_hidden = st.Page(
        about, title="About", url_path="about_hidden", visibility="hidden"
    )
    pages = [home_page, about_hidden, detail_page, admin_page]
elif test_hidden_section:
    # Test sections where one section has all hidden pages
    # Section "Main" has visible pages, Section "Admin" has all hidden pages
    home_section = st.Page(home, title="Home", default=True)
    about_section = st.Page(about, title="About")
    # All pages in "Admin" section are hidden - section header should not appear
    admin_hidden = st.Page(
        admin, title="Admin", url_path="admin_section", visibility="hidden"
    )
    settings_hidden = st.Page(
        settings, title="Settings", url_path="settings_section", visibility="hidden"
    )
    pages = {
        "Main": [home_section, about_section],
        "Admin": [admin_hidden, settings_hidden],
    }
else:
    pages = [home_page, about_page, detail_page, admin_page]

# Configure navigation position based on query parameter
if nav_position == "top":
    pg = st.navigation(pages, position="top")
else:
    pg = st.navigation(pages)

pg.run()
