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
from streamlit.type_util import DataFormat
from tests.streamlit.data_mocks import SHARED_TEST_CASES, TestCaseMetadata

np.random.seed(0)
random.seed(0)

st.set_page_config(layout="wide")

activate_dynamic_editing = st.toggle("Activate dynamic editing")
show_return_data = st.toggle("Show return data")

TEST_CASES = SHARED_TEST_CASES.copy()
TEST_CASES.append(
    (
        pd.DataFrame(
            np.random.randn(3, 3),
            columns=pd.MultiIndex.from_tuples(
                [("A", "foo"), ("A", "bar"), ("B", "foo")]
            ),
        ),  # Explicitly set the range index to have the same behavior across versions
        TestCaseMetadata(0, 2, DataFormat.PANDAS_DATAFRAME),
    ),
)

# # Render all test cases with st.data_editor:
for i, test_case in enumerate(TEST_CASES):
    data = test_case[0]
    data_format = str(test_case[1].expected_data_format)
    st.subheader(data_format)
    return_df_fixed = st.data_editor(
        data,
        key=f"data_editor-{i}",
        num_rows="dynamic" if activate_dynamic_editing else "fixed",
    )
    if show_return_data:
        st.dataframe(return_df_fixed)
