---
author: lukasmasuch
created: 2026-05-13
---

# `commit_edits` callback for st.data_editor

## Status

This spec describes the next phase of the data-editor edit-preservation work.

- **Shipped in [#15884](https://github.com/streamlit/streamlit/pull/15884):** When `key` is set
  and `num_rows="fixed"`, source value changes no longer reset compatible pending edits. Edits are
  also removed once the source catches up to the edited value.
- **Proposed here:** Add an explicit `commit_edits` API for persistence, validation, row operations,
  and programmatic reset.

## Problem

Stable identity solves the common fixed-row round-trip problem, but it does not define when an
addition or deletion has been committed to the source. Today, database-backed and dynamic-row apps
must infer changes from the returned dataframe, update their source, and coordinate another rerun.
This is fragile and provides no first-class validation or rejection path.

This is the remaining gap behind [#7749](https://github.com/streamlit/streamlit/issues/7749) and
the programmatic reset/revert request in
[#6540](https://github.com/streamlit/streamlit/issues/6540).

Users need an explicit commit boundary that:

- works for cell edits, additions, and deletions;
- maps positional edit metadata back to the original source rows;
- can persist edits and return refreshed server data;
- can reject invalid edits without losing the user's work; and
- can clear accepted or reverted edits in both backend and frontend state.

## Proposal

Add an optional `commit_edits` callable to `st.data_editor`. It runs during the rerun caused by an
edit, after Streamlit has deserialized and applied the pending edit state.

```python
def data_editor(
    data: DataTypes,
    *,
    # Existing parameters...
    commit_edits: Callable[
        [pd.DataFrame, pd.DataFrame, DataEditorEditState],
        pd.DataFrame,
    ] | None = None,
) -> DataTypes:
```

Unlike `on_change`, `commit_edits` is a transformation/commit hook: Streamlit supplies arguments,
consumes the returned dataframe, and clears edit state on success.

### Callback contract

```python
def commit_edits(
    source_df: pd.DataFrame,
    edited_df: pd.DataFrame,
    edits: DataEditorEditState,
) -> pd.DataFrame: ...
```

- `source_df` is the normalized dataframe passed to `st.data_editor` before pending edits.
- `edited_df` is a copy with all pending edits already applied.
- `edits` is the normalized edit delta:

  ```python
  class DataEditorEditState(TypedDict):
      edited_rows: dict[int, dict[str, Any]]
      added_rows: list[dict[str, Any]]
      deleted_rows: list[int]
  ```

- The callback returns the new source dataframe for the current render.

Expose `DataEditorEditState` through the curated public typing namespace so users can annotate
callbacks and reusable helpers without importing from an internal implementation module:

```python
from streamlit.typing import DataEditorEditState
```

Keep the definition in the owning data-editor module and re-export the same object from
`streamlit.typing`, including it in `streamlit.typing.__all__`.

`source_df` comes first because `edited_rows` and `deleted_rows` contain positions in the original
source. For example, a database callback needs `source_df.iloc[row_position]` to recover a primary
key for a deleted row.

The callback always receives and returns `pd.DataFrame`, even when the original input is another
supported dataframe type. Streamlit converts the final result back to the original input format.
This keeps the callback contract uniform at the cost of a conversion when edits are present.

### User-visible behavior

| Situation | Behavior |
|-----------|----------|
| No pending edits | Do not call `commit_edits`; render `data` normally |
| Callback succeeds | Validate and display its return value in the current render; clear pending edit state |
| Callback returns the original source | Treat this as a revert; clear pending edits |
| Callback raises `DataEditorValidationError` | Display the safe error message inline, preserve edits for correction, and return `edited_df` |
| Callback raises any other exception | Preserve edit state and use Streamlit's normal exception handling |
| Callback calls `st.rerun()` or `st.stop()` | Preserve normal Streamlit control-flow behavior |

### Slow callbacks and in-flight edits

When `commit_edits` is configured, the editor becomes temporarily disabled as soon as it submits
an edit batch and remains disabled until the matching full-script or fragment rerun finishes. This
follows `st.chat_input(submit_mode="disable")`, including closing the brief window before the server
reports that the run has started. While disabled, the editor does not accept or queue additional
cell edits or row operations.

After the run, success clears the committed edits, while validation and other failures preserve
them for correction before the editor is re-enabled. This prevents overlapping user-driven
commits, but does not provide an exactly-once guarantee against unrelated reruns or concurrent
external writers; callbacks should still use atomic writes and conflict detection where needed.

### Persisting the callback result

The callback result is the baseline for the **current render only**. The app remains responsible for
persisting it to session state, a database, or an updated/invalidated cache. A later rerun with no
pending edits does not invoke the callback and uses whatever `data` evaluates to at that time.

Add `DataEditorValidationError` to `streamlit.errors` for expected, user-fixable validation
failures. Only this explicit exception is rendered inline; database, network, and other unexpected
exceptions must retain Streamlit's standard redaction, logging, and monitoring behavior.

### Example: database-backed editing

```python
from streamlit.errors import DataEditorValidationError

if "orders" not in st.session_state:
    st.session_state.orders = load_orders()


def persist_orders(source_df, edited_df, edits):
    if (edited_df["amount"] < 0).any():
        raise DataEditorValidationError("Amounts must be positive.")

    # Commit the whole batch in one transaction. Streamlit preserves the full
    # edit batch when the callback raises, so the writes must be atomic: a
    # mid-batch failure must roll back completely, otherwise a later retry would
    # replay already-committed operations (duplicate inserts, repeated updates).
    with begin_transaction():
        for row_position in edits["deleted_rows"]:
            delete_order(source_df.iloc[row_position]["id"])

        for row_position, changes in edits["edited_rows"].items():
            update_order(source_df.iloc[row_position]["id"], changes)

        for row in edits["added_rows"]:
            insert_order(row)

    refreshed_df = load_orders()
    st.session_state.orders = refreshed_df
    return refreshed_df


st.data_editor(
    st.session_state.orders,
    key="orders_editor",
    num_rows="dynamic",
    commit_edits=persist_orders,
)
```

Returning freshly loaded data allows the database to supply IDs, timestamps, and normalized values
in the same render that accepts the edit.

## Initial-release constraints

| Area | Initial behavior |
|------|------------------|
| `key` | Required. Stable identity is necessary to clear a commit without dropping the next edit. |
| `num_rows` | Supported for `"fixed"`, `"add"`, `"delete"`, and `"dynamic"`. |
| `on_change` | Mutually exclusive with `commit_edits`; its earlier execution could change the positional baseline. |
| Forms | Not supported until ordering with `st.form_submit_button` is designed. |
| Fragments | Supported; callback execution and state clearing must work on fragment reruns. |
| `pandas.Styler` | Not supported because styles are derived before the callback may replace rows. |
| Callback result | Must be a pandas dataframe with an editing-compatible schema. |
| Async callbacks | Not supported. |
| Commit granularity | All pending edits are delivered as one batch; success is all-or-nothing. Streamlit keeps the full batch on failure, so the callback must commit it atomically (e.g. one transaction) to keep retries safe. |

An editing-compatible result may change values, row count, and index values, but must preserve the
column order, index structure, Arrow field types/nullability, and parsing data kinds used by the
editor. Incompatible results raise `StreamlitAPIException`.

While edits are pending, `data` must remain the last committed baseline. Independently reordering
or replacing source rows is out of scope because edit metadata is positional and carries neither
original row identity nor a source version. Apps that need optimistic concurrency should keep a
version in the baseline and reject conflicts from `commit_edits`.

## Out of scope

- Automatic commit detection for simple session-state assignment
- Reconciliation or merge UI for concurrent external data changes
- Schema-changing callback results
- Partial per-row success and per-cell error UI
- Native async callbacks or automatic retries

## Checklist

<!--
Check the boxes or add a comment with the reason it cannot be checked.
-->

| Item | ✅ or comment |
|---|---|
| Works on SiS, Cloud, etc? | ✅ Uses existing widget, rerun, and Session State infrastructure with no platform-specific behavior |
| No breaking API changes | ✅ Additive optional parameter; omitting `commit_edits` preserves existing behavior |
| No new dependencies | ✅ Reuses existing dataframe, callback, frontend, and protobuf infrastructure |
| Metrics collected | ✅ Track `commit_edits` parameter usage through existing `st.data_editor` metrics |
| Any security/legal impact? | ✅ No new privileges; callbacks execute app code, and unexpected errors retain standard redaction and logging behavior |
| Any docs changes needed? | ✅ Document `commit_edits`, `DataEditorValidationError`, and `streamlit.typing.DataEditorEditState`, with persistence and validation examples |
