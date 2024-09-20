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

from datetime import datetime, time, timedelta

import pandas as pd
from zoneinfo import ZoneInfo

import streamlit as st
from streamlit.elements.lib.column_types import DatetimeColumn

tz = "US/Eastern"

some_date = datetime(2024, 1, 1)

min_date = datetime.combine(some_date, time(), tzinfo=ZoneInfo(tz))
max_date = min_date + timedelta(days=1)

df = pd.DataFrame([{"date": some_date.astimezone(ZoneInfo(tz))}])

st.data_editor(
    df,
    column_config={
        "date": DatetimeColumn(timezone=tz, min_value=min_date, max_value=max_date)
    },
)
