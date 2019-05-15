# Copyright 2019 Streamlit Inc. All rights reserved.

"""Bokeh unit test."""

from bokeh.plotting import figure

from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.ReportQueue import ReportQueue
from tests.streamlit import util
import streamlit as st


class BokehTest(util.DeltaGeneratorTestCase):
    """Test ability to marshall bokeh_chart protos."""

    def test_figure(self):
        """Test that it can be called with figure."""
        plot = figure()
        plot.line([1], [1])
        st.bokeh_chart(plot)

        c = self.get_delta_from_queue().new_element.bokeh_chart
        self.assertEqual(hasattr(c, 'figure'), True)
