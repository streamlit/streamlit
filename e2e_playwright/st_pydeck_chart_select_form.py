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
from __future__ import annotations

import streamlit as st
from shared.pydeck_utils import get_pydeck_chart

with st.form(key="my_form", clear_on_submit=True):
    text_value = st.text_input("Text input 1")

    selection = get_pydeck_chart("selection_in_form", selection_mode="single")
    st.form_submit_button("Submit")

st.write("text_value:", text_value)
st.write("PyDeck-in-form selection:", str(selection))
if "selection_in_form" in st.session_state:
    st.write(
        "PyDeck-in-form selection in session state:",
        str(st.session_state.selection_in_form),
    )
