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

# Perform type checking tests for st.audio_input
# The return type is always UploadedFile | None
if TYPE_CHECKING:
    from streamlit.elements.widgets.audio_input import AudioInputMixin
    from streamlit.runtime.uploaded_file_manager import UploadedFile

    audio_input = AudioInputMixin().audio_input

    # =====================================================================
    # Basic return type tests
    # =====================================================================

    assert_type(audio_input("Record audio"), UploadedFile | None)

    # =====================================================================
    # Test sample_rate parameter
    # =====================================================================

    # Default sample rate (16000)
    assert_type(audio_input("Record audio", sample_rate=16000), UploadedFile | None)

    # Other valid sample rates
    assert_type(audio_input("Record audio", sample_rate=8000), UploadedFile | None)
    assert_type(audio_input("Record audio", sample_rate=11025), UploadedFile | None)
    assert_type(audio_input("Record audio", sample_rate=22050), UploadedFile | None)
    assert_type(audio_input("Record audio", sample_rate=24000), UploadedFile | None)
    assert_type(audio_input("Record audio", sample_rate=32000), UploadedFile | None)
    assert_type(audio_input("Record audio", sample_rate=44100), UploadedFile | None)
    assert_type(audio_input("Record audio", sample_rate=48000), UploadedFile | None)

    # None for browser default
    assert_type(audio_input("Record audio", sample_rate=None), UploadedFile | None)

    # =====================================================================
    # Test key parameter (str or int)
    # =====================================================================

    assert_type(audio_input("Record audio", key="audio_key"), UploadedFile | None)
    assert_type(audio_input("Record audio", key=123), UploadedFile | None)
    assert_type(audio_input("Record audio", key=None), UploadedFile | None)

    # =====================================================================
    # Test help parameter
    # =====================================================================

    assert_type(
        audio_input("Record audio", help="Click to start recording"),
        UploadedFile | None,
    )
    assert_type(audio_input("Record audio", help=None), UploadedFile | None)

    # =====================================================================
    # Test disabled parameter
    # =====================================================================

    assert_type(audio_input("Record audio", disabled=True), UploadedFile | None)
    assert_type(audio_input("Record audio", disabled=False), UploadedFile | None)

    # =====================================================================
    # Test label_visibility parameter
    # =====================================================================

    assert_type(
        audio_input("Record audio", label_visibility="visible"), UploadedFile | None
    )
    assert_type(
        audio_input("Record audio", label_visibility="hidden"), UploadedFile | None
    )
    assert_type(
        audio_input("Record audio", label_visibility="collapsed"), UploadedFile | None
    )

    # =====================================================================
    # Test width parameter
    # =====================================================================

    assert_type(audio_input("Record audio", width="stretch"), UploadedFile | None)
    assert_type(audio_input("Record audio", width=400), UploadedFile | None)

    # =====================================================================
    # Test callback parameters (on_change, args, kwargs)
    # =====================================================================

    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(audio_input("Record audio", on_change=my_callback), UploadedFile | None)
    assert_type(
        audio_input("Record audio", on_change=callback_with_args, args=(1, "test")),
        UploadedFile | None,
    )
    assert_type(
        audio_input(
            "Record audio", on_change=callback_with_args, kwargs={"x": 1, "y": "a"}
        ),
        UploadedFile | None,
    )
    assert_type(audio_input("Record audio", on_change=None), UploadedFile | None)

    # =====================================================================
    # Test with all parameters combined
    # =====================================================================

    assert_type(
        audio_input(
            "Full audio input",
            sample_rate=44100,
            key="full_audio",
            help="Record your voice message",
            on_change=my_callback,
            args=None,
            kwargs=None,
            disabled=False,
            label_visibility="visible",
            width="stretch",
        ),
        UploadedFile | None,
    )

    # =====================================================================
    # Test with all parameters combined (different values)
    # =====================================================================

    assert_type(
        audio_input(
            "High quality recording",
            sample_rate=48000,
            key=42,
            help="This records in high fidelity",
            on_change=callback_with_args,
            args=(1, "audio"),
            kwargs=None,
            disabled=True,
            label_visibility="hidden",
            width=500,
        ),
        UploadedFile | None,
    )

    # =====================================================================
    # Test with browser default sample rate
    # =====================================================================

    assert_type(
        audio_input(
            "Browser default audio",
            sample_rate=None,
            key="browser_default",
            help=None,
            on_change=None,
            args=None,
            kwargs=None,
            disabled=False,
            label_visibility="collapsed",
            width=300,
        ),
        UploadedFile | None,
    )
