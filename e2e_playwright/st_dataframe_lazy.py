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

# Track the number of script runs so tests can verify that scroll-triggered
# chunk loading does NOT trigger a rerun.
if "run_count" not in st.session_state:
    st.session_state.run_count = 0
st.session_state.run_count += 1
st.text(f"Run count: {st.session_state.run_count}")


@st.cache_data
def make_df(num_rows: int) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "index_col": np.arange(num_rows),
            "squared": np.arange(num_rows) ** 2,
            "label": [f"row-{i}" for i in range(num_rows)],
        }
    )


# 1) Explicit lazy delivery for a medium-sized dataframe.
st.header("Lazy dataframe")
st.dataframe(make_df(5_000), lazy=True, height=300, width=400)

# 2) Auto-lazy for a large in-memory dataframe (> 150k rows) with lazy=None.
st.header("Auto-lazy dataframe")
st.dataframe(make_df(200_000), height=300, width=400)

# 3) Small dataframe with lazy=True stays eager (small-data optimization).
st.header("Small lazy stays eager")
st.dataframe(make_df(10), lazy=True, width=400)
