# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""Elements that a rerun shifts to a later position.

Each scenario sleeps after inserting output so the browser renders the
insertion before the shifted elements are re-emitted.
"""

import time

import pandas as pd

import streamlit as st

with st.container(key="shift_section"):
    if st.toggle("Insert notice", key="insert_notice"):
        st.info("Inserted notice")
        time.sleep(1.5)
    st.text_input("Name", key="name")
    st.data_editor(pd.DataFrame({"a": [1, 2, 3]}), key="editor")
    # The notice displaces the whole columns block, so this input remounts and
    # restores its value from the widget state.
    left, _ = st.columns(2)
    left.text_input("In column", key="in_column")

with st.container(key="focus_section"):
    query = st.session_state.get("query")
    if query:
        st.info(f"Searching for {query}")
        time.sleep(1.5)
    st.text_input("Query", key="query")

with st.container(key="swap_section"):
    if st.toggle("Use number input", key="use_number"):
        st.number_input("Amount", key="amount")
        time.sleep(1.5)
    else:
        st.text_input("Label", key="label")
