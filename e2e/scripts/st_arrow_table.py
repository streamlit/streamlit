# -*- coding: utf-8 -*-
# Copyright 2018-2020 Streamlit Inc.
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
import numpy as np
import pandas as pd

grid = np.arange(0, 6, 1).reshape(2, 3)
df = pd.DataFrame(
    grid,
    index=[[0, 1], ["r1", "r2"]],
    columns=[[2, 3, 4], ["c1", "c2", "c3"], [True, False, True]],
)

styler = (
    df.style.set_uuid("custom_uuid")
    .set_caption("The caption")
    .set_table_styles([{"selector": ".blank", "props": [("background-color", "red")]}])
    .highlight_max(axis=None)
    .format("{:.2%}")
)

st.table(styler)
