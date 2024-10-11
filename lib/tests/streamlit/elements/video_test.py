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

"""st.video unit tests"""

import hashlib
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile

import numpy as np

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.media_file_storage import MediaFileStorageError
from streamlit.runtime.memory_media_file_storage import _calculate_file_id
from streamlit.web.server.server import MEDIA_ENDPOINT
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class VideoTest(DeltaGeneratorTestCase):
    def test_st_video_from_bytes(self):
        """Test st.video using fake bytes data."""
        # Make up some bytes to pretend we have a video.  The server should not vet
        # the video before sending it to the browser.
        fake_video_data = b"\x12\x10\x35\x44\x55\x66"

        st.video(fake_video_data)

        el = self.get_delta_from_queue().new_element

        # locate resultant file in InMemoryFileManager and test its properties.
        file_id = _calculate_file_id(fake_video_data, "video/mp4")
        media_file = self.media_file_storage.get_file(file_id)
        self.assertIsNotNone(media_file)
        self.assertEqual(media_file.mimetype, "video/mp4")
        self.assertEqual(self.media_file_storage.get_url(file_id), el.video.url)

    def test_st_video_from_url(self):
        """We can pass a URL directly to st.video"""
        some_url = "http://www.marmosetcare.com/video/in-the-wild/intro.webm"
        st.video(some_url)
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.video.url, some_url)

    def test_youtube_urls_transformed_to_embed_links(self):
        """Youtube URLs should be transformed into embed links."""
        yt_urls = (
            "https://youtu.be/_T8LGqJtuGc",
            "https://www.youtube.com/watch?v=kmfC-i9WgH0",
            "https://www.youtube.com/embed/sSn4e1lLVpA",
            "https://youtube.com/e/0TSXM-BGqHU",
            "https://youtube.com/v/OIQskkX_DK0",
            # HTTP should also work correctly
            "http://youtu.be/4sPnOqeUDmk",
            "http://www.youtube.com/embed/92jUAXBmZyU",
        )
        yt_embeds = (
            "https://www.youtube.com/embed/_T8LGqJtuGc",
            "https://www.youtube.com/embed/kmfC-i9WgH0",
            "https://www.youtube.com/embed/sSn4e1lLVpA",
            "https://www.youtube.com/embed/0TSXM-BGqHU",
            "https://www.youtube.com/embed/OIQskkX_DK0",
            "https://www.youtube.com/embed/4sPnOqeUDmk",
            "https://www.youtube.com/embed/92jUAXBmZyU",
        )
        # url should be transformed into an embed link (or left alone).
        for x in range(0, len(yt_urls)):
            st.video(yt_urls[x])
            el = self.get_delta_from_queue().new_element
            self.assertEqual(el.video.url, yt_embeds[x])

    def test_st_video_raises_on_bad_filename(self):
        """A non-URL string is assumed to be a filename. A file we can't
        open will result in an error.
        """
        with self.assertRaises(MediaFileStorageError):
            st.video("not/a/real/file")

    def test_st_video_from_none(self):
        """st.video(None) is not an error."""
        st.video(None)
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.video.url, "")

    def test_st_video_other_inputs(self):
        """Test that our other data types don't result in an error."""
        st.video(b"bytes_data")
        st.video(b"str_data")
        st.video(BytesIO(b"bytesio_data"))
        st.video(np.array([0, 1, 2, 3]))

    def test_st_video_options(self):
        """Test st.video with options."""
        fake_video_data = b"\x11\x22\x33\x44\x55\x66"
        st.video(
            fake_video_data,
            format="video/mp4",
            start_time=10,
            end_time=18,
            loop=True,
            autoplay=True,
            muted=True,
        )

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.video.start_time, 10)
        self.assertEqual(el.video.end_time, 18)
        self.assertTrue(el.video.loop)
        self.assertTrue(el.video.autoplay)
        self.assertTrue(el.video.muted)
        self.assertTrue(el.video.url.startswith(MEDIA_ENDPOINT))
        self.assertIn(_calculate_file_id(fake_video_data, "video/mp4"), el.video.url)

    def test_st_video_just_data(self):
        """Test st.video with just data specified."""
        fake_video_data = b"\x11\x22\x33\x44\x55\x66"
        st.video(fake_video_data)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.video.start_time, 0)
        self.assertEqual(el.video.end_time, 0)
        self.assertFalse(el.video.loop)
        self.assertFalse(el.video.autoplay)
        self.assertFalse(el.video.muted)
        self.assertTrue(el.video.url.startswith(MEDIA_ENDPOINT))
        self.assertIn(_calculate_file_id(fake_video_data, "video/mp4"), el.video.url)

    def test_st_video_subtitles(self):
        """Test st.video with subtitles."""
        fake_video_data = b"\x11\x22\x33\x44\x55\x66"
        fake_subtitle_data = b"WEBVTT\n\n\n1\n00:01:47.250 --> 00:01:50.500\n`hello."
        st.video(fake_video_data, subtitles=fake_subtitle_data)

        el = self.get_delta_from_queue().new_element
        self.assertTrue(el.video.url.startswith(MEDIA_ENDPOINT))
        self.assertIn(_calculate_file_id(fake_video_data, "video/mp4"), el.video.url)

        expected_subtitle_url = _calculate_file_id(
            fake_subtitle_data,
            "text/vtt",
            filename=f'{hashlib.md5(b"default").hexdigest()}.vtt',
        )
        self.assertIn(expected_subtitle_url, el.video.subtitles[0].url)

    def test_st_video_empty_subtitles(self):
        """Test st.video with subtitles, empty subtitle label, content allowed."""
        fake_video_data = b"\x11\x22\x33\x44\x55\x66"
        fake_subtitle_data = b"WEBVTT\n\n\n1\n00:01:47.250 --> 00:01:50.500\n`hello."
        st.video(
            fake_video_data,
            subtitles={
                "": "",
                "English": fake_subtitle_data,
            },
        )

        el = self.get_delta_from_queue().new_element
        self.assertTrue(el.video.url.startswith(MEDIA_ENDPOINT))
        self.assertIn(_calculate_file_id(fake_video_data, "video/mp4"), el.video.url)

        expected_empty_subtitle_url = _calculate_file_id(
            b"",
            "text/vtt",
            filename=f'{hashlib.md5(b"").hexdigest()}.vtt',
        )
        expected_english_subtitle_url = _calculate_file_id(
            fake_subtitle_data,
            "text/vtt",
            filename=f'{hashlib.md5(b"English").hexdigest()}.vtt',
        )
        self.assertIn(expected_empty_subtitle_url, el.video.subtitles[0].url)
        self.assertIn(expected_english_subtitle_url, el.video.subtitles[1].url)

    def test_st_video_subtitles_path(self):
        fake_video_data = b"\x11\x22\x33\x44\x55\x66"
        fake_sub_content = b"WEBVTT\n\n\n1\n00:01:47.250 --> 00:01:50.500\n`hello."

        with NamedTemporaryFile(suffix=".vtt", mode="wb") as tmp_file:
            p = Path(tmp_file.name)
            tmp_file.write(fake_sub_content)
            tmp_file.flush()

            st.video(fake_video_data, subtitles=p)

        expected_english_subtitle_url = _calculate_file_id(
            fake_sub_content,
            "text/vtt",
            filename=f'{hashlib.md5(b"default").hexdigest()}.vtt',
        )

        el = self.get_delta_from_queue().new_element
        self.assertIn(expected_english_subtitle_url, el.video.subtitles[0].url)

    def test_singe_subtitle_exception(self):
        """Test that an error is raised if invalid subtitles is provided."""
        fake_video_data = b"\x11\x22\x33\x44\x55\x66"

        with self.assertRaises(StreamlitAPIException) as e:
            st.video(fake_video_data, subtitles="invalid_subtitles")
        self.assertEqual(
            str(e.exception),
            "Failed to process the provided subtitle: default",
        )

    def test_dict_subtitle_video_exception(self):
        """Test that an error is raised if invalid subtitles in dict is provided."""
        fake_video_data = b"\x11\x22\x33\x44\x55\x66"
        fake_sub_content = b"WEBVTT\n\n\n1\n00:01:47.250 --> 00:01:50.500\n`hello."

        with self.assertRaises(StreamlitAPIException) as e:
            st.video(
                fake_video_data,
                subtitles={
                    "English": fake_sub_content,
                    "": "",  # empty subtitle label and value are also valid
                    "Martian": "invalid_subtitles",
                },
            )
        self.assertEqual(
            str(e.exception),
            "Failed to process the provided subtitle: Martian",
        )
