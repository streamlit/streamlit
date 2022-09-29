# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Bokeh unit test."""

from unittest.mock import patch

from bokeh.plotting import figure

import streamlit as st
from streamlit.errors import StreamlitAPIException
from tests import testutil


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
