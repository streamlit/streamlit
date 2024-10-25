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

st.header("Audio from bytes")
url1 = "https://www.w3schools.com/html/horse.ogg"
file = requests.get(url1).content
st.audio(file)

st.header("Audio from URL")
url2 = "https://mdn.github.io/learning-area/html/multimedia-and-embedding/video-and-audio-content/viper.mp3"
st.audio(url2, start_time=10, end_time=13)
st.audio(url2, start_time=15, end_time=19, loop=True)

st.header("Audio from mp3 file (str and Path)")
CAT_AUDIO = TEST_ASSETS_DIR / "cat-purr.mp3"
st.audio(str(CAT_AUDIO))
st.audio(CAT_AUDIO)

st.header("Autoplay)")
autoplay = st.checkbox("Autoplay", value=False)
if st.button("Create some elements to unmount component"):
    for _ in range(3):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")
st.audio(url2, autoplay=autoplay)
