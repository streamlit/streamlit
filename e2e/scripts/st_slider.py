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

w1 = st.slider("Label 1", 0, 100, 25, 1)
st.write("Value 1:", w1)

w2 = st.slider("Label 2", 0.0, 100.0, (25.0, 75.0), 0.5)
st.write("Value 2:", w2)

if st._is_running_with_streamlit:

    def on_change():
        st.session_state.slider_changed = True

    st.slider(
        "Label 3",
        min_value=0,
        max_value=100,
        value=25,
        step=1,
        key="slider3",
        on_change=on_change,
    )
    st.write("Value 3:", st.session_state.slider3)
    st.write("Slider changed:", "slider_changed" in st.session_state)
