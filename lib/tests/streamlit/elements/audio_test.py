"""st.audio unit tests"""

import io
import os
from io import BytesIO

import numpy as np
from scipy.io import wavfile

import streamlit as st
from streamlit.runtime.media_file_manager import (
    _calculate_file_id,
    media_file_manager,
    STATIC_MEDIA_ENDPOINT,
)
from tests import testutil


class AudioTest(testutil.DeltaGeneratorTestCase):
    def test_st_audio(self):
        """Test st.audio."""

        # Fake audio data: expect the resultant mimetype to be audio default.
        fake_audio_data = "\x11\x22\x33\x44\x55\x66".encode("utf-8")

        st.audio(fake_audio_data)

        el = self.get_delta_from_queue().new_element

        # locate resultant file in InMemoryFileManager and test its properties.
        file_id = _calculate_file_id(fake_audio_data, "audio/wav")
        self.assertTrue(file_id in media_file_manager)

        afile = media_file_manager.get(file_id)
        self.assertEqual(afile.mimetype, "audio/wav")
        self.assertEqual(afile.url, el.audio.url)

        # Test using generated data in a file-like object.

        sampleRate = 44100
        frequency = 440
        length = 5

        t = np.linspace(
            0, length, sampleRate * length
        )  #  Produces a 5 second Audio-File
        y = np.sin(frequency * 2 * np.pi * t)  #  Has frequency of 440Hz

        wavfile.write("test.wav", sampleRate, y)

        with io.open("test.wav", "rb") as f:
            st.audio(f)

        el = self.get_delta_from_queue().new_element
        self.assertTrue(".wav" in el.audio.url)

        os.remove("test.wav")

        # Test using a URL instead of data
        some_url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
        st.audio(some_url)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.audio.url, some_url)

        # Test that a non-URL string is assumed to be a filename
        bad_filename = "blah"
        with self.assertRaises(FileNotFoundError):
            st.audio(bad_filename)

        # Test that we can use an empty/None value without error.
        st.audio(None)
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.audio.url, "")

        # Test that our other data types don't result in an error.
        st.audio(b"bytes_data")
        st.audio("str_data".encode("utf-8"))
        st.audio(BytesIO(b"bytesio_data"))
        st.audio(np.array([0, 1, 2, 3]))

    def test_st_audio_options(self):
        """Test st.audio with options."""
        fake_audio_data = "\x11\x22\x33\x44\x55\x66".encode("utf-8")
        st.audio(fake_audio_data, format="audio/mp3", start_time=10)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.audio.start_time, 10)
        self.assertTrue(el.audio.url.startswith(STATIC_MEDIA_ENDPOINT))
        self.assertTrue(_calculate_file_id(fake_audio_data, "audio/mp3"), el.audio.url)
