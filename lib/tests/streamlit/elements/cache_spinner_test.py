"""Unit tests for cache's show_spinner option."""

import streamlit as st
from tests import testutil


@st.cache(show_spinner=False)
def function_without_spinner():
    return 3


@st.cache(show_spinner=True)
def function_with_spinner():
    return 3


class CacheSpinnerTest(testutil.DeltaGeneratorTestCase):
    """
    We test the ability to turn on and off the spinner with the show_spinner
    option by inspecting the report queue.
    """

    def test_with_spinner(self):
        """If the show_spinner flag is set, there should be one element in the
        report queue.
        """
        function_with_spinner()
        self.assertFalse(self.forward_msg_queue.is_empty())

    def test_without_spinner(self):
        """If the show_spinner flag is not set, the report queue should be
        empty.
        """
        function_without_spinner()
        self.assertTrue(self.forward_msg_queue.is_empty())
