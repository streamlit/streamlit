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

import streamlit as st

np.random.seed(0)


col1, col2, col3 = st.columns(3)

# Create random sparkline data:


def generate_sparkline_data(length=7, drift=0.05, volatility=10):
    random_changes = np.random.normal(loc=drift, scale=volatility, size=length)
    initial_value = np.random.normal(loc=50, scale=5)
    data = initial_value + np.cumsum(random_changes)
    return data.tolist()


with col1:
    st.container(border=True).metric(
        "User", 8231, 123, sparkline=generate_sparkline_data()
    )
    st.container(border=True).metric(
        "Bugs", 200, -99, sparkline=generate_sparkline_data()
    )
with col2:
    st.container(border=True).metric(
        "Views", 19321, 1053, sparkline=generate_sparkline_data()
    )
    st.container(border=True).metric(
        "Patches", 7, 0, sparkline=generate_sparkline_data()
    )
with col3:
    st.container(border=True).metric(
        "Apps", 452, 0, sparkline=generate_sparkline_data()
    )
    st.container(border=True).metric(
        "Sign-ups", 132, 12, sparkline=generate_sparkline_data()
    )
