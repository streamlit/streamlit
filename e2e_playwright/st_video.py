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

import time
from pathlib import Path

import streamlit as st

# Construct test assets path relative to this script file to
# allow its execution with different working directories.
TEST_ASSETS_DIR = Path(__file__).parent / "test_assets"

WEBM_VIDEO_PATH = TEST_ASSETS_DIR / "sintel-short.webm"
MP4_VIDEO_PATH = TEST_ASSETS_DIR / "sintel-short.mp4"
VTT_EN_PATH = TEST_ASSETS_DIR / "sintel-en.vtt"
VTT_DE_PATH = TEST_ASSETS_DIR / "sintel-de.vtt"

mp4_video = "mp4 video"
mp4_video_with_subtitles = "mp4 video with subtitles"
webm_video_with_subtitles = "webm video with subtitles"
webm_video_with_end_time = "webm video with end time"
mp4_video_with_end_time = "mp4 video with end time"
webm_video_with_end_time_and_loop = "webm video with end time and loop"
mp4_video_with_end_time_and_loop = "mp4 video with end time and loop"
webm_video_with_autoplay = "webm video with autoplay"
webm_video_muted = "webm video muted"
webm_video_width_pixel = "webm video with pixel width"
webm_video_width_stretch = "webm video with stretch width"

video_to_show = st.radio(
    "Choose a video to show",
    [
        "None",
        mp4_video,
        mp4_video_with_subtitles,
        webm_video_with_subtitles,
        webm_video_with_end_time,
        mp4_video_with_end_time,
        webm_video_with_end_time_and_loop,
        mp4_video_with_end_time_and_loop,
        webm_video_with_autoplay,
        webm_video_muted,
        webm_video_width_pixel,
        webm_video_width_stretch,
    ],
    index=0,
)

if video_to_show == mp4_video:
    # Test local file with video
    st.video(str(MP4_VIDEO_PATH), start_time=17)
    st.video(MP4_VIDEO_PATH, start_time=17)

if video_to_show == mp4_video_with_subtitles:
    # Test subtitle with video
    st.video(
        str(MP4_VIDEO_PATH),
        start_time=31,
        subtitles={
            "English": VTT_EN_PATH,
            "Deutsch": VTT_DE_PATH,
        },
    )

if video_to_show == webm_video_with_subtitles:
    # Test subtitle with webm video
    st.video(
        str(WEBM_VIDEO_PATH),
        start_time=25,
        subtitles={
            "English": VTT_EN_PATH,
            "Deutsch": VTT_DE_PATH,
        },
    )

if video_to_show == webm_video_with_end_time:
    # Test end time webm video
    st.video(
        str(WEBM_VIDEO_PATH),
        start_time=31,
        end_time=33,
    )

if video_to_show == mp4_video_with_end_time:
    # Test end time mp4 video
    st.video(
        str(MP4_VIDEO_PATH),
        start_time=31,
        end_time=33,
    )

if video_to_show == webm_video_with_end_time_and_loop:
    # Test end time and loop webm video
    st.video(str(WEBM_VIDEO_PATH), start_time=35, end_time=39, loop=True)

if video_to_show == mp4_video_with_end_time_and_loop:
    # Test end time and loop mp4 video
    st.video(str(MP4_VIDEO_PATH), start_time=35, end_time=39, loop=True)

if video_to_show == webm_video_with_autoplay:
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

if video_to_show == webm_video_muted:
    # Test muted with video
    st.video(
        str(WEBM_VIDEO_PATH),
        autoplay=True,
        muted=True,
    )

if video_to_show == webm_video_width_pixel:
    # Test video with pixel width
    st.video(
        str(WEBM_VIDEO_PATH),
        width=400,
    )

if video_to_show == webm_video_width_stretch:
    # Test video with stretch width
    st.video(
        str(WEBM_VIDEO_PATH),
        width="stretch",
    )
