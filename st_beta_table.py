# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import numpy as np
import pandas as pd

import streamlit as st

df1 = pd.DataFrame(
    [["foo", 0], ["bar", 1]],
    index=["r1", "r2"],
    columns=["c1", "c2"],
)
df2 = pd.DataFrame(
    [["baz", 2]],
    index=["r3"],
    columns=["c1", "c2"],
)

"## st.table"
t = st.table(df1)
t.add_rows(df2)

"## st.beta_table"
bt = st.beta_table(df1)
bt.beta_add_rows(df2)
