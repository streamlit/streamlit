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

options = ("female", "male")
i1 = st.radio("radio 1", options, 1)
st.write("value 1:", i1)

i2 = st.radio("radio 2", options, 0, format_func=lambda x: x.capitalize())
st.write("value 2:", i2)

i3 = st.radio("radio 3", [])
st.write("value 3:", i3)

if st._is_running_with_streamlit:

    def on_change():
        st.session_state.radio_changed = True

    st.radio("radio 4", options, 1, key="radio4", on_change=on_change)
    st.write("value 4:", st.session_state.radio4)
    st.write("radio changed:", "radio_changed" in st.session_state)
