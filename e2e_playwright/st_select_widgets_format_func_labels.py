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

"""Regression app for https://github.com/streamlit/streamlit/issues/17175.

The selection of select widgets must survive reruns after the labels produced by
format_func change, since the frontend tracks the selection by label.
"""

import streamlit as st

if st.button("Bump label count"):
    st.session_state["label_count"] = st.session_state.get("label_count", 0) + 1


def fmt(option: str) -> str:
    # Read the counter on every call so this run's label differs from the
    # label the browser still has. The server must detect that mismatch and
    # push the new label.
    return f"{option} ({st.session_state.get('label_count', 0)})"


selected = st.selectbox(
    "selectbox with changing labels",
    ["D", "E"],
    format_func=fmt,
    index=None,
    key="relabeled_select",
)
st.write("selectbox value:", selected)

selected_many = st.multiselect(
    "multiselect with changing labels",
    ["D", "E", "F"],
    format_func=fmt,
    key="relabeled_multi",
)
st.write("multiselect value:", str(selected_many))

selected_radio = st.radio(
    "radio with changing labels",
    ["D", "E"],
    format_func=fmt,
    index=None,
    key="relabeled_radio",
)
st.write("radio value:", selected_radio)

selected_slider = st.select_slider(
    "select slider with changing labels",
    options=["D", "E", "F"],
    format_func=fmt,
    key="relabeled_slider",
)
st.write("select slider value:", selected_slider)

with st.form("pending_form"):
    pending = st.selectbox(
        "pending form selectbox",
        ["D", "E", "F"],
        format_func=fmt,
        index=None,
        key="pending_form_select",
    )
    pending_submitted = st.form_submit_button("Submit pending form")
st.write("pending form value:", pending)
st.write("pending form submitted:", pending_submitted)
