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

from typing import TYPE_CHECKING

from typing_extensions import assert_type

if TYPE_CHECKING:
    import io
    from datetime import timedelta
    from pathlib import Path

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.media import MediaMixin

    video = MediaMixin().video

    # =====================================================================
    # st.video return type tests
    # =====================================================================

    # Basic usage - returns DeltaGenerator
    assert_type(video("path/to/video.mp4"), DeltaGenerator)
    assert_type(video(Path("path/to/video.mp4")), DeltaGenerator)
    assert_type(video(b"binary video data"), DeltaGenerator)
    assert_type(video("https://example.com/video.mp4"), DeltaGenerator)
    assert_type(video("https://www.youtube.com/watch?v=abc123"), DeltaGenerator)
    assert_type(video(None), DeltaGenerator)

    # Video with format parameter
    assert_type(video("video.mp4", format="video/mp4"), DeltaGenerator)
    assert_type(video("video.webm", format="video/webm"), DeltaGenerator)
    assert_type(video("video.ogg", format="video/ogg"), DeltaGenerator)

    # Video with start_time parameter - int, float, timedelta, or str
    assert_type(video("video.mp4", start_time=0), DeltaGenerator)
    assert_type(video("video.mp4", start_time=30), DeltaGenerator)
    assert_type(video("video.mp4", start_time=1.5), DeltaGenerator)
    assert_type(video("video.mp4", start_time="10s"), DeltaGenerator)
    assert_type(video("video.mp4", start_time="1m30s"), DeltaGenerator)
    assert_type(video("video.mp4", start_time=timedelta(seconds=30)), DeltaGenerator)

    # Video with subtitles parameter - str, bytes, Path, BytesIO, or dict
    assert_type(video("video.mp4", subtitles="subtitles.vtt"), DeltaGenerator)
    assert_type(video("video.mp4", subtitles=Path("subtitles.srt")), DeltaGenerator)
    assert_type(
        video("video.mp4", subtitles=b"WEBVTT\n\n00:00:01.000..."), DeltaGenerator
    )
    bytes_io = io.BytesIO(b"WEBVTT")
    assert_type(video("video.mp4", subtitles=bytes_io), DeltaGenerator)
    assert_type(
        video(
            "video.mp4",
            subtitles={"English": "en.vtt", "French": "fr.vtt"},
        ),
        DeltaGenerator,
    )
    assert_type(video("video.mp4", subtitles=None), DeltaGenerator)

    # Video with end_time parameter - int, float, timedelta, str, or None
    assert_type(video("video.mp4", end_time=120), DeltaGenerator)
    assert_type(video("video.mp4", end_time=119.5), DeltaGenerator)
    assert_type(video("video.mp4", end_time="5m"), DeltaGenerator)
    assert_type(video("video.mp4", end_time=timedelta(minutes=5)), DeltaGenerator)
    assert_type(video("video.mp4", end_time=None), DeltaGenerator)

    # Video with loop parameter
    assert_type(video("video.mp4", loop=True), DeltaGenerator)
    assert_type(video("video.mp4", loop=False), DeltaGenerator)

    # Video with autoplay parameter
    assert_type(video("video.mp4", autoplay=True), DeltaGenerator)
    assert_type(video("video.mp4", autoplay=False), DeltaGenerator)

    # Video with muted parameter
    assert_type(video("video.mp4", muted=True), DeltaGenerator)
    assert_type(video("video.mp4", muted=False), DeltaGenerator)

    # Video with width parameter - "stretch" or int
    assert_type(video("video.mp4", width="stretch"), DeltaGenerator)
    assert_type(video("video.mp4", width=640), DeltaGenerator)

    # Video with all parameters combined
    assert_type(
        video(
            "video.mp4",
            format="video/mp4",
            start_time=10,
            subtitles="subtitles.vtt",
            end_time=300,
            loop=False,
            autoplay=True,
            muted=True,
            width="stretch",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid width value (not "stretch" or int - "content" is not valid for video)
    video("video.mp4", width="content")  # type: ignore[arg-type]

    # Passing subtitles as positional argument (should be keyword-only)
    video("video.mp4", "video/mp4", 0, "subtitles.vtt")  # type: ignore[misc]
