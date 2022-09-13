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

import streamlit as st

i1 = st.checkbox("checkbox 1", True)
st.write("value 1:", i1)

i2 = st.checkbox("checkbox 2", False)
st.write("value 2:", i2)

i3 = st.checkbox("checkbox 3")
st.write("value 3:", i3)

if st._is_running_with_streamlit:

    def on_change():
        st.session_state.checkbox_clicked = True

    st.checkbox("checkbox 4", key="checkbox4", on_change=on_change)
    st.write("value 4:", st.session_state.checkbox4)
    st.write("checkbox clicked:", "checkbox_clicked" in st.session_state)

i5 = st.checkbox("checkbox 5", disabled=True)
st.write("value 5:", i5)

i6 = st.checkbox("checkbox 6", value=True, disabled=True)
st.write("value 6:", i6)
