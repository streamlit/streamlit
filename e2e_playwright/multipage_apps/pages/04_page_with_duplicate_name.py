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

st.header("Page 4")

with st.sidebar:
    st.page_link("mpa_configure_sidebar.py", label="Home", icon="🏠")
    st.page_link("pages/02_page2.py", label="Page 2", icon="📄")
    st.page_link("pages/03_page3.py", label="Page 3", icon="📈")
    st.page_link("pages/04_page_with_duplicate_name.py", label="Page 4", icon="🧪")
    st.page_link(
        "pages/05_page_with_duplicate_name.py", label="Page 5", icon="🌎", disabled=True
    )
