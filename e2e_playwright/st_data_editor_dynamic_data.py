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

from __future__ import annotations

import json

import pandas as pd

import streamlit as st

EMPTY_EDITOR_STATE = {"edited_rows": {}, "added_rows": [], "deleted_rows": []}
COLUMN_CONFIG = {
    "a": st.column_config.NumberColumn(width="small"),
    "b": st.column_config.NumberColumn(width="small"),
}


def _init_state() -> None:
    if "value_df" not in st.session_state:
        st.session_state.value_df = pd.DataFrame({"a": [1, 2], "b": [10, 20]})

    if "catchup_df" not in st.session_state:
        st.session_state.catchup_df = pd.DataFrame({"a": [1, 2], "b": [10, 20]})


def _render_state_marker(test_id: str, key: str) -> None:
    state = st.session_state.get(key, EMPTY_EDITOR_STATE)
    state_json = json.dumps(state, sort_keys=True)
    st.markdown(
        f"<div data-testid='{test_id}'>{state_json}</div>",
        unsafe_allow_html=True,
    )


_init_state()

st.header("Value changes")

if st.button("Value: update untouched cell"):
    st.session_state.value_df.loc[1, "b"] += 100

if st.button("Value: add source row"):
    next_index = len(st.session_state.value_df)
    st.session_state.value_df.loc[next_index] = {"a": 99, "b": 99}

value_result = st.data_editor(
    st.session_state.value_df,
    key="value_editor",
    num_rows="fixed",
    hide_index=True,
    width="content",
    column_config=COLUMN_CONFIG,
)

st.markdown(
    f"<div data-testid='value-result-a0'>{int(value_result.loc[0, 'a'])}</div>",
    unsafe_allow_html=True,
)
st.markdown(
    f"<div data-testid='value-result-b1'>{int(value_result.loc[1, 'b'])}</div>",
    unsafe_allow_html=True,
)
_render_state_marker("value-editor-state", "value_editor")

st.header("Source catches up")

if st.button("Catchup: source to edited value"):
    st.session_state.catchup_df.loc[0, "a"] = 20

if st.button("Catchup: source moves again"):
    st.session_state.catchup_df.loc[0, "a"] = 30

catchup_result = st.data_editor(
    st.session_state.catchup_df,
    key="catchup_editor",
    num_rows="fixed",
    hide_index=True,
    width="content",
    column_config=COLUMN_CONFIG,
)

st.markdown(
    f"<div data-testid='catchup-result-a0'>{int(catchup_result.loc[0, 'a'])}</div>",
    unsafe_allow_html=True,
)
_render_state_marker("catchup-editor-state", "catchup_editor")
