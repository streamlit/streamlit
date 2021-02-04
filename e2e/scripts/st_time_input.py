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

# st.session_state() can only run in streamlit
if st._is_running_with_streamlit:
    state = st.beta_session_state(time_changed=False)

    def change_handler(new_text):
        state.time_changed = True

    w3 = st.time_input(
        "change test", datetime(2019, 7, 6, 21, 15), on_change=change_handler
    )
    st.write("Value 3:", w3)
    st.write("Time Changed:", state.time_changed)
