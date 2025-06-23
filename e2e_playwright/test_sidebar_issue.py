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

st.sidebar.markdown("# Sidebar")
st.markdown("# Main Page 🎈")

# Add a lot of content to test page overflow
for i in range(50):
    st.write(f"This is line {i + 1} of content to test page overflow behavior.")
    st.write(
        """Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        Ut enim ad minim veniam, quis nostrud exercitation ullamco
        laboris nisi ut aliquip ex ea commodo consequat."""
    )

    if i % 5 == 0:
        st.subheader(f"Section {i // 5 + 1}")
        st.info(
            "This is an info box to add more visual content and test scrolling behavior."
        )

    if i % 10 == 0:
        st.code(f"""
# Code block {i // 10 + 1}
def example_function_{i // 10 + 1}():
    return "This is a code block to test overflow with different content types"
        """)

    if i % 15 == 0:
        st.warning(
            "This is a warning message to test different content types during overflow."
        )

st.write(
    "End of content - if you can see this, you've scrolled through all the overflow content!"
)
