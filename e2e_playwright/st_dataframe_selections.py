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

import random
import time

import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(0)
random.seed(0)

# Generate a random dataframe
df = pd.DataFrame(
    np.random.randn(5, 5),
    columns=[f"col_{i}" for i in range(5)],
)

# set fixed column with so our pixel-clicks in the test are stable
column_with_fixed_width = st.column_config.Column(width="small")
column_config = {
    "_index": column_with_fixed_width,
    "col_0": column_with_fixed_width,
    "col_1": column_with_fixed_width,
    "col_2": column_with_fixed_width,
    "col_3": column_with_fixed_width,
    "col_4": column_with_fixed_width,
}

st.subheader("single-row select")
selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode="single-row",
    column_config=column_config,
    width="content",
    key="single_row_select",
)
st.write("Dataframe single-row selection:", str(selection))

st.subheader("single-column select")
selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode="single-column",
    column_config=column_config,
    width="content",
    key="single_column_select",
)
st.write("Dataframe single-column selection:", str(selection))

st.subheader("multi-row select")
selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode="multi-row",
    column_config=column_config,
    width="content",
    key="multi_row_select",
)
st.write("Dataframe multi-row selection:", str(selection))


st.subheader("multi-column select")
selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode="multi-column",
    column_config=column_config,
    width="content",
    key="multi_column_select",
)
st.write("Dataframe multi-column selection:", str(selection))

if st.button("Create some elements to unmount component"):
    for _ in range(3):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")

st.subheader("multi-row & multi-column select")
selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode=["multi-row", "multi-column"],
    column_config=column_config,
    width="content",
    key="multi_row_multi_column_select",
)
st.write("Dataframe multi-row-multi-column selection:", str(selection))

st.subheader("single-row & single-column select")
selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode=["single-row", "single-column"],
    column_config=column_config,
    width="content",
    key="single_row_single_column_select",
)
st.write("Dataframe single-row-single-column selection:", str(selection))

st.header("Selections in form:")

with st.form(key="my_form", clear_on_submit=True):
    selection = st.dataframe(
        df,
        hide_index=True,
        on_select="rerun",
        selection_mode=["multi-row", "multi-column"],
        key="df_selection_in_form",
        column_config=column_config,
        width="content",
    )
    st.form_submit_button("Submit")

st.write("Dataframe-in-form selection:", str(selection))
if "df_selection_in_form" in st.session_state:
    st.write(
        "Dataframe-in-form selection in session state:",
        str(st.session_state.df_selection_in_form),
    )

st.header("Selection callback:")


def on_selection():
    st.write("Dataframe selection callback:", str(st.session_state.df_selection))


st.dataframe(
    df,
    hide_index=True,
    on_select=on_selection,
    selection_mode=["multi-row", "multi-column"],
    key="df_selection",
    column_config=column_config,
    width="content",
)

st.header("Selections in fragment:")


@st.fragment
def test_fragment() -> None:
    selection = st.dataframe(
        df,
        hide_index=True,
        on_select="rerun",
        selection_mode=["multi-row", "multi-column"],
        key="inside_fragment",
        column_config=column_config,
        width="content",
    )
    st.write("Dataframe-in-fragment selection:", str(selection))


test_fragment()

if "runs" not in st.session_state:
    st.session_state.runs = 0
st.session_state.runs += 1
st.write("Runs:", st.session_state.runs)

st.subheader("Dataframe with Index:")

selection = st.dataframe(
    df,
    hide_index=False,
    on_select="rerun",
    selection_mode=["multi-column"],
    key="with_index",
    column_config=column_config,
    column_order=["col_1", "col_3"],
    width="content",
)
st.write("No selection on index column:", str(selection))

st.subheader("single-cell select")
selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode="single-cell",
    column_config=column_config,
    width="content",
    key="single_cell_select",
)
st.write("Dataframe single-cell selection:", str(selection))

st.subheader("multi-cell select")
selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode="multi-cell",
    column_config=column_config,
    width="content",
    key="multi_cell_select",
)
st.write("Dataframe multi-cell selection:", str(selection))

st.subheader("multi-row & single-cell select")
selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode=["multi-row", "single-cell"],
    column_config=column_config,
    width="content",
    key="multi_row_single_cell_select",
)
st.write("Dataframe multi-row & single-cell selection:", str(selection))

st.subheader("multi-row, multi-column & multi-cell select")
selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode=["multi-row", "multi-column", "multi-cell"],
    column_config=column_config,
    width="content",
    key="multi_row_multi_column_multi_cell_select",
)
st.write("Dataframe multi-row, multi-column & multi-cell selection:", str(selection))

