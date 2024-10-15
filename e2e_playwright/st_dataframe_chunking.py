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

# Generate a random dataframe
df = pd.DataFrame(
    np.random.randn(5000, 5),
    columns=("col_%d" % i for i in range(5)),
)


def get_data():
    chunk_size = 500
    total_rows = df.shape[0]

    def get_chunk(chunk_index: int) -> pd.DataFrame:
        time.sleep(0.5)
        # Get a chunk of data from the database
        return df.iloc[chunk_index * chunk_size : (chunk_index + 1) * chunk_size]

    return total_rows, get_chunk


st.dataframe(get_data)
