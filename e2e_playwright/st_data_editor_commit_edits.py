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

# The commit_edits callbacks intentionally accept the full
# (source_df, edited_df, edits) contract signature even when a given callback
# only needs some of the arguments.
# ruff: noqa: ARG001
import json
import time
from typing import TYPE_CHECKING, Any

import pandas as pd

import streamlit as st

if TYPE_CHECKING:
    from streamlit.typing import DataEditorState

EMPTY_EDITOR_STATE: dict[str, Any] = {
    "edited_rows": {},
    "added_rows": [],
    "deleted_rows": [],
}

# Enforce a fixed small column width so the Playwright test can compute cell
# positions deterministically.
TEXT_COLUMN_CONFIG = {"item": st.column_config.TextColumn(width="small")}
ORDER_COLUMN_CONFIG = {"order": st.column_config.TextColumn(width="small")}


def _marker(test_id: str, value: str) -> None:
    """Render a stable, test-targetable text probe."""
    st.markdown(
        f"<div data-testid='{test_id}'>{value}</div>",
        unsafe_allow_html=True,
    )


def _state_marker(test_id: str, key: str) -> None:
    """Render the current pending edit state of a keyed editor as JSON."""
    state = st.session_state.get(key, EMPTY_EDITOR_STATE)
    _marker(test_id, json.dumps(state, sort_keys=True))


# A plain rerun trigger. Used by the test to force an unrelated rerun so it can
# observe that pending edits were cleared (on success) or preserved (on failure)
# without re-invoking the commit callback.
st.button("Rerun app")


# ---------------------------------------------------------------------------
# 1. Success commit: the callback transforms the batch (uppercases the value)
#    and persists the result. After the rerun the committed value is shown and
#    the pending edits are cleared.
# ---------------------------------------------------------------------------
st.header("Success commit")

if "success_df" not in st.session_state:
    st.session_state.success_df = pd.DataFrame({"item": ["alpha"]})


def commit_success(
    source_df: pd.DataFrame,
    edited_df: pd.DataFrame,
    edits: DataEditorState,
) -> pd.DataFrame:
    result = edited_df.copy()
    result["item"] = result["item"].str.upper()
    st.session_state.success_df = result
    return result


st.data_editor(
    st.session_state.success_df,
    key="success_editor",
    num_rows="fixed",
    hide_index=True,
    width="content",
    column_config=TEXT_COLUMN_CONFIG,
    commit_edits=commit_success,
)
_marker("success-committed", str(st.session_state.success_df.loc[0, "item"]))
_state_marker("success-editor-state", "success_editor")


# ---------------------------------------------------------------------------
# 2. Reject / revert: the callback returns the source dataframe unchanged (a
#    successful return that clears the edits) and surfaces feedback via
#    st.warning. The edited value is never persisted.
# ---------------------------------------------------------------------------
st.header("Reject commit")

if "revert_calls" not in st.session_state:
    st.session_state.revert_calls = 0

revert_df = pd.DataFrame({"item": ["baseline"]})


def commit_revert(
    source_df: pd.DataFrame,
    edited_df: pd.DataFrame,
    edits: DataEditorState,
) -> pd.DataFrame:
    st.session_state.revert_calls += 1
    st.warning("Edit reverted")
    return source_df


st.data_editor(
    revert_df,
    key="revert_editor",
    num_rows="fixed",
    hide_index=True,
    width="content",
    column_config=TEXT_COLUMN_CONFIG,
    commit_edits=commit_revert,
)
_marker("revert-source", str(revert_df.loc[0, "item"]))
_marker("revert-calls", str(st.session_state.revert_calls))
_state_marker("revert-editor-state", "revert_editor")


# ---------------------------------------------------------------------------
# 3. Failure: the callback raises. Streamlit shows the standard exception UI,
#    preserves the pending edits, and does not persist anything. The callback
#    must not be re-invoked on an unrelated rerun (no automatic retry).
# ---------------------------------------------------------------------------
st.header("Failing commit")

if "fail_calls" not in st.session_state:
    st.session_state.fail_calls = 0

fail_df = pd.DataFrame({"item": ["keepme"]})


