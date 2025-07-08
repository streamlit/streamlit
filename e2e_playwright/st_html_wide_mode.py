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

# Set up the page with wide layout and initial sidebar collapsed.
st.set_page_config(
    page_title="HTML with Sidebar",
    layout="wide",
)

with st.sidebar:
    st.title("HTML with Sidebar")


st.html("""
<div style="background-color: lightblue; padding: 20px; color: black;">
    <h1>Content in HTML</h1>
</div>
""")
