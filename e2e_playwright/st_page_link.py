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

# Note this covers testing page links for single-page apps (external page links)

st.page_link("http://www.example.com", label="Default Example")
st.page_link("http://www.example.com", label="Icon Example", icon="🌎")
st.page_link("http://www.example.com", label="Help Example", help="Some help text")
st.page_link("http://www.example.com", label="Disabled Example", disabled=True)

# Default is container width=false in main app section
st.page_link(
    "http://www.example.com",
    label="Main container_width=true",
    use_container_width=True,
)

# Test Material icon
st.page_link(
    "http://www.example.com", label="Material Icon Example", icon=":material/home:"
)


# Test st.Page objects - create pages with different icon scenarios
def dummy_page():
    st.write("This is a dummy page")


# Create page objects to test st.Page -> st.page_link workflow
page_with_icon = st.Page(dummy_page, title="Page with Icon", icon="🌎")
page_with_material_icon = st.Page(
    dummy_page, title="Page with Material Icon", icon=":material/star:"
)

# Test passing st.Page objects to st.page_link
st.page_link(page_with_icon, label="Page Link with Icon from st.Page")
st.page_link(page_with_material_icon, label="Page Link with Material Icon from st.Page")

# Test overriding page icons in st.page_link
st.page_link(page_with_icon, label="Override Page Icon from st.Page", icon="🔥")

with st.sidebar:
    st.page_link("http://www.example.com", label="Default Sidebar")
    st.page_link("http://www.example.com", label="Icon Sidebar", icon="🌎")
    st.page_link("http://www.example.com", label="Help Sidebar", help="Some help text")
    st.page_link("http://www.example.com", label="Disabled Sidebar", disabled=True)
    # Page links are container width by default in the sidebar
    st.page_link(
        "http://www.example.com",
        label="Sidebar container_width=false",
        use_container_width=False,
    )
