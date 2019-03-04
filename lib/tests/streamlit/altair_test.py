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

from streamlit import vega_lite
from streamlit.DeltaGenerator import DeltaGenerator


df1 = pd.DataFrame(
    [['A', 'B', 'C', 'D'], [28, 55, 43, 91]],
    index=['a', 'b']
).T

c1 = alt.Chart(df1).mark_bar().encode(x='a', y='b')


class AltairTest(unittest.TestCase):
    """Test ability to marshall altair_chart proto."""

    def test_altair_chart(self):
        """Test that it can be called with no args."""
        queue = []
        dg = DeltaGenerator(queue.append)

        dg.altair_chart(c1)

        c = queue[-1].new_element.vega_lite_chart
        self.assertEqual(c.HasField('data'), False)
        self.assertEqual(len(c.datasets), 1)
        self.assertEqual(json.loads(c.spec), {
            'encoding': {
                'y': {'field': 'b', 'type': 'quantitative'},
                'x': {'field': 'a', 'type': 'nominal'},
            },
            'data': {'name': 'data-7cc8c5586364b460a7f3c4622e11a92e'},
            '$schema': 'https://vega.github.io/schema/vega-lite/v2.6.0.json',
            'config': {'view': {'width': 400, 'height': 300}},
            'mark': 'bar',
        })
