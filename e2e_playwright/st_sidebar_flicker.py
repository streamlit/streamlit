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

# Get the test mode from query params
test_mode = st.query_params.get("test_mode", "collapsed")

# Configure page based on test mode
if test_mode == "collapsed":
    st.set_page_config(
        page_title="Sidebar Flicker Test - Collapsed", initial_sidebar_state="collapsed"
    )
elif test_mode == "expanded":
    st.set_page_config(
        page_title="Sidebar Flicker Test - Expanded", initial_sidebar_state="expanded"
    )
elif test_mode == "auto":
    st.set_page_config(
        page_title="Sidebar Flicker Test - Auto", initial_sidebar_state="auto"
    )
elif test_mode == "no_config":
    # Don't call set_page_config at all
    pass
else:
    st.error(f"Unknown test mode: {test_mode}")

# Main content
st.title("Sidebar Flicker Test")
st.write(f"Test mode: {test_mode}")

# Add some sidebar content
with st.sidebar:
    st.header("Sidebar Content")
    st.write("This is sidebar content")
    st.button("Sidebar Button")
    st.selectbox("Sidebar Select", ["Option 1", "Option 2", "Option 3"])

# Add main content
st.write("This is main content")
st.button("Main Button")
