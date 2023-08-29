# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

st.link_button("the label", url="https://streamlit.io")

st.link_button("disabled", url="https://streamlit.io", disabled=True)

st.link_button("primary", url="https://streamlit.io", type="primary")

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
