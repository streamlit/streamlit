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

with st.expander("Various text elements", expanded=True):
    st.text("This text is awesome!")
    st.text("_This text is **awesome**!_")
    st.text("Text with a help tooltip", help="This is a help tooltip!")
    st.text("Lorem\n\n\n\nipsum\ndolor\nsit\namet")
    st.text("Lorem\\nipsum")
    st.text("Lorem      ipsum\tdolor\t\tsit amet")
    st.text(
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore "
        "magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea "
        "consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla. "
        "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
    )

st.text(
    "This is a text with content width.",
    width="content",
)
st.text(
    "This is a text with stretch width.",
    width="stretch",
)
st.text(
    """This is a text with fixed width of 300 pixels.
    The container will be exactly 300 pixels wide,
    regardless of the content or parent container.
    The text will wrap within this fixed width.
    This is useful when you want precise control over the text container's width,
    regardless of the content or surrounding elements.""",
    width=300,
)
