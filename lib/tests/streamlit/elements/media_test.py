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

"""media.py unit tests that are common to st.audio + st.video"""

import io
from enum import Enum
from pathlib import Path
from unittest import mock

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.cursor import make_delta_path
from streamlit.elements.media import (
    TIMEDELTA_PARSE_ERROR_MESSAGE,
    MediaData,
    MediaMixin,
    _marshall_av_media,
    _parse_start_time_end_time,
    marshall_video,
)
from streamlit.errors import StreamlitAPIException, StreamlitInvalidWidthError
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.proto.Video_pb2 import Video as VideoProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.elements.layout_test_utils import WidthConfigFields


class MockMediaKind(Enum):
    AUDIO = "audio"
    VIDEO = "video"


class MediaTest(DeltaGeneratorTestCase):
    @parameterized.expand(
        [
            ("foo.wav", "audio/wav", MockMediaKind.AUDIO, False),
            (Path("foo.wav"), "audio/wav", MockMediaKind.AUDIO, False),
            ("path/to/foo.wav", "audio/wav", MockMediaKind.AUDIO, False),
            (Path("path/to/foo.wav"), "audio/wav", MockMediaKind.AUDIO, False),
            (b"fake_audio_data", "audio/wav", MockMediaKind.AUDIO, False),
            ("https://foo.com/foo.wav", "audio/wav", MockMediaKind.AUDIO, True),
            ("/app/static/foo.wav", "audio/wav", MockMediaKind.AUDIO, True),
            ("foo.mp4", "video/mp4", MockMediaKind.VIDEO, False),
            (Path("foo.mp4"), "video/mp4", MockMediaKind.VIDEO, False),
            ("path/to/foo.mp4", "video/mp4", MockMediaKind.VIDEO, False),
            (Path("path/to/foo.mp4"), "video/mp4", MockMediaKind.VIDEO, False),
            (b"fake_video_data", "video/mp4", MockMediaKind.VIDEO, False),
            ("https://foo.com/foo.mp4", "video/mp4", MockMediaKind.VIDEO, True),
            ("/app/static/foo.mp4", "video/mp4", MockMediaKind.VIDEO, True),
        ]
    )
    def test_add_bytes_and_filenames_to_mediafilemanager(
        self,
        media_data: MediaData,
        mimetype: str,
        media_kind: MockMediaKind,
        is_url: bool,
    ):
        """st.audio + st.video should register bytes and filenames with the
        MediaFileManager. URL-based media does not go through the MediaFileManager.
        """
        with (
            mock.patch(
                "streamlit.runtime.media_file_manager.MediaFileManager.add"
            ) as mock_mfm_add,
            mock.patch("streamlit.runtime.caching.save_media_data"),
        ):
            mock_mfm_add.return_value = "https://mockoutputurl.com"

            if media_kind is MockMediaKind.AUDIO:
                st.audio(media_data, mimetype)
                element = self.get_delta_from_queue().new_element
                element_url = element.audio.url
            else:
                st.video(media_data, mimetype)
                element = self.get_delta_from_queue().new_element
                element_url = element.video.url

            if is_url:
                # URLs should be returned as-is, and should not result in a call to
                # MediaFileManager.add
                assert media_data == element_url
                mock_mfm_add.assert_not_called()
            else:
                # Other strings, Path objects, and audio/video data, should be passed to
                # MediaFileManager.add
                expected_media_data = (
                    str(media_data) if isinstance(media_data, Path) else media_data
                )
                mock_mfm_add.assert_called_once_with(
                    expected_media_data,
                    mimetype,
                    str(make_delta_path(RootContainer.MAIN, (), 0)),
                )
                assert element_url == "https://mockoutputurl.com"

    def test_audio_width_config_default(self):
        """Test that default width is 'stretch' for audio."""
        with (
            mock.patch(
                "streamlit.runtime.media_file_manager.MediaFileManager.add"
            ) as mock_mfm_add,
            mock.patch("streamlit.runtime.caching.save_media_data"),
        ):
            mock_mfm_add.return_value = "https://mockoutputurl.com"
            st.audio("foo.wav", "audio/wav")
            c = self.get_delta_from_queue().new_element.audio

            assert (
                c.width_config.WhichOneof("width_spec")
                == WidthConfigFields.USE_STRETCH.value
            )
            assert c.width_config.use_stretch

    def test_video_width_config_default(self):
        """Test that default width is 'stretch' for video."""
        with (
            mock.patch(
                "streamlit.runtime.media_file_manager.MediaFileManager.add"
            ) as mock_mfm_add,
            mock.patch("streamlit.runtime.caching.save_media_data"),
        ):
            mock_mfm_add.return_value = "https://mockoutputurl.com"
            st.video("foo.mp4", "video/mp4")
            c = self.get_delta_from_queue().new_element.video

            assert (
                c.width_config.WhichOneof("width_spec")
                == WidthConfigFields.USE_STRETCH.value
            )
            assert c.width_config.use_stretch

    def test_audio_width_config_pixel(self):
        """Test that pixel width works properly for audio."""
        with (
            mock.patch(
                "streamlit.runtime.media_file_manager.MediaFileManager.add"
            ) as mock_mfm_add,
            mock.patch("streamlit.runtime.caching.save_media_data"),
        ):
            mock_mfm_add.return_value = "https://mockoutputurl.com"
            st.audio("foo.wav", "audio/wav", width=200)
            c = self.get_delta_from_queue().new_element.audio

            assert (
                c.width_config.WhichOneof("width_spec")
                == WidthConfigFields.PIXEL_WIDTH.value
            )
            assert c.width_config.pixel_width == 200

    def test_video_width_config_pixel(self):
        """Test that pixel width works properly for video."""
        with (
            mock.patch(
                "streamlit.runtime.media_file_manager.MediaFileManager.add"
            ) as mock_mfm_add,
            mock.patch("streamlit.runtime.caching.save_media_data"),
        ):
            mock_mfm_add.return_value = "https://mockoutputurl.com"
            st.video("foo.mp4", "video/mp4", width=200)
            c = self.get_delta_from_queue().new_element.video

            assert (
                c.width_config.WhichOneof("width_spec")
                == WidthConfigFields.PIXEL_WIDTH.value
            )
            assert c.width_config.pixel_width == 200

    def test_audio_width_config_stretch(self):
        """Test that 'stretch' width works properly for audio."""
        with (
            mock.patch(
                "streamlit.runtime.media_file_manager.MediaFileManager.add"
            ) as mock_mfm_add,
            mock.patch("streamlit.runtime.caching.save_media_data"),
        ):
            mock_mfm_add.return_value = "https://mockoutputurl.com"
            st.audio("foo.wav", "audio/wav", width="stretch")
            c = self.get_delta_from_queue().new_element.audio

            assert (
                c.width_config.WhichOneof("width_spec")
                == WidthConfigFields.USE_STRETCH.value
            )
            assert c.width_config.use_stretch

    def test_video_width_config_stretch(self):
        """Test that 'stretch' width works properly for video."""
        with (
            mock.patch(
                "streamlit.runtime.media_file_manager.MediaFileManager.add"
            ) as mock_mfm_add,
            mock.patch("streamlit.runtime.caching.save_media_data"),
        ):
            mock_mfm_add.return_value = "https://mockoutputurl.com"
            st.video("foo.mp4", "video/mp4", width="stretch")
            c = self.get_delta_from_queue().new_element.video

            assert (
                c.width_config.WhichOneof("width_spec")
                == WidthConfigFields.USE_STRETCH.value
            )
            assert c.width_config.use_stretch

    @parameterized.expand(
        [
            ("invalid",),
            (-100,),
            (0,),
            (100.5,),
            (None,),
        ]
    )
    def test_audio_invalid_width(self, width):
        """Test that invalid width values raise exceptions for audio."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.audio("foo.wav", "audio/wav", width=width)

    @parameterized.expand(
        [
            ("invalid",),
            (-100,),
            (0,),
            (100.5,),
            (None,),
        ]
    )
    def test_video_invalid_width(self, width):
        """Test that invalid width values raise exceptions for video."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.video("foo.mp4", "video/mp4", width=width)


