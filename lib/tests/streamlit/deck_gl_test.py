# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""deck_gl unit test."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import pandas as pd
import json

from tests import testutil
import streamlit as st


df1 = pd.DataFrame({
    'lat': [1, 2, 3, 4],
    'lon': [10, 20, 30, 40],
})

class DeckGLTest(testutil.DeltaGeneratorTestCase):
    """Test ability to marshall deck_gl_chart protos."""

    def test_no_args(self):
        """Test that it can be called with no args."""
        st.deck_gl_chart()

        c = self.get_delta_from_queue().new_element.deck_gl_chart
        self.assertEqual(c.HasField('data'), False)
        self.assertEqual(json.loads(c.spec), {})

    def test_basic(self):
        """Test that deck_gl_chart can be called with lat/lon."""
        st.deck_gl_chart(df1)

        c = self.get_delta_from_queue().new_element.deck_gl_chart
        self.assertEqual(c.HasField('data'), False)
        self.assertEqual(len(c.layers), 1)
        self.assertEqual(json.loads(c.spec), {})
