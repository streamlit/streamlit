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

"""E2E app for testing lazy st.dataframe loading."""

import pandas as pd

import streamlit as st

# Create a dataframe that exceeds the auto-lazy threshold (150k rows)
# For testing, we'll use lazy=True with a smaller dataframe
df = pd.DataFrame(
    {
        "id": range(10000),
        "value": [i * 2 for i in range(10000)],
        "name": [f"item_{i}" for i in range(10000)],
    }
)

st.header("Lazy Dataframe Test")

# Test explicit lazy=True with a dataframe above the minimum threshold
st.dataframe(df, lazy=True, height=400)
