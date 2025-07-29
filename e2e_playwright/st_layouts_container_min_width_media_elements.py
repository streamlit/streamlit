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

st.subheader("Images in horizontal containers")

with st.container(direction="horizontal", border=True):
    st.image(
        "e2e_playwright/static/cat.jpg", caption="Cat Photo", use_container_width=True
    )
    st.image(
        "e2e_playwright/static/streamlit-logo.png",
        caption="Streamlit Logo",
        use_container_width=True,
    )
    st.image(
        "e2e_playwright/static/streamlit-mark.png",
        caption="Streamlit Mark",
        use_container_width=True,
    )

with st.container(direction="horizontal", border=True):
    st.image("e2e_playwright/static/streamlit-mark.png", width=100)
    st.image("e2e_playwright/static/streamlit-mark.png", width=150)
    st.image("e2e_playwright/static/streamlit-mark.png", width=200)
    st.image("e2e_playwright/static/streamlit-mark.png", use_container_width=True)

st.subheader("Audio elements in horizontal containers")

with st.container(direction="horizontal", border=True):
    st.audio("e2e_playwright/test_assets/cat-purr.mp3")
    st.audio("e2e_playwright/test_assets/cat-purr.mp3")
    st.audio("e2e_playwright/test_assets/cat-purr.mp3")

st.subheader("Video elements in horizontal containers")

# Note: Using a sample video URL since we may not have video files in test assets
sample_video_url = "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4"


with st.container(direction="horizontal", border=True):
    try:
        st.video(sample_video_url)
        st.video(sample_video_url)
    except Exception:
        st.info("Video 1 placeholder")
        st.info("Video 2 placeholder")


st.subheader("Media with captions and controls")

with st.container(direction="horizontal", border=True):
    st.button("▶️", width="content")
    st.audio("e2e_playwright/test_assets/cat-purr.mp3")
    st.button("⏸️", width="content")

with st.container(direction="horizontal", border=True):
    st.button("⏪", width="content")
    try:
        st.video(sample_video_url)
    except Exception:
        st.info("Video player placeholder")
    st.button("⏩", width="content")
