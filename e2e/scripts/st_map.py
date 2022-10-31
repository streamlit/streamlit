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

from typing import Any, cast

import numpy as np
import pandas as pd

import streamlit as st
from tests.streamlit import pyspark_mocks
from tests.streamlit.snowpark_mocks import DataFrame as MockedSnowparkDataFrame
from tests.streamlit.snowpark_mocks import Table as MockedSnowparkTable

# Empty map.

st.map()

# st.map with pyspark.sql.DataFrame

st.map(pyspark_mocks.DataFrame(is_map=True))

# st.map with unevaluated Snowpark DataFrame

st.map(MockedSnowparkTable(is_map=True, num_of_rows=50000))

# st.map with unevaluated Snowpark Table

st.map(MockedSnowparkDataFrame(is_map=True, num_of_rows=50000))

# Simple map.

# Cast is needed due to mypy not understanding the outcome of dividing
# an array by a list of numbers.
np.random.seed(0)
coords: "np.typing.NDArray[np.float_]" = cast(
    Any,
    np.random.randn(1000, 2) / [50, 50],
) + [37.76, -122.4]
df = pd.DataFrame(coords, columns=["lat", "lon"])

st.map(df)

# Same but with custom zoom level:

st.map(df, zoom=8)
