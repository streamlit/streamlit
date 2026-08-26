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

"""E2E test app for st.bottom container without chat_input.

This app tests that st.bottom content WITHOUT a chat_input does NOT trigger
the scroll-to-bottom behavior. This is the key behavioral change where
bottom content alone should not activate auto-scroll.
"""

import streamlit as st

st.title("Testing st.bottom without chat_input")

# Main content
for i in range(5):
    st.write(f"Main content line {i + 1}")

# Bottom container with various elements but NO chat_input
with st.bottom:
    st.markdown("**Bottom toolbar without chat input**")
    col1, col2 = st.columns(2)
    with col1:
        if st.button("Action 1", key="action1"):
            st.session_state["action1_clicked"] = True
    with col2:
        if st.button("Action 2", key="action2"):
            st.session_state["action2_clicked"] = True

# Show status from toolbar actions
if st.session_state.get("action1_clicked"):
    st.write("Action 1 clicked!")
if st.session_state.get("action2_clicked"):
    st.write("Action 2 clicked!")
