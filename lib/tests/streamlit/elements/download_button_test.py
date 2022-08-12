"""download_button unit test."""

import streamlit as st

from parameterized import parameterized
from tests import testutil


class DownloadButtonTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall download_button protos."""

    @parameterized.expand([("hello world",), (b"byteshere",)])
    def test_just_label(self, data):
        """Test that it can be called with label and string or bytes data."""
        st.download_button("the label", data=data)

        c = self.get_delta_from_queue().new_element.download_button
        self.assertEqual(c.label, "the label")
        self.assertEqual(c.disabled, False)

    def test_just_disabled(self):
        """Test that it can be called with disabled param."""
        st.download_button("the label", data="juststring", disabled=True)

        c = self.get_delta_from_queue().new_element.download_button
        self.assertEqual(c.disabled, True)

    def test_url_exist(self):
        """Test that file url exist in proto."""
        st.download_button("the label", data="juststring")

        c = self.get_delta_from_queue().new_element.download_button
        self.assertTrue("/media/" in c.url)