class _RawIOReadReturnsNone(io.RawIOBase):
    """Minimal RawIOBase whose read() returns None (non-standard but handled)."""

    def readable(self) -> bool:
        return True

    def seek(self, offset: int, whence: int = io.SEEK_SET) -> int:
        return 0

    def read(self, n: int = -1) -> bytes | None:  # type: ignore[override]
        return None


def test_media_mixin_dg_returns_self() -> None:
    """``MediaMixin.dg`` returns the mixin instance."""

    class _OnlyMedia(MediaMixin):
        pass

    media_mixin = _OnlyMedia()
    assert media_mixin.dg is media_mixin


def test_marshall_av_media_raw_io_read_returns_none() -> None:
    """When RawIOBase.read() returns None, marshalling returns without setting a URL."""
    proto = VideoProto()
    _marshall_av_media("coord", proto, _RawIOReadReturnsNone(), "video/mp4")
    assert proto.url == ""


@pytest.mark.parametrize("invalid_data", [42, 3.14, object()])
def test_marshall_av_media_invalid_binary_type_raises(invalid_data: object) -> None:
    """Unsupported data types should raise RuntimeError."""
    proto = VideoProto()
    with pytest.raises(RuntimeError, match="Invalid binary data format"):
        _marshall_av_media("coord", proto, invalid_data, "video/mp4")  # type: ignore[arg-type]


