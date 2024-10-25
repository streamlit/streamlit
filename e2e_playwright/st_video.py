# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import time
from pathlib import Path

import requests

import streamlit as st

# Construct test assets path relative to this script file to
# allow its execution with different working directories.
TEST_ASSETS_DIR = Path(__file__).parent / "test_assets"

WEBM_VIDEO_PATH = TEST_ASSETS_DIR / "sintel-short.webm"
MP4_VIDEO_PATH = TEST_ASSETS_DIR / "sintel-short.mp4"
VTT_EN_PATH = TEST_ASSETS_DIR / "sintel-en.vtt"
VTT_DE_PATH = TEST_ASSETS_DIR / "sintel-de.vtt"

url = "https://www.w3schools.com/html/mov_bbb.mp4"
file = requests.get(url).content
st.video(file)

# Test start time with video
timestamp = st.number_input("Start Time (in seconds)", min_value=0, value=6)
st.video(url, start_time=int(timestamp))

# Test local file with video
st.video(str(MP4_VIDEO_PATH), start_time=17)
st.video(MP4_VIDEO_PATH, start_time=17)

# Test subtitle with video
st.video(
    str(MP4_VIDEO_PATH),
    start_time=31,
    subtitles={
        "English": VTT_EN_PATH,
        "Deutsch": VTT_DE_PATH,
    },
)

# Test subtitle with webm video
st.video(
    str(WEBM_VIDEO_PATH),
    start_time=25,
    subtitles={
        "English": VTT_EN_PATH,
        "Deutsch": VTT_DE_PATH,
    },
)


# Test end time webm video
st.video(
    str(WEBM_VIDEO_PATH),
    start_time=31,
    end_time=33,
)

# Test end time mp4 video
st.video(
    str(MP4_VIDEO_PATH),
    start_time=31,
    end_time=33,
)

# Test end time and loop webm video
st.video(str(WEBM_VIDEO_PATH), start_time=35, end_time=39, loop=True)

# Test end time and loop mp4 video
st.video(str(MP4_VIDEO_PATH), start_time=35, end_time=39, loop=True)

# Test autoplay with video
autoplay = st.checkbox("Autoplay", value=False)

if st.button("Create some elements to unmount component"):
    for _ in range(3):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")

st.video(
    str(WEBM_VIDEO_PATH),
    autoplay=autoplay,
)

# Test muted with video
st.video(
    str(WEBM_VIDEO_PATH),
    autoplay=True,
    muted=True,
)
