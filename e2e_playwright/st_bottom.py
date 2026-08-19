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

"""E2E test app for st.bottom container."""

import streamlit as st

st.title("Testing st.bottom")

# st.bottom.<element>() from within an expander writes to bottom, not the expander
st.write("Main content above")
with st.expander("Expander with st.bottom call"):
    st.write("This is inside the expander")
    st.bottom.write(
        "Direct call: st.bottom.write() - should be in bottom, not expander"
    )
st.write("Main content below")

# Context manager pattern
with st.bottom:
    st.markdown("**Context manager**: `with st.bottom:`")

# Simple widget in bottom
if st.bottom.button("Bottom button", key="bottom_button"):
    st.write("Bottom button was clicked!")

# Toolbar with horizontal layout (common pattern for chat interfaces)
with st.bottom:
    with st.container(horizontal=True, vertical_alignment="center"):
        prompt = st.chat_input("Type a message...", key="toolbar_chat_input")
        if st.button("Attach", key="attach_btn"):
            st.session_state["attached"] = True
        if st.button("Clear", key="clear_btn"):
            st.session_state["cleared"] = True

# Show status from toolbar actions
if prompt:
    st.write(f"Chat input received: {prompt}")
if st.session_state.get("attached"):
    st.write("Attach button clicked!")
if st.session_state.get("cleared"):
    st.write("Clear button clicked!")
