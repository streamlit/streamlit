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

import random
import time

import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(0)
random.seed(0)

random_df = pd.DataFrame(
    np.random.randn(5, 5),
    columns=["Column A", "Column B", "Column C", "Column D", "Column E"],
)

st.dataframe(random_df)


if st.button("Create some elements to unmount component"):
    for _ in range(3):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")


st.data_editor(random_df, num_rows="dynamic")


cell_overlay_test_df = pd.DataFrame(
    {
        "big_numbers": [1231231.41, 12012],
    }
)

cell_overlay_test_column_config = {
    "big_numbers": st.column_config.NumberColumn(
        width="medium",  # the e2e test requires all cells to medium width
    ),
}


st.header("Test read-only cell overlay")
st.dataframe(
    cell_overlay_test_df, hide_index=True, column_config=cell_overlay_test_column_config
)

st.header("Test cell editor")

result = st.data_editor(
    cell_overlay_test_df, hide_index=True, column_config=cell_overlay_test_column_config
)

st.write("Edited DF:", str(result))
