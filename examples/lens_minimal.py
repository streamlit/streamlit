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

# ruff: noqa: INP001
import pandas as pd

import streamlit as st

st.title("st.lens — Minimal Example")

df = pd.DataFrame({"x": [1, 2, 3], "y": [4, 10, 2]})
st.line_chart(df)


def analyze(_snapshot: bytes, prompt: str) -> str:
    return f"Prompt: _{prompt}_ — Add your AI callback here."


lens = st.lens(
    label="Chart AI",
    key="lens",
    on_result=analyze,
    help="Drag over the chart and click Analyze.",
)
if lens:
    st.write(f"Result: {lens}")
