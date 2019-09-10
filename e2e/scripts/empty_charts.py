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

import streamlit as st
import pandas as pd

import time
import random

data = pd.DataFrame({
    'a': [1, 2, 3, 4],
    'b': [1, 3, 2, 4],
})

spec = {
    'mark': 'line',
    'encoding': {
        'x': {'field': 'a', 'type': 'quantitative'},
        'y': {'field': 'b', 'type': 'quantitative'},
    },
}

# 2 empty charts
st.vega_lite_chart(spec)
st.pyplot()

# 1 empty map
st.deck_gl_chart()

# 10 errors
try:
    st.vega_lite_chart({})
except Exception as e:
    st.write(e)

try:
    st.vega_lite_chart(data, {})
except Exception as e:
    st.write(e)

try:
    st.vega_lite_chart(data)
except Exception as e:
    st.write(e)

try:
    st.vega_lite_chart()
except Exception as e:
    st.write(e)

try:
    st.altair_chart()
except Exception as e:
    st.write(e)

try:
    st.line_chart()
except Exception as e:
    st.write(e)

try:
    st.area_chart()
except Exception as e:
    st.write(e)

try:
    st.bar_chart()
except Exception as e:
    st.write(e)

try:
    st._native_chart()
except Exception as e:
    st.write(e)

try:
    st.map()
except Exception as e:
    st.write(e)
