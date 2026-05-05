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
    from datetime import timedelta
    from pathlib import Path

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.media import MediaMixin

    audio = MediaMixin().audio

    # =====================================================================
    # st.audio return type tests
    # =====================================================================

    # Basic usage - returns DeltaGenerator
    assert_type(audio("path/to/audio.wav"), DeltaGenerator)
    assert_type(audio(Path("path/to/audio.wav")), DeltaGenerator)
    assert_type(audio(b"binary audio data"), DeltaGenerator)
    assert_type(audio("https://example.com/audio.mp3"), DeltaGenerator)
    assert_type(audio(None), DeltaGenerator)

    # Audio with format parameter
    assert_type(audio("audio.wav", format="audio/wav"), DeltaGenerator)
    assert_type(audio("audio.mp3", format="audio/mpeg"), DeltaGenerator)
    assert_type(audio("audio.ogg", format="audio/ogg"), DeltaGenerator)

    # Audio with start_time parameter - int, float, timedelta, or str
    assert_type(audio("audio.wav", start_time=0), DeltaGenerator)
    assert_type(audio("audio.wav", start_time=30), DeltaGenerator)
    assert_type(audio("audio.wav", start_time=1.5), DeltaGenerator)
    assert_type(audio("audio.wav", start_time="10s"), DeltaGenerator)
    assert_type(audio("audio.wav", start_time="1m30s"), DeltaGenerator)
    assert_type(audio("audio.wav", start_time=timedelta(seconds=30)), DeltaGenerator)

    # Audio with sample_rate parameter (used with numpy arrays; bytes used here as a
    # stand-in since numpy cannot be imported under TYPE_CHECKING)
    assert_type(audio(b"audio", sample_rate=44100), DeltaGenerator)
    assert_type(audio(b"audio", sample_rate=None), DeltaGenerator)

    # Audio with end_time parameter - int, float, timedelta, str, or None
    assert_type(audio("audio.wav", end_time=60), DeltaGenerator)
    assert_type(audio("audio.wav", end_time=59.5), DeltaGenerator)
    assert_type(audio("audio.wav", end_time="2m"), DeltaGenerator)
    assert_type(audio("audio.wav", end_time=timedelta(minutes=2)), DeltaGenerator)
    assert_type(audio("audio.wav", end_time=None), DeltaGenerator)

    # Audio with loop parameter
    assert_type(audio("audio.wav", loop=True), DeltaGenerator)
    assert_type(audio("audio.wav", loop=False), DeltaGenerator)

    # Audio with autoplay parameter
    assert_type(audio("audio.wav", autoplay=True), DeltaGenerator)
    assert_type(audio("audio.wav", autoplay=False), DeltaGenerator)

    # Audio with width parameter - "stretch" or int
    assert_type(audio("audio.wav", width="stretch"), DeltaGenerator)
    assert_type(audio("audio.wav", width=400), DeltaGenerator)

    # Audio with all parameters combined
    assert_type(
        audio(
            "audio.mp3",
            format="audio/mpeg",
            start_time=10,
            sample_rate=None,
            end_time=120,
            loop=True,
            autoplay=False,
            width="stretch",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid width value (not "stretch" or int)
    audio("audio.wav", width="content")  # type: ignore[arg-type]

    # Passing sample_rate as positional argument (should be keyword-only)
    audio("audio.wav", "audio/wav", 0, 44100)  # type: ignore[misc]
