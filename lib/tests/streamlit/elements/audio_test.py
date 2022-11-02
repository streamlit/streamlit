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
from streamlit.elements.media import _maybe_convert_to_wav_bytes
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Alert_pb2 import Alert as AlertProto
from streamlit.runtime.media_file_storage import MediaFileStorageError
from streamlit.runtime.memory_media_file_storage import _calculate_file_id
from streamlit.web.server.server import MEDIA_ENDPOINT
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class AudioTest(DeltaGeneratorTestCase):
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
            ([],),  # empty arr
            ([1, 2, 3, 4],),  # 1d array
            ([[34, 15], [78, 98], [23, 78]],),  # 2d numpy array
        ]
    )
    def test_st_audio_valid_numpy_array(self, arr):
        """Test st.audio using fake audio from empty, 1d, 2d numpy array."""

        sample_rate = 44100

        # Fake audio data: expect the resultant mimetype to be audio default.
        fake_audio_np_array = np.array(arr)

        st.audio(fake_audio_np_array, sample_rate=sample_rate)
        computed_bytes = _maybe_convert_to_wav_bytes(
            fake_audio_np_array, sample_rate=sample_rate
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
                np.linspace(1, 10, num=300).reshape((10, 10, 3)),  # 3d numpy array
                3,
                "Numpy array audio input must be a 1D or 2D array.",
            ),
            (
                np.linspace(1, 10, num=300).reshape((10, 2, 5, 3)),  # 4d numpy array
                4,
                "Numpy array audio input must be a 1D or 2D array.",
            ),
            (
                np.empty((2, 0, 0, 0)),  # 4d empty numpy array
                4,
                "Numpy array audio input must be a 1D or 2D array.",
            ),
        ]
    )
    def test_st_audio_invalid_numpy_array(self, np_arr, expected_shape, exception_text):
        """Test st.audio using invalid numpy array."""

        sample_rate = 44100
        self.assertEqual(len(np_arr.shape), expected_shape)

        with self.assertRaises(StreamlitAPIException) as e:
            st.audio(np_arr, sample_rate=sample_rate)

        self.assertEqual(str(e.exception), exception_text)

    def test_st_audio_missing_sample_rate_numpy_arr(self):
        """Test st.audio raises exception when sample_rate missing in case of valid
        numpy array."""

        valid_np_array = np.array([1, 2, 3, 4, 5])

        with self.assertRaises(StreamlitAPIException) as e:
            st.audio(valid_np_array)

        self.assertEqual(
            str(e.exception),
            "`sample_rate` must be specified when `data` is a numpy array.",
        )

    def test_st_audio_sample_rate_raises_warning(self):
        """Test st.audio raises streamlit warning when sample_rate parameter provided,
        but data is not a numpy array."""

        fake_audio_data = "\x11\x22\x33\x44\x55\x66".encode("utf-8")
        sample_rate = 44100

        st.audio(fake_audio_data, sample_rate=sample_rate)

        c = self.get_delta_from_queue(-2).new_element.alert
        self.assertEqual(c.format, AlertProto.WARNING)
        self.assertEqual(
            c.body,
            "Warning: `sample_rate` will be ignored since data is not a numpy array.",
        )

    def test_maybe_convert_to_wave_numpy_arr_empty(self):
        """Test _maybe_convert_to_wave_bytes works correctly with empty numpy array."""
        sample_rate = 44100
        fake_audio_np_array = np.array([])

        computed_bytes = _maybe_convert_to_wav_bytes(
            fake_audio_np_array, sample_rate=sample_rate
        )

        self.assertEqual(
            computed_bytes,
            b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00"
            b"\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00",
        )

    def test_maybe_convert_to_wave_numpy_arr_mono(self):
        """Test _maybe_convert_to_wave_bytes works correctly with 1d numpy array."""
        sample_rate = 7
        fake_audio_np_array = np.array([1, 9])

        computed_bytes = _maybe_convert_to_wav_bytes(
            fake_audio_np_array, sample_rate=sample_rate
        )

        self.assertEqual(
            computed_bytes,
            b"RIFF(\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x07\x00\x00"
            b"\x00\x0e\x00\x00\x00\x02\x00\x10\x00data\x04\x00\x00\x008\x0e\xff\x7f",
        )

    def test_maybe_convert_to_wave_numpy_arr_stereo(self):
        """Test _maybe_convert_to_wave_bytes works correctly with 2d numpy array."""
        sample_rate = 44100
        left_channel = np.array([1, 9])
        right_channel = np.array([6, 1])

        fake_audio_np_array = np.array([left_channel, right_channel])

        computed_bytes = _maybe_convert_to_wav_bytes(
            fake_audio_np_array, sample_rate=sample_rate
        )

        self.assertEqual(
            computed_bytes,
            b"RIFF,\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x02\x00D\xac\x00\x00"
            b"\x10\xb1\x02\x00\x04\x00\x10\x00data\x08\x00\x00\x008\x0eTU\xff\x7f8\x0e",
        )

    def test_maybe_convert_to_wave_bytes_with_sample_rate(self):
        """Test _maybe_convert_to_wave_bytes works correctly with bytes."""

        fake_audio_data_bytes = "\x11\x22\x33\x44\x55\x66".encode("utf-8")
        sample_rate = 44100

        computed_bytes = _maybe_convert_to_wav_bytes(
            fake_audio_data_bytes, sample_rate=sample_rate
        )

        self.assertEqual(computed_bytes, fake_audio_data_bytes)

    def test_maybe_convert_to_wave_bytes_without_sample_rate(self):
        """Test _maybe_convert_to_wave_bytes works correctly when sample_rate
        is None."""

        np_arr = np.array([0, 1, 2, 3])
        computed_bytes = _maybe_convert_to_wav_bytes(np_arr, sample_rate=None)
        self.assertTrue(computed_bytes is np_arr)

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
