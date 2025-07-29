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

with st.container(direction="horizontal", border=True):
    st.markdown("Hello", width="stretch")
    st.markdown("Hello", width="stretch")
    st.markdown(
        "Really long test. Reallly long text. Really long text. This is a really long text. This is really long text.",
        width="stretch",
    )
    st.markdown("Hello", width="stretch")
    st.markdown("Hello", width="stretch")
    st.markdown(
        "Really long test. Reallly long text. Really long text.", width="stretch"
    )
    st.markdown("Hello", width="stretch")
    st.markdown("Hello", width="stretch")
    st.markdown(
        "Really long test. Reallly long text. Really long text.", width="stretch"
    )
    st.markdown("Hello", width="stretch")
    st.markdown("Hello", width="stretch")
    st.markdown("Hello", width="stretch")

st.subheader("Buttons with various label lengths")

with st.container(direction="horizontal", border=True):
    # Very short button
    st.button("A", width="stretch")

    # Short button
    st.button("OK", width="stretch")

    # Medium button
    st.button("Submit", width="stretch")

    # Longer button
    st.button("Download File", width="stretch")

    # Very long button
    st.button(
        "This is a really long button label that should test wrapping", width="stretch"
    )

    # Single character
    st.button("X", width="stretch")

with st.container(direction="horizontal", border=True):
    st.divider()

with st.container(direction="horizontal", border=True):
    st.markdown("---")
    st.markdown("---")
    st.markdown("---")
    st.markdown("---")

with st.container(direction="horizontal", border=True):
    st.info("Info")
    st.warning("Warning")
    st.error("Error")
    st.success("Success")
