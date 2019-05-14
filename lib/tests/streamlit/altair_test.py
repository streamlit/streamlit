# Copyright 2019 Streamlit Inc. All rights reserved.

"""st.altair_chart unit test."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import altair as alt
import json
import pandas as pd
import unittest

from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.ReportQueue import ReportQueue


df1 = pd.DataFrame(
    [['A', 'B', 'C', 'D'], [28, 55, 43, 91]],
    index=['a', 'b']
).T

c1 = alt.Chart(df1).mark_bar().encode(x='a', y='b')


class AltairTest(unittest.TestCase):
    """Test ability to marshall altair_chart proto."""

    def setUp(self):
        self._report_queue = ReportQueue()

        def enqueue(msg):
            self._report_queue.enqueue(msg)
            return True

        self._dg = DeltaGenerator(enqueue)

    def test_altair_chart(self):
        """Test that it can be called with no args."""
        self._dg.altair_chart(c1)

        c = self._report_queue._queue[-1].delta.new_element.vega_lite_chart
        self.assertEqual(c.HasField('data'), False)
        self.assertEqual(len(c.datasets), 1)

        spec_dict = json.loads(c.spec)
        self.assertEqual(spec_dict['encoding'], {
            'y': {'field': 'b', 'type': 'quantitative'},
            'x': {'field': 'a', 'type': 'nominal'},
        })
        self.assertEqual(spec_dict['data'], {
            'name': 'data-7cc8c5586364b460a7f3c4622e11a92e',
        })
        self.assertEqual(spec_dict['mark'], 'bar')
        self.assertTrue('config' in spec_dict)
        self.assertTrue('encoding' in spec_dict)
