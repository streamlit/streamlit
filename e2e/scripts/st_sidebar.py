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

w1 = st.sidebar.date_input("Label 1", date(1970, 1, 1))
st.write("Value 1:", w1)

w2 = st.sidebar.date_input("Label 2", datetime(2019, 7, 6, 21, 15))
st.write("Value 2:", w2)

x = st.sidebar.text("overwrite me")
x.text("overwritten")
