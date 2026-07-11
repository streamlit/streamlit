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
import random
import time
from typing import Any

import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(0)
random.seed(0)

EMPTY_EDITOR_STATE: dict[str, Any] = {
    "edited_rows": {},
    "added_rows": [],
    "deleted_rows": [],
}
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

st.header("Row editing")

random_df = pd.DataFrame(
    np.random.randn(5, 5),
    columns=["Column A", "Column B", "Column C", "Column D", "Column E"],
)

# Used by the state-persistence test: clicking this button appends elements
# (with a short delay) which forces the data editor above it to unmount and
# remount, so we can verify the edited row state survives.
if st.button("Create some elements to unmount component"):
    for _ in range(3):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")

st.data_editor(random_df, num_rows="dynamic", key="data_editor", width="content")

st.header("Cell editing")

cell_overlay_test_df = pd.DataFrame(
    {
        "big_numbers": [1231231.41, 12012],
        "text": ["hello\nworld", "foo"],
        "list": [["hello", "world"], ["c", "d", "e"]],
    }
)

cell_overlay_test_column_config = {
    # The e2e interaction testing logic requires all cells to be medium width to
    # calculate the cell positions correctly.
    "big_numbers": st.column_config.NumberColumn(
        width="medium",
    ),
    "text": st.column_config.TextColumn(
        width="medium",
    ),
    "list": st.column_config.ListColumn(
        width="medium",
    ),
}

cell_editing_result = st.data_editor(
    cell_overlay_test_df,
    hide_index=True,
    column_config=cell_overlay_test_column_config,
    width="content",
    key="cell_editor",
)

st.write("Edited DF:", str(cell_editing_result))
