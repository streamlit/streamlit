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

"""Test app for relative static URLs (/app/static/) in media elements.

This tests the feature that allows users to reference files served from
Streamlit's static file serving endpoint using relative URLs like
`/app/static/my_image.png`.

See: https://github.com/streamlit/streamlit/issues/12104
"""

from __future__ import annotations

import streamlit as st

st.header("Static URLs for media elements")

# Test st.image with static URL
st.subheader("st.image with /app/static/ URL")
st.image("/app/static/streamlit-logo.png", caption="Streamlit logo from static")

# Test st.audio with static URL
st.subheader("st.audio with /app/static/ URL")
st.audio("/app/static/cat-purr.mp3", format="audio/mp3")

# Test st.video with static URL
st.subheader("st.video with /app/static/ URL")
st.video("/app/static/sintel-short.webm", format="video/webm")

# Test st.chat_message with avatar using static URL
st.subheader("st.chat_message with avatar from /app/static/")
with st.chat_message("user", avatar="/app/static/streamlit-mark.png"):
    st.write("Hello! My avatar comes from a static URL.")

# Test st.set_page_config with page_icon (already supports URLs, but verify)
# Note: page_icon is set via st.set_page_config which must be first command
# So we just verify it doesn't error - the actual icon won't be visible in the test

# Test st.logo with static URL
st.subheader("st.logo with /app/static/ URL")
st.logo("/app/static/streamlit-logo-small.png")

st.success("All static URL elements rendered successfully!")
