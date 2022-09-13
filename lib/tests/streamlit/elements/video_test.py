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

"""st.video unit tests"""

from io import BytesIO

import numpy as np

import streamlit as st
from streamlit.runtime.media_file_manager import (
    _calculate_file_id,
    media_file_manager,
    STATIC_MEDIA_ENDPOINT,
)
from tests import testutil


class VideoTest(testutil.DeltaGeneratorTestCase):
    def test_st_video(self):
        """Test st.video."""
        # Make up some bytes to pretend we have a video.  The server should not vet
        # the video before sending it to the browser.
        fake_video_data = "\x12\x10\x35\x44\x55\x66".encode("utf-8")

        st.video(fake_video_data)

        el = self.get_delta_from_queue().new_element

        # locate resultant file in InMemoryFileManager and test its properties.
        file_id = _calculate_file_id(fake_video_data, "video/mp4")
        self.assertTrue(file_id in media_file_manager)

        afile = media_file_manager.get(file_id)
        self.assertEqual(afile.mimetype, "video/mp4")
        self.assertEqual(afile.url, el.video.url)

        # Test with an arbitrary URL in place of data
        some_url = "http://www.marmosetcare.com/video/in-the-wild/intro.webm"
        st.video(some_url)
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.video.url, some_url)

        # Test with sufficiently varied youtube URLs
        yt_urls = (
            "https://youtu.be/_T8LGqJtuGc",
            "https://www.youtube.com/watch?v=kmfC-i9WgH0",
            "https://www.youtube.com/embed/sSn4e1lLVpA",
        )
        yt_embeds = (
            "https://www.youtube.com/embed/_T8LGqJtuGc",
            "https://www.youtube.com/embed/kmfC-i9WgH0",
            "https://www.youtube.com/embed/sSn4e1lLVpA",
        )
        # url should be transformed into an embed link (or left alone).
        for x in range(0, len(yt_urls)):
            st.video(yt_urls[x])
            el = self.get_delta_from_queue().new_element
            self.assertEqual(el.video.url, yt_embeds[x])

        # Test that a non-URL string is assumed to be a filename
        bad_filename = "blah"
        with self.assertRaises(FileNotFoundError):
            st.video(bad_filename)

        # Test that we can use an empty/None value without error.
        st.video(None)
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.video.url, "")

        # Test that our other data types don't result in an error.
        st.video(b"bytes_data")
        st.video("str_data".encode("utf-8"))
        st.video(BytesIO(b"bytesio_data"))
        st.video(np.array([0, 1, 2, 3]))

    def test_st_video_options(self):
        """Test st.video with options."""
        fake_video_data = "\x11\x22\x33\x44\x55\x66".encode("utf-8")
        st.video(fake_video_data, format="video/mp4", start_time=10)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.video.start_time, 10)
        self.assertTrue(el.video.url.startswith(STATIC_MEDIA_ENDPOINT))
        self.assertTrue(
            _calculate_file_id(fake_video_data, "video/mp4") in el.video.url
        )
