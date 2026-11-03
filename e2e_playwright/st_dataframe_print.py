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

# One print shares a 50,000-cell budget, and one dataframe prints at most
# 1,000 rows. Both frames are eager so the print table is not cut short
# because a row is still loading.
#
# Row cap: 1,001 x 48. The first 1,000 rows are 48,000 cells, so the note is
# the row cap and 2,000 cells remain.
# Cell budget: 1,001 x 4. Those 2,000 cells are 500 rows, short of both this
# frame and the row cap, so the note is the shared budget.

_ROW_CAP_ROWS = 1_001
_ROW_CAP_COLUMNS = 48
_BUDGET_ROWS = 1_001
_BUDGET_COLUMNS = 4


def _frame(rows: int, columns: int) -> pd.DataFrame:
    return pd.DataFrame(
        {f"c{index}": np.arange(rows, dtype=np.int32) for index in range(columns)}
    )


# A display-only dataframe does not get an st-key class. The container does.
with st.container(key="row_cap"):
    st.dataframe(
        _frame(_ROW_CAP_ROWS, _ROW_CAP_COLUMNS),
        hide_index=True,
        width="stretch",
        height=200,
        lazy=False,
    )
with st.container(key="cell_budget"):
    st.dataframe(
        _frame(_BUDGET_ROWS, _BUDGET_COLUMNS),
        hide_index=True,
        width="stretch",
        height=200,
        lazy=False,
    )
