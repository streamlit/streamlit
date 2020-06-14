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

import streamlit as st
from datetime import datetime
from datetime import date

d1 = st.date_input("Single date", date(1970, 1, 1), min_value=date(1970, 1, 1))
st.write("Value 1:", d1)

d2 = st.date_input("Single datetime", datetime(2019, 7, 6, 21, 15))
st.write("Value 2:", d2)

d3 = st.date_input("Range, no date", [])
st.write("Value 3:", d3)

d4 = st.date_input("Range, one date", [date(2019, 7, 6)])
st.write("Value 4:", d4)

d4 = st.date_input("Range, two dates", [date(2019, 7, 6), date(2019, 7, 8)])
st.write("Value 5:", d4)
