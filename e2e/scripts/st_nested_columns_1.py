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

import numpy as np
import pandas as pd

import streamlit as st

"""
# Example 1
Complex widget layout on one side, chart/image/map on the other side. That's the top use case that's always brought up.

---
"""

col1, col2 = st.columns(2, gap="medium")

right_side = col1.radio(
    "Show on right side 👉", ["Chart", "Image", "Map"], horizontal=True
)
subcol1, subcol2 = col1.columns(2)
subcol1.text_input("Text input 1")
subcol2.text_input("Text input 2")
col1.text_area("Text Area 1")
subcolA, subcolB, subcolC, subcolD = col1.columns(4)
subcolA.checkbox("One")
subcolB.checkbox("Two")
subcolC.checkbox("Three")
subcolD.checkbox("Four")

np.random.seed(0)

col2.bar_chart(np.random.rand(100))
