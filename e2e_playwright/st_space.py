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

from __future__ import annotations

from typing import TYPE_CHECKING, cast

import streamlit as st

if TYPE_CHECKING:
    from streamlit.elements.lib.layout_utils import Gap

SPACES = cast(
    "list[Gap]",
    [
        "xxsmall",
        "xsmall",
        "small",
        "medium",
        "large",
        "xlarge",
        "xxlarge",
    ],
)

st.write("Tests Outside of Containers")

for space_names in SPACES:
    with st.expander(f"Space set to {space_names}", expanded=True):
        st.button(f"Before {space_names} space")
        st.space(space_names)
        st.button(f"After {space_names} space")

st.divider()

with st.container(horizontal=True, border=True, key="horizontal_container_space"):
    st.markdown("Left", width="content")
    st.space("medium")
    st.markdown("After medium space", width="content")
    st.space("stretch")
    st.markdown("After stretch space", width="content")

# vertical container with stretch space
with st.container(height=400, key="vertical_container_space"):
    st.space(25)
    st.write("After 25px space")
    st.space("stretch")
    st.write("After stretch space")
    st.space()
    st.write("After default small space")


st.divider()

st.header("Nested Container Test")

with st.container(border=True, key="nested_container_space"):
    st.write("Outer container")
    st.space("large")
    with st.container(border=True, horizontal=True):
        st.button("Inner Left")
        st.space("stretch")
        st.button("Inner Right")
    st.space("medium")
    st.write("Bottom of outer container")


st.divider()
st.header("Frontend/Backend Size Sync Test")
st.write(
    "This section validates that space sizes match actual widget heights "
    "from the frontend theme (sizes.ts)."
)

# Test medium space (2.5rem) matches minElementHeight (used by buttons, inputs)
# Test large space (4.25rem) matches largestElementHeight (used by file uploader, audio input)
with st.container(key="size_sync_test"):
    st.button("Reference button", key="sync_button")
    st.space("medium")
    st.file_uploader("Reference uploader", key="sync_uploader")
    st.space("large")
