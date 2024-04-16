# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

st.write("Test Title")

with st.sidebar:
    add_radio = st.radio(
        "Choose a shipping method", ("Standard (5-15 days)", "Express (2-5 days)")
    )
    st.write(f"You selected following shipping method: {add_radio}")

s = st.multiselect("Select", ["A", "B", "C"], default="A")
st.write(f"You selected following option: {s}")
# ---

# render a dataframe
st.dataframe(pd.DataFrame(np.zeros((1000, 6)), columns=["A", "B", "C", "D", "E", "F"]))
