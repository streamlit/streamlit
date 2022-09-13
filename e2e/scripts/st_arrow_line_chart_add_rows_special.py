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

"""
This example was failing due to an issue (#3653) in st._arrow_add_rows.
In the previous implementation of Quiver, we were mutating the Quiver element
in the addRows function, which prevented re-rendering of the line chart.
This example reproduces the issue, so that we don't repeat the same mistake
in the future.
"""

import time

import pandas as pd
import streamlit as st

current_time = pd.to_datetime("08:00:00 2021-01-01", utc=True)
simulation_step = pd.Timedelta(seconds=10)

df1 = pd.DataFrame(data=[[current_time, 1]], columns=["t", "y"]).set_index("t")
line_chart = st._arrow_line_chart(df1, use_container_width=True)

for count in range(5):
    current_time += simulation_step

    df2 = pd.DataFrame(data=[[current_time, count]], columns=["t", "y"]).set_index("t")
    # This issue is Arrow specific, that's why st._legacy_add_rows doesn't have a similar test.
    line_chart._arrow_add_rows(df2)
    time.sleep(1)
