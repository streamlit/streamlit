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

import os

import streamlit as st

# Get the test mode from environment variable to test different sidebar states
test_mode = os.environ.get("STREAMLIT_SIDEBAR_TEST_MODE", "auto")

if test_mode == "collapsed":
    st.set_page_config(
        page_title="Sidebar Test - Collapsed", initial_sidebar_state="collapsed"
    )
elif test_mode == "expanded":
    st.set_page_config(
        page_title="Sidebar Test - Expanded", initial_sidebar_state="expanded"
    )
elif test_mode == "auto":
    st.set_page_config(page_title="Sidebar Test - Auto", initial_sidebar_state="auto")
else:
    # Default case - no page config set, should use default "auto" behavior
    st.set_page_config(page_title="Sidebar Test - Default")

# Add substantial sidebar content to ensure it's detected
st.sidebar.markdown("# Sidebar Content")
for i in range(10):
    st.sidebar.text(f"This is a text {i}")

# Main content
st.title(f"Main Layout Test - Mode: {test_mode}")
st.write(f"Testing sidebar behavior with initial_sidebar_state='{test_mode}'")

# Add some main content
for i in range(10):
    st.write(f"Main content line {i + 1}")
    if i % 3 == 0:
        st.info(f"Info box {i // 3 + 1}")

st.write("End of test content")
