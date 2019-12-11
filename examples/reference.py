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

"""Example of (almost) everything that's possible in streamlit."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims

setup_2_3_shims(globals())

from io import BytesIO
import requests

import streamlit as st


import numpy as np

import pandas as pd
    

with st.echo():
    df = pd.DataFrame(np.random.randn(200, 3), columns=["a", "b", "c"])

    st.vega_lite_chart(
        df,
        {
            "mark": "circle",
            "encoding": {
                "x": {"field": "a", "type": "quantitative"},
                "y": {"field": "b", "type": "quantitative"},
                "size": {"field": "c", "type": "quantitative"},
                "color": {"field": "c", "type": "quantitative"},
            },
            # Add zooming/panning:
            "selection": {"grid": {"type": "interval", "bind": "scales"}},
        },
        width=200
    )

st.header("Visualizing data as images via Pillow.")
