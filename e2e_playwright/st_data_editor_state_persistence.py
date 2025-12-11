# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

"""Test app for data_editor state persistence with session state feedback loop.

This app tests the fix for issue #7749:
https://github.com/streamlit/streamlit/issues/7749

The issue was that when using st.data_editor with session state and a computed
column, edits would "disappear" and require double-input to register changes.
"""

import pandas as pd

import streamlit as st

# Test 1: Session state feedback loop with computed column (issue #7749)
st.subheader("Session State Feedback Loop")

if "df_feedback" not in st.session_state:
    st.session_state.df_feedback = pd.DataFrame({"In": [0, 1, 2], "Out": [0, 0, 0]})

# The key is crucial here - it ensures stable widget identity
st.session_state.df_feedback = st.data_editor(
    st.session_state.df_feedback,
    key="feedback_editor",
    width="content",
    hide_index=True,
)

# Compute the "Out" column based on "In" - this is what triggers the issue
st.session_state.df_feedback["Out"] = st.session_state.df_feedback["In"] ** 2

st.write("Current state:")
st.dataframe(st.session_state.df_feedback, key="feedback_display")

# Show the "In" column sum for verification
in_sum = st.session_state.df_feedback["In"].sum()
st.markdown(f"Sum of In column: `{in_sum}`")


# Test 2: Simple edit without computed column (baseline)
st.subheader("Simple Edit (No Computed Column)")

if "df_simple" not in st.session_state:
    st.session_state.df_simple = pd.DataFrame({"A": [1, 2, 3], "B": [4, 5, 6]})

st.session_state.df_simple = st.data_editor(
    st.session_state.df_simple,
    key="simple_editor",
    width="content",
    hide_index=True,
)

simple_sum = st.session_state.df_simple["A"].sum()
st.markdown(f"Sum of A column: `{simple_sum}`")


# Test 3: Row deletion via UI - verify edits to other rows are preserved
st.subheader("Row Deletion (User-Initiated)")

if "df_delete" not in st.session_state:
    st.session_state.df_delete = pd.DataFrame(
        {"Name": ["Alice", "Bob", "Charlie", "Diana"], "Score": [100, 200, 300, 400]}
    )

st.session_state.df_delete = st.data_editor(
    st.session_state.df_delete,
    key="delete_editor",
    num_rows="dynamic",
    width="content",
    hide_index=True,
)

delete_row_count = len(st.session_state.df_delete)
delete_total = st.session_state.df_delete["Score"].sum()
st.markdown(f"Delete test row count: `{delete_row_count}`")
st.markdown(f"Delete test total: `{delete_total}`")


# Test 4: Row addition via UI - verify existing edits are preserved
st.subheader("Row Addition (User-Initiated)")

if "df_add" not in st.session_state:
    st.session_state.df_add = pd.DataFrame({"Item": ["A", "B"], "Value": [10, 20]})

st.session_state.df_add = st.data_editor(
    st.session_state.df_add,
    key="add_editor",
    num_rows="dynamic",
    width="content",
    hide_index=True,
)

add_row_count = len(st.session_state.df_add)
add_total = st.session_state.df_add["Value"].sum()
st.markdown(f"Add test row count: `{add_row_count}`")
st.markdown(f"Add test total: `{add_total}`")
