"""Bokeh unit test."""

from bokeh.plotting import figure

from unittest.mock import patch
from tests import testutil

import streamlit as st
from streamlit.errors import StreamlitAPIException


class BokehTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall bokeh_chart protos."""

    def test_figure(self):
        """Test that it can be called with figure."""
        plot = figure()
        plot.line([1], [1])
        st.bokeh_chart(plot)

        c = self.get_delta_from_queue().new_element.bokeh_chart
        self.assertEqual(hasattr(c, "figure"), True)

    def test_bokeh_version_failure(self):
        with patch("bokeh.__version__", return_value="2.4.0"):
            plot = figure()
            with self.assertRaises(StreamlitAPIException):
                st.bokeh_chart(plot)