def test_marshall_av_media_no_runtime_sets_empty_url() -> None:
    """Without a Streamlit runtime, the proto URL should stay empty."""
    proto = VideoProto()
    with mock.patch("streamlit.elements.media.runtime.exists", return_value=False):
        _marshall_av_media("coord", proto, b"data", "video/mp4")
    assert proto.url == ""


@pytest.mark.parametrize(
    ("start_time", "end_time"),
    [
        (-1, None),
        (0, 0),
        (10, 5),
    ],
)
def test_marshall_video_invalid_start_end_times(
    start_time: int, end_time: int | None
) -> None:
    """Negative start_time or end_time not after start_time should error."""
    proto = VideoProto()
    with pytest.raises(
        StreamlitAPIException, match="Invalid start_time and end_time combination"
    ):
        marshall_video(
            mock.Mock(),
            "coord",
            proto,
            b"video-bytes",
            start_time=start_time,
            end_time=end_time,
        )


def test_marshall_video_youtube_with_subtitles_raises() -> None:
    """Subtitles are rejected for YouTube iframe URLs."""
    proto = VideoProto()
    with pytest.raises(
        StreamlitAPIException, match="Subtitles are not supported for YouTube"
    ):
        marshall_video(
            mock.Mock(),
            "coord",
            proto,
            "https://youtu.be/dQw4w9WgXcQ",
            subtitles={"en": "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nx"},
        )


@pytest.mark.parametrize("bad_subtitles", [["x"], [0], 123])
def test_marshall_video_unsupported_subtitles_type_raises(
    bad_subtitles: object,
) -> None:
    """Reject subtitle containers that are not str, bytes, Path, BytesIO, or dict."""
    proto = VideoProto()
    with pytest.raises(
        StreamlitAPIException, match="Unsupported data type for subtitles"
    ):
        marshall_video(
            mock.Mock(),
            "coord",
            proto,
            "https://example.com/video.mp4",
            subtitles=bad_subtitles,  # type: ignore[arg-type]
        )


def test_parse_start_end_time_none_start_raises() -> None:
    """None start_time is converted via time_to_seconds to None and should error."""
    with pytest.raises(StreamlitAPIException) as exc_info:
        _parse_start_time_end_time(None, None)  # type: ignore[arg-type]
    expected = TIMEDELTA_PARSE_ERROR_MESSAGE.format(
        param_name="start_time", param_value=None
    )
    assert str(exc_info.value) == expected
