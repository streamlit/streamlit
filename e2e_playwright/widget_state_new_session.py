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

import streamlit as st

if "changes" not in st.session_state:
    st.session_state.changes = 0


def on_change() -> None:
    st.session_state.changes += 1


name = st.text_input("Name", key="name", on_change=on_change)
pick = st.selectbox("Pick", ["a", "b", "c"], key="pick", on_change=on_change)
agree = st.checkbox("Agree", key="agree", on_change=on_change)
st.button("Rerun")

st.write(f"values: {name}, {pick}, {agree}")
st.write(f"changes: {st.session_state.changes}")
