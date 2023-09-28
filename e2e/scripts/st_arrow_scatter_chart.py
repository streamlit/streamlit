# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
from tests.streamlit import snowpark_mocks

np.random.seed(0)

N = 100

df = pd.DataFrame(
    {
        # Using a negative range so certain kinds of bugs are more visible.
        "a": -np.arange(N),
        "b": np.random.rand(N) * 10,
        "c": np.random.rand(N) * 10,
        "d": np.random.randn(N) * 30,
    }
)

# Pulled into a separate df because this doesn't make sense for certain charts.
df2 = df.copy()
df2["e"] = ["bird" if x % 2 else "airplane" for x in range(N)]

"""
### Snowpark dataframe with too many rows

Should show a warning.
"""
st.scatter_chart(snowpark_mocks.DataFrame())

"""
### Dataframe with no data.

Chart should still have a normal size (though no axes, etc.)
"""
st.scatter_chart()

"""
### Long dataframe with nominal or quantitative color column

Each should show 2 series, with varying sizes.

The color and size legends should be more or less vertically centered on each other.
"""
st.scatter_chart(df2, x="a", y="b", size="c", color="e")
st.scatter_chart(df2, x="a", y="b", size="d", color="e")
st.scatter_chart(df2, x="a", y="b", size="d", color="c")
