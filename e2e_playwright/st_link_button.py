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

st.link_button("Default Link", url="https://streamlit.io")

st.link_button("Disabled Link", url="https://streamlit.io", disabled=True)

st.link_button("Primary Link", url="https://streamlit.io", type="primary")

st.link_button(
    "primary disabled",
    url="https://streamlit.io",
    type="primary",
    disabled=True,
)

st.link_button(
    "Container **full width** *markdown*",
    "https://streamlit.io",
    use_container_width=True,
    help="help text",
)

st.link_button(
    "Container **full width** *markdown* ~~primary~~",
    "https://streamlit.io",
    type="primary",
    use_container_width=True,
    help="help text here",
)

st.link_button(
    "Link Button with emoji icon",
    "https://streamlit.io",
    icon="🎈",
)

st.link_button(
    "Link Button with Material icon",
    "https://streamlit.io",
    icon=":material/bolt:",
)

st.link_button("Tertiary link button", url="https://streamlit.io", type="tertiary")

st.link_button(
    "Disabled tertiary link",
    url="https://streamlit.io",
    type="tertiary",
    disabled=True,
)

st.link_button(
    "Tertiary link - container width",
    url="https://streamlit.io",
    type="tertiary",
    use_container_width=True,
)

st.link_button(
    "Link Button with help",
    url="https://streamlit.io",
    help="help text",
)
