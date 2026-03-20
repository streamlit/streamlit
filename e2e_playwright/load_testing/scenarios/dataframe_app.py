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

"""Data-heavy app for load testing large dataframes."""

import pandas as pd

import streamlit as st

st.title("Load Test - Dataframe")


@st.cache_data
def create_dataframe(rows: int, cols: int) -> pd.DataFrame:
    """Create a large dataframe for testing."""
    return pd.DataFrame({f"col_{i}": range(rows) for i in range(cols)})


if st.button("Load dataframe"):
    df = create_dataframe(10000, 5)
    st.dataframe(df)
    st.write("Dataframe loaded!")
