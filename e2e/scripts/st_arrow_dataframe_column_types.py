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

import random

import numpy as np
import pandas as pd

import streamlit as st
from tests.streamlit.data_mocks import (
    BASE_TYPES_DF,
    DATETIME_TYPES_DF,
    INTERVAL_TYPES_DF,
    LIST_TYPES_DF,
    NUMBER_TYPES_DF,
    SPECIAL_TYPES_DF,
    UNSUPPORTED_TYPES_DF,
)

np.random.seed(0)
random.seed(0)

st.set_page_config(layout="wide")

st.subheader("Base types")
st._arrow_dataframe(BASE_TYPES_DF, use_container_width=True)

st.subheader("Number types")
st._arrow_dataframe(NUMBER_TYPES_DF, use_container_width=True)

st.subheader("Date, time and datetime types")
st._arrow_dataframe(DATETIME_TYPES_DF, use_container_width=True)

st.subheader("List types")
st._arrow_dataframe(LIST_TYPES_DF, use_container_width=True)

st.subheader("Interval dtypes in pd.DataFrame")
st._arrow_dataframe(INTERVAL_TYPES_DF, use_container_width=True)

st.subheader("Special types")
st._arrow_dataframe(SPECIAL_TYPES_DF, use_container_width=True)

st.subheader("Unsupported types")
st._arrow_dataframe(UNSUPPORTED_TYPES_DF, use_container_width=True)

st.subheader("Long colum header")
st._arrow_dataframe(
    pd.DataFrame(
        np.random.randn(100, 4),
        columns=[
            "this is a very long header name",
            "A",
            "C",
            "this is another long name",
        ],
    )
)
