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
from streamlit import runtime

if runtime.is_running():
    if "checkbox1" not in st.session_state:
        st.session_state.checkbox1 = True

    def on_checkbox_change(changed_checkbox_number):
        if changed_checkbox_number == 1:
            st.session_state.checkbox2 = False
        elif changed_checkbox_number == 2:
            st.session_state.checkbox1 = False

    st.checkbox(
        label="Checkbox1", key="checkbox1", on_change=on_checkbox_change, args=(1,)
    )
    st.checkbox(
        label="Checkbox2", key="checkbox2", on_change=on_checkbox_change, args=(2,)
    )
