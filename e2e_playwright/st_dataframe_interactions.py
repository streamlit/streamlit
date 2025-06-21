# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import random
import time

import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(0)
random.seed(0)

DF_SIZE = 30


random_df = pd.DataFrame(
    np.random.randn(5, 5),
    columns=["Column A", "Column B", "Column C", "Column D", "Column E"],
)

fullscreen_df = pd.DataFrame(
    np.random.randn(DF_SIZE, DF_SIZE),
    columns=[f"Column {i}" for i in range(DF_SIZE)],
)

# Configure all columns to be use small width to allow reliable interaction testing:
st.dataframe(
    random_df,
    column_config={
        "_index": st.column_config.Column(width="small"),
        "Column A": st.column_config.Column(width="small"),
        "Column B": st.column_config.Column(width="small"),
        "Column C": st.column_config.Column(width="small"),
        "Column D": st.column_config.Column(width="small"),
        "Column E": st.column_config.Column(width="small"),
    },
    use_container_width=False,
)


if st.button("Create some elements to unmount component"):
    for _ in range(3):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")


st.data_editor(
    random_df, num_rows="dynamic", key="data_editor", use_container_width=False
)


cell_overlay_test_df = pd.DataFrame(
    {
        "big_numbers": [1231231.41, 12012],
        "text": ["hello\nworld", "foo"],
    }
)

cell_overlay_test_column_config = {
    # the e2e interaction testing logic requires all cells to medium
    # width to calculate the cell positions correctly.
    "big_numbers": st.column_config.NumberColumn(
        width="medium",
    ),
    "text": st.column_config.TextColumn(
        width="medium",
    ),
}


st.header("Test read-only cell overlay")
st.dataframe(
    cell_overlay_test_df,
    hide_index=True,
    column_config=cell_overlay_test_column_config,
    use_container_width=False,
)

st.header("Test cell editor")

result = st.data_editor(
    cell_overlay_test_df,
    hide_index=True,
    column_config=cell_overlay_test_column_config,
    use_container_width=False,
)

st.write("Edited DF:", str(result))

st.dataframe(fullscreen_df, use_container_width=False)

st.header("Column menu interaction")

st.container(key="column-menu-test").dataframe(
    pd.DataFrame(
        # We need a couple more rows than random_df to fully cover the column menu
        np.random.randn(8, 6),
        columns=[
            "Column A",
            "Column B",
            "Column C",
            "Column D",
            "Column E",
            "Column F",
        ],
    ),
    column_config={
        "_index": st.column_config.Column(width="small"),
        "Column A": st.column_config.Column(width="small"),
        "Column B": st.column_config.Column(width="small"),
        "Column C": st.column_config.Column(width="small"),
        # Test with internal hidden parameter:
        "Column D": {"hidden": True, "width": "small"},
        "Column E": st.column_config.Column(width="small"),
        "Column F": st.column_config.Column(width="small"),
    },
    column_order=["Column A", "Column B", "Column E", "Column C", "Column D"],
    use_container_width=False,
)
