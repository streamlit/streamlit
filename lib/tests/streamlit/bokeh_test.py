# Copyright 2019 Streamlit Inc. All rights reserved.

"""Bokeh unit test."""

import unittest
from bokeh.plotting import figure
from streamlit.DeltaGenerator import DeltaGenerator


class BokehTest(unittest.TestCase):
    """Test ability to marshall bokeh_chart protos."""

    def setUp(self):
        self.queue = []

        def enqueue(x):
            self.queue.append(x)
            return True

        self._dg = DeltaGenerator(enqueue)

    def test_figure(self):
        """Test that it can be called with figure."""
        plot = figure()
        plot.line([1], [1])
        self._dg.bokeh_chart(plot)

        c = self.queue[-1].delta.new_element.bokeh_chart
        self.assertEqual(hasattr(c, 'figure'), True)
