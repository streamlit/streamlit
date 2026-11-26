# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

st.markdown("Render timing metrics")
st.image(np.full((60, 120, 3), 128, dtype=np.uint8), caption="Gray image")
st.line_chart(pd.DataFrame({"a": [1, 3, 2, 4]}), height=200)
st.dataframe(pd.DataFrame({"x": range(3)}))
st.button("Rerun")