def commit_fail(
    source_df: pd.DataFrame,
    edited_df: pd.DataFrame,
    edits: DataEditorState,
) -> pd.DataFrame:
    st.session_state.fail_calls += 1
    raise ValueError("commit boom")


st.data_editor(
    fail_df,
    key="fail_editor",
    num_rows="fixed",
    hide_index=True,
    width="content",
    column_config=TEXT_COLUMN_CONFIG,
    commit_edits=commit_fail,
)
_marker("fail-calls", str(st.session_state.fail_calls))
_state_marker("fail-editor-state", "fail_editor")


# ---------------------------------------------------------------------------
# 4. Dynamic num_rows: adding and deleting rows commits through the callback
#    and persists the new row count.
# ---------------------------------------------------------------------------
st.header("Dynamic commit")

if "orders_df" not in st.session_state:
    st.session_state.orders_df = pd.DataFrame({"order": ["o1", "o2"]})


def commit_orders(
    source_df: pd.DataFrame,
    edited_df: pd.DataFrame,
    edits: DataEditorState,
) -> pd.DataFrame:
    # Newly added rows arrive with null values. Rebuild a clean, null-free
    # string frame so the committed schema stays stable across adds and deletes
    # (a realistic write-back pattern that also satisfies the compatibility
    # checks).
    orders = [
        "new" if pd.isna(value) else str(value) for value in edited_df["order"].tolist()
    ]
    result = pd.DataFrame({"order": orders})
    st.session_state.orders_df = result
    return result


st.data_editor(
    st.session_state.orders_df,
    key="orders_editor",
    num_rows="dynamic",
    hide_index=True,
    width="content",
    column_config=ORDER_COLUMN_CONFIG,
    commit_edits=commit_orders,
)
_marker("orders-count", str(len(st.session_state.orders_df)))
_state_marker("orders-editor-state", "orders_editor")


# ---------------------------------------------------------------------------
# 5. Disable-in-flight: a deliberately slow callback so the test can observe
#    that the editor is disabled while the commit run is in flight and
#    re-enabled once it finishes.
# ---------------------------------------------------------------------------
st.header("Slow commit")

if "slow_df" not in st.session_state:
    st.session_state.slow_df = pd.DataFrame({"item": ["s1", "s2"]})


def commit_slow(
    source_df: pd.DataFrame,
    edited_df: pd.DataFrame,
    edits: DataEditorState,
) -> pd.DataFrame:
    time.sleep(1.5)
    # Return the edited frame directly (the most intuitive callback). A row
    # addition leaves the new cell null, which must still validate as
    # editing-compatible.
    st.session_state.slow_df = edited_df
    return edited_df


st.data_editor(
    st.session_state.slow_df,
    key="slow_editor",
    num_rows="dynamic",
    hide_index=True,
    width="content",
    column_config=TEXT_COLUMN_CONFIG,
    commit_edits=commit_slow,
)
_marker("slow-count", str(len(st.session_state.slow_df)))
_marker("slow-first-value", str(st.session_state.slow_df["item"].iloc[0]))


# ---------------------------------------------------------------------------
# 6. Fragment: a commit_edits editor inside a fragment must commit and
#    re-enable on fragment completion.
# ---------------------------------------------------------------------------
st.header("Fragment commit")

if "frag_df" not in st.session_state:
    st.session_state.frag_df = pd.DataFrame({"item": ["f1", "f2"]})


@st.fragment
def fragment_editor() -> None:
    def commit_frag(
        source_df: pd.DataFrame,
        edited_df: pd.DataFrame,
        edits: DataEditorState,
    ) -> pd.DataFrame:
        time.sleep(1.0)
        result = edited_df.reset_index(drop=True)
        st.session_state.frag_df = result
        return result

    st.data_editor(
        st.session_state.frag_df,
        key="frag_editor",
        num_rows="dynamic",
        hide_index=True,
        width="content",
        column_config=TEXT_COLUMN_CONFIG,
        commit_edits=commit_frag,
    )
    _marker("frag-first-value", str(st.session_state.frag_df.loc[0, "item"]))
    _marker("frag-count", str(len(st.session_state.frag_df)))


fragment_editor()
