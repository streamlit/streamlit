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

import streamlit as st

st.divider()
st.divider(width=600)
st.divider(width="stretch")

with st.container(key="divider_spacing_standalone", border=True):
    st.write("Above standalone divider")
    st.divider()
    st.write("Below standalone divider")

with st.container(key="divider_spacing_write", border=True):
    st.write("Above write divider")
    st.write("---")
    st.write("Below write divider")

with st.container(key="divider_spacing_markdown", border=True):
    st.markdown("Above markdown divider\n\n---\n\nBelow markdown divider")
