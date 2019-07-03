# Copyright 2019 Streamlit Inc. All rights reserved.

"""button unit test."""

from tests import testutil
import streamlit as st


class ButtonTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall button protos."""

    def test_button(self):
        """Test that it can be called."""
        st.button('the label')

        c = self.get_delta_from_queue().new_element.button
        self.assertEqual(c.label, 'the label')
        self.assertEqual(c.value, False)
