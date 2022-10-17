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

"""st.audio unit tests"""

import io
import os
from io import BytesIO

import numpy as np
from parameterized import parameterized
from scipy.io import wavfile

import streamlit as st
from streamlit.elements.media import _maybe_convert_to_wave_bytes
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.media_file_storage import MediaFileStorageError
from streamlit.runtime.memory_media_file_storage import _calculate_file_id
from streamlit.web.server.server import MEDIA_ENDPOINT
from tests import testutil


class AudioTest(testutil.DeltaGeneratorTestCase):
    def test_st_audio_from_bytes(self):
        """Test st.audio using fake audio bytes."""

        # Fake audio data: expect the resultant mimetype to be audio default.
        fake_audio_data = "\x11\x22\x33\x44\x55\x66".encode("utf-8")

        st.audio(fake_audio_data)

        el = self.get_delta_from_queue().new_element

        # locate resultant file in InMemoryFileManager and test its properties.
        file_id = _calculate_file_id(fake_audio_data, "audio/wav")
        media_file = self.media_file_storage.get_file(file_id)
        self.assertIsNotNone(media_file)
        self.assertEqual(media_file.mimetype, "audio/wav")
        self.assertEqual(self.media_file_storage.get_url(file_id), el.audio.url)

    @parameterized.expand(
        [
            ([1, 2, 3, 4],),  # 1d array
            ([[34, 15], [78, 98], [23, 78]],),  # 2d numpy array
        ]
    )
    def test_st_audio_valid_numpy_array(self, arr):
        """Test st.audio using fake audio from empty, 1d, 2d numpy array."""

        sample_rate = 44100

        # Fake audio data: expect the resultant mimetype to be audio default.
        fake_audio_1d_np_array = np.array(arr)

        st.audio(fake_audio_1d_np_array, sample_rate=sample_rate)
        computed_bytes = _maybe_convert_to_wave_bytes(
            fake_audio_1d_np_array, sample_rate=sample_rate
        )

        el = self.get_delta_from_queue().new_element

        # locate resultant file in InMemoryFileManager and test its properties.
        file_id = _calculate_file_id(computed_bytes, "audio/wav")
        media_file = self.media_file_storage.get_file(file_id)
        self.assertIsNotNone(media_file)
        self.assertEqual(media_file.mimetype, "audio/wav")
        self.assertEqual(self.media_file_storage.get_url(file_id), el.audio.url)
        self.assertEqual(media_file.content, computed_bytes)

    @parameterized.expand(
        [
            (
                np.array([]),  # empty numpy array
                1,
                "st.audio data numpy array should not be empty",
            ),
            (
                np.linspace(1, 10, num=300).reshape((10, 10, 3)),  # 3d numpy array
                3,
                "In case of numpy array audio input must be a 1D or 2D array",
            ),
        ]
    )
    def test_st_audio_invalid_numpy_array(self, np_arr, expected_shape, exception_text):
        """Test st.audio using fake audio 1d numpy array."""

        sample_rate = 44100
        self.assertEqual(len(np_arr.shape), expected_shape)

        with self.assertRaises(StreamlitAPIException) as e:
            st.audio(np_arr, sample_rate=sample_rate)

        self.assertEqual(str(e.exception), exception_text)

    def test_st_audio_from_file(self):
        """Test st.audio using generated data in a file-like object."""
        sample_rate = 44100
        frequency = 440
        length = 5

        # Produces a 5 second Audio-File
        t = np.linspace(0, length, sample_rate * length)
        # Has frequency of 440Hz
        y = np.sin(frequency * 2 * np.pi * t)

        wavfile.write("test.wav", sample_rate, y)

        with io.open("test.wav", "rb") as f:
            st.audio(f)

        el = self.get_delta_from_queue().new_element
        self.assertTrue(".wav" in el.audio.url)

        os.remove("test.wav")

    def test_st_audio_from_url(self):
        """We can pass a URL directly to st.audio."""
        # Test using a URL instead of data
        some_url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
        st.audio(some_url)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.audio.url, some_url)

    def test_st_audio_raises_on_bad_filename(self):
        """A non-URL string is assumed to be a filename. A file we can't
        open will result in an error.
        """
        with self.assertRaises(MediaFileStorageError):
            st.audio("not/a/real/file")

    def test_st_audio_from_none(self):
        """st.audio(None) is not an error."""
        st.audio(None)
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.audio.url, "")

    def test_st_audio_other_inputs(self):
        """Test that our other data types don't result in an error."""
        st.audio(b"bytes_data")
        st.audio("str_data".encode("utf-8"))
        st.audio(BytesIO(b"bytesio_data"))
        st.audio(np.array([0, 1, 2, 3]), sample_rate=44100)

    def test_st_audio_options(self):
        """Test st.audio with options."""
        fake_audio_data = "\x11\x22\x33\x44\x55\x66".encode("utf-8")
        st.audio(fake_audio_data, format="audio/mp3", start_time=10)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.audio.start_time, 10)
        self.assertTrue(el.audio.url.startswith(MEDIA_ENDPOINT))
        self.assertTrue(_calculate_file_id(fake_audio_data, "audio/mp3"), el.audio.url)


# TODO st.audio raises error when sample_rate not provided in case of numpy array
# TODO st.audio raises warning when sample rate provided in case of data is not numpy array
# TODO check valid wav file generation for valid 1d numpy array
# TODO check valid wav file generation for valid 2d numpy array
# TODO check raises error when invalid numpy array shape provided
