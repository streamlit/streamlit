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

st.set_page_config(initial_sidebar_state="expanded")

st.header("SourGummy Font Test")

# Test the variable font files with string weight ranges
with st.container(key="weight_ranges_variable_font"):
    st.markdown("This is normal text with numbers 0123456789.")
    st.markdown("*This is italic text with numbers 0123456789.*")
    st.markdown("**This is bold text with numbers 0123456789.**")
    st.markdown("***This is bold-italic text with numbers 0123456789.***")

# Test the static font files with string and integer weights
with st.sidebar.container(key="numeric_string_weight"):
    st.markdown("This is normal text rendered as normal-thin.")
with st.sidebar.container(key="normal_string_weight"):
    st.markdown("*This is italic text rendered as normal-light.*")
with st.sidebar.container(key="integer_weight"):
    st.markdown("**This is bold text rendered as normal-semibold.**")
with st.sidebar.container(key="bold_string_weight"):
    st.markdown("***This is bold-italic text rendered as normal-black.***")
