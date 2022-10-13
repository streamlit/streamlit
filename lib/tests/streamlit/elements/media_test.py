# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from enum import Enum
from unittest import mock

from parameterized import parameterized

import streamlit as st
from streamlit.cursor import make_delta_path
from streamlit.elements.media import MediaData
from streamlit.proto.RootContainer_pb2 import RootContainer
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class TestMediaKind(Enum):
    AUDIO = "audio"
    VIDEO = "video"


class MediaTest(DeltaGeneratorTestCase):
    @parameterized.expand(
        [
            ("foo.wav", "audio/wav", TestMediaKind.AUDIO, False),
            ("path/to/foo.wav", "audio/wav", TestMediaKind.AUDIO, False),
            (b"fake_audio_data", "audio/wav", TestMediaKind.AUDIO, False),
            ("https://foo.com/foo.wav", "audio/wav", TestMediaKind.AUDIO, True),
            ("foo.mp4", "video/mp4", TestMediaKind.VIDEO, False),
            ("path/to/foo.mp4", "video/mp4", TestMediaKind.VIDEO, False),
            (b"fake_video_data", "video/mp4", TestMediaKind.VIDEO, False),
            ("https://foo.com/foo.mp4", "video/mp4", TestMediaKind.VIDEO, True),
        ]
    )
    def test_add_bytes_and_filenames_to_mediafilemanager(
        self,
        media_data: MediaData,
        mimetype: str,
        media_kind: TestMediaKind,
        is_url: bool,
    ):
        """st.audio + st.video should register bytes and filenames with the
        MediaFileManager. URL-based media does not go through the MediaFileManager.
        """
        with mock.patch(
            "streamlit.runtime.media_file_manager.MediaFileManager.add"
        ) as mock_mfm_add:
            mock_mfm_add.return_value = "https://mockoutputurl.com"

            if media_kind is TestMediaKind.AUDIO:
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
                self.assertEqual(media_data, element_url)
                mock_mfm_add.assert_not_called()
            else:
                # Other strings, and audio data, should be passed to
                # MediaFileManager.add
                mock_mfm_add.assert_called_once_with(
                    media_data,
                    mimetype,
                    str(make_delta_path(RootContainer.MAIN, (), 0)),
                )
                self.assertEqual("https://mockoutputurl.com", element_url)
