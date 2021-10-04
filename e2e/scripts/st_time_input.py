# Copyright 2018-2021 Streamlit Inc.
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
from datetime import time

w1 = st.time_input("Label 1", time(8, 45))
st.write("Value 1:", w1)

w2 = st.time_input("Label 2", datetime(2019, 7, 6, 21, 15))
st.write("Value 2:", w2)


if st._is_running_with_streamlit:

    def on_change():
        st.session_state.time_input_changed = True

    st.time_input("Label 3", key="time_input3", on_change=on_change)

    st.write("Value 3:", st.session_state.time_input3)
    st.write("time input changed:", "time_input_changed" in st.session_state)