# Test for selection persistence with data changes (key_as_main_identity feature)
st.header("Selection persistence with data changes:")

# Initialize update counter in session state
if "data_update_count" not in st.session_state:
    st.session_state.data_update_count = 0


def increment_data_count():
    """Callback to increment the data update counter."""
    st.session_state.data_update_count += 1


# Create dynamic data based on update count - use fixed seed for reproducibility
# but offset by the update count to ensure data actually changes
rng = np.random.default_rng(42 + st.session_state.data_update_count)
dynamic_df = pd.DataFrame({f"col_{i}": rng.standard_normal(5) for i in range(5)})

selection = st.dataframe(
    dynamic_df,
    hide_index=True,
    on_select="rerun",
    selection_mode="multi-row",
    column_config=column_config,
    width="content",
    key="persistent_selection_df",
)
st.write("Persistent selection:", str(selection))
st.write("Data update count:", st.session_state.data_update_count)

# Use on_click callback to ensure counter is incremented before the rerun completes
st.button("Update data", key="update_data_btn", on_click=increment_data_count)

st.header("Selection default:")

selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode="multi-row",
    selection_default={"selection": {"rows": [1, 3], "columns": [], "cells": []}},
    column_config=column_config,
    width="content",
    key="selection_default_df",
)
st.write("Selection default row selection:", str(selection))

st.header("Programmatic selection via session state:")

# Pre-set selection via session state if not already set
if "programmatic_row_selection_df" not in st.session_state:
    st.session_state["programmatic_row_selection_df"] = {
        "selection": {"rows": [1, 3], "columns": [], "cells": []}
    }

selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode="multi-row",
    column_config=column_config,
    width="content",
    key="programmatic_row_selection_df",
)
st.write("Programmatic row selection:", str(selection))
# Attribute access verifies AttributeDictionary is returned (regression test for #14454).
st.write("Programmatic row selection rows:", str(selection.selection.rows))  # type: ignore[attr-defined]


def set_programmatic_selection():
    """Callback to set a new programmatic selection."""
    st.session_state["programmatic_row_selection_df"] = {
        "selection": {"rows": [0, 2, 4], "columns": [], "cells": []}
    }


def clear_programmatic_selection():
    """Callback to clear the programmatic selection."""
    st.session_state["programmatic_row_selection_df"] = {
        "selection": {"rows": [], "columns": [], "cells": []}
    }


st.button(
    "Set selection to rows 0, 2, 4",
    on_click=set_programmatic_selection,
)
st.button(
    "Clear dataframe selection",
    on_click=clear_programmatic_selection,
)

# Programmatic column + cell selection (verifies non-row selection types)
if "programmatic_col_cell_df" not in st.session_state:
    st.session_state["programmatic_col_cell_df"] = {
        "selection": {
            "rows": [],
            "columns": ["col_1", "col_3"],
            "cells": [[2, "col_0"]],
        }
    }

selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode=["multi-column", "single-cell"],
    column_config=column_config,
    width="content",
    key="programmatic_col_cell_df",
)
st.write("Column+cell selection:", str(selection))

st.subheader("single-row-required select")
selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode="single-row-required",
    column_config=column_config,
    width="content",
    key="single_row_required_select",
)
st.write("Dataframe single-row-required selection:", str(selection))

# Combined single-row-required + multi-column with programmatic control
st.subheader("single-row-required + multi-column select")


def set_combined_selection():
    st.session_state["combined_row_col_select"] = {
        "selection": {"rows": [3], "columns": ["col_2", "col_4"], "cells": []}
    }


def clear_combined_columns():
    # Clear only columns while keeping the required row
    current = st.session_state.get("combined_row_col_select", {})
    current_selection = current.get(
        "selection", {"rows": [1], "columns": [], "cells": []}
    )
    st.session_state["combined_row_col_select"] = {
        "selection": {
            "rows": current_selection.get("rows", [1]),
            "columns": [],
            "cells": [],
        }
    }


# Default selection: row 1, columns col_1 and col_3
if "combined_row_col_select" not in st.session_state:
    st.session_state["combined_row_col_select"] = {
        "selection": {"rows": [1], "columns": ["col_1", "col_3"], "cells": []}
    }

selection = st.dataframe(
    df,
    hide_index=True,
    on_select="rerun",
    selection_mode=["single-row-required", "multi-column"],
    column_config=column_config,
    width="content",
    key="combined_row_col_select",
)
st.write("Combined row+col selection:", str(selection))

st.button("Change to row 3, cols 2+4", on_click=set_combined_selection)
st.button("Clear columns only", on_click=clear_combined_columns)
