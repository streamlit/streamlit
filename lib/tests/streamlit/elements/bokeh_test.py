# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import streamlit as st
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class BokehTest(DeltaGeneratorTestCase):
    """Test ability to marshall bokeh_chart protos."""

    @patch("streamlit.elements.bokeh_chart.show_deprecation_warning")
    def test_calling_bokeh_chart_shows_deprecation_warning(
        self, patched_show_deprecation_warning
    ):
        st.bokeh_chart(None)

        patched_show_deprecation_warning.assert_called_once()
