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

rng = np.random.default_rng(0)
num_points = 120
df = pd.DataFrame(
    {
        "mpg": rng.normal(23, 8, num_points).round(1),
        "horsepower": rng.normal(105, 40, num_points).round(0),
        "weight": rng.normal(2970, 850, num_points).round(0),
        "acceleration": rng.normal(15.5, 2.8, num_points).round(1),
    }
)
df["name"] = [f"car {index}" for index in range(num_points)]

st.header("Basic scatterplot matrix")
st.scatterplot_matrix_chart(df, title="Cars", label="name")

st.header("Scatterplot matrix with selections")
event = st.scatterplot_matrix_chart(
    df,
    columns=["mpg", "horsepower", "weight"],
    query_colors=["#e74c3c", "#2d7ff9"],
    key="selectable_splom",
    on_select="rerun",
)
st.markdown(f"Selected points: {len(event.selection.indices)}")
