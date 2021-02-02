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

c1 = st.color_picker("Default Color")
st.write("Color 1", c1)

c2 = st.color_picker("New Color", "#EB144C")
st.write("Color 2", c2)

# st.session_state() can only run in streamlit
if st._is_running_with_streamlit:
    state = st.beta_session_state(color_changed=False)

    def color_change(new_value):
        state.color_changed = True

    c3 = st.color_picker("New Color 2", "#EB144C", on_change=color_change)
    st.write("Color 3:", c3)
    st.write("Color Changed:", state.color_changed)
