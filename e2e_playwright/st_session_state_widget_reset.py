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

KEYS = ["text", "num", "sel", "multi", "slide", "check", "bound", "body"]


def _delete_all() -> None:
    """Delete every widget key from session state."""
    for key in KEYS:
        st.session_state.pop(key, None)


def _count_text_change() -> None:
    """Count every on_change the Text widget reports."""
    st.session_state["text_changes"] = st.session_state.get("text_changes", 0) + 1


st.text_input("Text", value="default", key="text", on_change=_count_text_change)
st.number_input("Num", value=1, key="num")
st.selectbox("Sel", ["A", "B", "C"], key="sel")
st.multiselect("Multi", ["A", "B", "C"], key="multi")
st.slider("Slide", 0, 10, 3, key="slide")
st.checkbox("Check", value=False, key="check")
st.text_input("Bound", value="default", key="bound", bind="query-params")
st.text_input("Body", value="body_default", key="body")

st.button("Delete in callback", key="delete_cb", on_click=_delete_all)
delete_in_body = st.button("Delete in script body", key="delete_body")
st.button("Noop", key="noop")

for key in KEYS:
    # Always display the current session_state value so a test can assert it
    # next to the value rendered in the widget itself.
    with st.container(key=f"{key}_value"):
        st.write(f"{key}: {st.session_state.get(key, 'UNSET')}")

with st.container(key="text_changes_value"):
    st.write(f"text_changes: {st.session_state.get('text_changes', 0)}")

if delete_in_body:
    # The delete runs after the widget rendered, so the reset waits for the next
    # rerun. A user change that arrives first must win over the reset.
    st.session_state.pop("body", None)
