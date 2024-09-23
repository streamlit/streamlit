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

import numpy as np
import pyarrow as pa

import streamlit as st
from streamlit import type_util

np.random.seed(0)
random.seed(0)


a = pa.array([1, 2, 3, 4])
b = pa.array(["foo", "bar", "baz", ""])

pydict = {"id": a, "str": b}
df = pa.Table.from_pydict(pydict)

st.dataframe(type_util.convert_anything_to_df(df))

# >>> df.schema
# id: int64
# age: int64

st.dataframe(df)

data = {
    "index_columns": [
        {"kind": "range", "name": None, "start": 0, "stop": 4, "step": 1}
    ],
    "column_indexes": [
        {
            "name": None,
            "field_name": None,
            "pandas_type": "unicode",
            "numpy_type": "object",
            "metadata": {"encoding": "UTF-8"},
        }
    ],
    "columns": [
        {
            "name": "id",
            "field_name": "id",
            "pandas_type": "int64",
            "numpy_type": "int64",
            "metadata": None,
        },
        {
            "name": "str",
            "field_name": "str",
            "pandas_type": "unicode",
            "numpy_type": "object",
            "metadata": None,
        },
    ],
    "creator": {"library": "pyarrow", "version": "16.1.0"},
    "pandas_version": "2.2.2",
}
