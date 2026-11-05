---
author: lukasmasuch
created: 2026-08-06
---

# `commit_edits` callback for st.data_editor

## Summary

Add an optional `commit_edits` callback to `st.data_editor` that simplifies write-back with a
transactional commit mode: apps persist or reject a batch of edits in one place, then return the
new source for the current render. The callback receives the source dataframe, the edited
dataframe, and the public `DataEditorState` edit delta. Related edit-preservation improvements for
keyed, fixed-row editors already shipped in
[#15884](https://github.com/streamlit/streamlit/pull/15884).

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
- can reject or revert an edit batch without fragile post-hoc coordination; and
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
        [pd.DataFrame, pd.DataFrame, DataEditorState],
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
    edits: DataEditorState,
) -> pd.DataFrame: ...
```

- `source_df` is the normalized dataframe passed to `st.data_editor` before pending edits.
- `edited_df` is a copy with all pending edits already applied.
- `edits` is the already-public `DataEditorState` from `streamlit.typing` — the same concrete
  read-only object returned by `st.session_state[key]`:

  ```python
  from streamlit.typing import DataEditorState

  # DataEditorState(ReadOnlyAttributeDictionary):
  #   edited_rows: dict[int, dict[str, str | int | float | bool | list[str] | None]]
  #   added_rows: list[dict[str, str | int | float | bool | list[str] | None]]
  #   deleted_rows: list[int]

  edits.edited_rows == edits["edited_rows"]
  ```

- The callback returns the new source dataframe for the current render.

The object is read-only because Streamlit owns the pending edit lifecycle. App code can inspect it
with `edits.edited_rows` or `edits["edited_rows"]`, but clearing or replacing edits in place is not
a supported reset mechanism. Returning any dataframe from `commit_edits` (including the original
`source_df` to reject/revert) is the first-class way to clear pending state. Streamlit does not
special-case "return the original source"; a successful return always clears edits and displays the
returned frame.

`source_df` comes first because `edited_rows` and `deleted_rows` contain positions in the original
source. For example, a database callback needs `source_df.iloc[row_position]` to recover a primary
key for a deleted row.

The callback always receives and returns `pd.DataFrame`, even when the original input is another
supported type. On success, Streamlit converts the validated result back to the original input
format using the same path as today's `st.data_editor` return-type preservation (Pandas, Polars,
PyArrow, NumPy, lists/tuples/sets/dicts, and other dataframe-likes). Ordering and dedup semantics
for set/dict inputs follow that existing conversion; the first release does not add special
commit-time handling beyond what `st.data_editor` already does when converting edited frames back.

### User-visible behavior

| Situation | Behavior |
|-----------|----------|
| No pending edits | Do not call `commit_edits`; render `data` normally |
| Callback succeeds (returns a dataframe) | Validate the return value for editing compatibility **before** clearing pending edit state. On success: display the return value in the current render and clear pending edits. If validation raises `StreamlitAPIException`: preserve pending edits, display Streamlit's normal exception UI, and the `st.data_editor(...)` call returns the last committed baseline (`data` / `source_df`) — not the rejected callback result |
| Callback raises any exception | Preserve edit state and use Streamlit's normal exception handling; the `st.data_editor(...)` call returns the last committed baseline. No automatic retry control: the user must make another edit (or otherwise trigger an edit-driven rerun) to invoke `commit_edits` again |
| Callback calls `st.rerun()` or `st.stop()` | Preserve pending edit state (no successful return) and keep normal Streamlit control-flow behavior. Apps that persist externally before `st.rerun()`/`st.stop()` risk replaying the same batch; return the new dataframe instead of calling `st.rerun()` |

To reject without writing, return `source_df` (or another acceptable baseline) from `commit_edits` —
that is a successful return, so pending edits clear. Because the callback runs during the script
render (unlike fire-and-forget `on_change`), apps can already surface feedback with normal Streamlit
commands such as `st.toast` or `st.warning` before returning. Raising preserves pending edits but
currently uses the normal exception UI. A dedicated validation rejection path that preserves edits
*and* shows designed inline messaging on the editor (for example a
`StreamlitDataEditorValidationError`) is deferred; see Out of scope.

### Slow callbacks and in-flight edits

When `commit_edits` is configured, the editor becomes temporarily disabled as soon as it submits
an edit batch and remains disabled until the matching full-script or fragment rerun finishes. This
follows `st.chat_input(submit_mode="disable")`, including closing the brief window before the server
reports that the run has started. While disabled, the editor does not accept or queue additional
cell edits or row operations.

After the run, success clears the committed edits, while failures preserve them for correction
before the editor is re-enabled. This prevents overlapping user-driven commits, but does not
provide an exactly-once guarantee against unrelated reruns or concurrent external writers;
callbacks should still use atomic writes and conflict detection where needed.

### Persisting the callback result

The callback result is the baseline for the **current render only**. The app remains responsible for
persisting it to session state, a database, or an updated/invalidated cache. A later rerun with no
pending edits does not invoke the callback and uses whatever `data` evaluates to at that time.

### Example: database-backed editing with session state

```python
import pandas as pd
import streamlit as st

from streamlit.typing import DataEditorState

if "orders" not in st.session_state:
    st.session_state.orders = load_orders()


def persist_orders(
    source_df: pd.DataFrame,
    edited_df: pd.DataFrame,
    edits: DataEditorState,
) -> pd.DataFrame:
    # Reject without writing: returning source_df clears pending edits.
    # Surface feedback with normal Streamlit commands (toast, warning, …).
    # A follow-up may add a dedicated validation exception with designed
    # inline UI that preserves edits for correction.
    if (edited_df["amount"] < 0).any():
        st.toast("Amounts must be positive.", icon=":material/error:")
        return source_df

    # Commit the whole batch in one transaction. Streamlit preserves the full
    # edit batch when the callback raises, so the writes must be atomic: a
    # mid-batch failure must roll back completely, otherwise a later retry would
    # replay already-committed operations (duplicate inserts, repeated updates).
    with begin_transaction():
        for row_position in edits.deleted_rows:
            delete_order(source_df.iloc[row_position]["id"])

        for row_position, changes in edits.edited_rows.items():
            update_order(source_df.iloc[row_position]["id"], changes)

        for row in edits.added_rows:
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

### Example: database-backed editing with cached load

When `data` comes from `@st.cache_data`, clear only the affected cache entry after a successful
write and reload so later reruns (with no pending edits) see the new baseline instead of a stale
entry. A TTL still bounds how long an unchanged cache entry can live between commits.

```python
import pandas as pd
import streamlit as st

from streamlit.typing import DataEditorState


@st.cache_data(ttl="1h")
def load_orders(customer_id: str) -> pd.DataFrame:
    return fetch_orders_from_db(customer_id)


customer_id = st.selectbox("Customer", ["acme", "globex"])


def persist_orders(
    source_df: pd.DataFrame,
    edited_df: pd.DataFrame,
    edits: DataEditorState,
) -> pd.DataFrame:
    if (edited_df["amount"] < 0).any():
        st.toast("Amounts must be positive.", icon=":material/error:")
        return source_df

    with begin_transaction():
        for row_position in edits.deleted_rows:
            delete_order(source_df.iloc[row_position]["id"])

        for row_position, changes in edits.edited_rows.items():
            update_order(source_df.iloc[row_position]["id"], changes)

        for row in edits.added_rows:
            insert_order(row)

    # Clear only this customer_id entry, then refill. Other customers' cached
    # orders stay intact.
    load_orders.clear(customer_id)
    return load_orders(customer_id)


st.data_editor(
    load_orders(customer_id),
    key=f"orders_editor_{customer_id}",
    num_rows="dynamic",
    commit_edits=persist_orders,
)
```

Returning freshly loaded data allows the database to supply IDs, timestamps, and normalized values
in the same render that accepts the edit.

## Initial-release constraints

| Area | Initial behavior |
|------|------------------|
| `key` | Required. Raise `StreamlitAPIException` at call time when `commit_edits` is set without `key` (for example: `"st.data_editor: commit_edits requires a stable widget identity. Pass a key= argument so edit state can be preserved across reruns."`). Without a stable key, a successful commit that changes the dataframe can replace widget identity and discard the cleared edit state. |
| `num_rows` | Supported for `"fixed"`, `"add"`, `"delete"`, and `"dynamic"`. |
| `on_change` | Mutually exclusive with `commit_edits`. Raise `StreamlitAPIException` at call time when both are set (for example: `"st.data_editor: commit_edits cannot be combined with on_change. Use commit_edits alone for transactional write-back."`). `on_change` runs earlier and could change the positional baseline. |
| Forms | Not supported until ordering with `st.form_submit_button` is designed. Raise `StreamlitAPIException` at call time when `commit_edits` is used inside a form (for example: `"st.data_editor: commit_edits is not supported inside forms."`). |
| Fragments | Supported; callback execution and state clearing must work on fragment reruns. |
| `pandas.Styler` | Not supported because styles are derived before the callback may replace rows. Raise `StreamlitAPIException` at call time when `data` is a `Styler` and `commit_edits` is set (for example: `"st.data_editor: commit_edits does not support pandas.Styler input."`). |
| Callback result | Must be a pandas dataframe with an editing-compatible schema. Pending edits clear only after this validation succeeds. |
| Async callbacks | Not supported. |
| Commit granularity | All pending edits are delivered as one batch; success is all-or-nothing. Streamlit keeps the full batch on failure, so the callback must commit it atomically (e.g. one transaction) to keep retries safe. |
| Retry after failure | No dedicated retry control in the first release. After a preserved failure, the user must make another edit (or otherwise cause an edit-triggered rerun) to invoke `commit_edits` again. |
| User-facing validation rejection | Deferred. Initial release has no dedicated validation exception or designed inline error UI on the editor.

An editing-compatible result may change values, row count, and index values, but must preserve the
column order, index structure, Arrow field types/nullability, and parsing data kinds used by the
editor. Incompatible results raise `StreamlitAPIException` (edits preserved; see behavior table).

While edits are pending, `data` must remain the last committed baseline. Independently reordering
or replacing source rows is out of scope because edit metadata is positional and carries neither
original row identity nor a source version. Apps that need optimistic concurrency should keep a
version in the baseline and reject conflicts from `commit_edits`.

## Alternatives considered

### Option 1: Dedicated `commit_edits` callback ✅ Preferred

```python
st.data_editor(df, key="orders", commit_edits=persist_orders)
```

- Pros: Explicit commit boundary; typed `(source, edited, edits) -> DataFrame` contract; clear
  success/failure semantics for clearing vs preserving edit state; works for cell edits, adds, and
  deletes without inferring intent from the returned frame.
- Cons: New parameter on `st.data_editor`; mutually exclusive with `on_change` in the first release.

### Option 2: Infer commits from the returned dataframe / session-state assignment

Apps keep today's pattern: mutate session state or a database from the returned frame and hope the
next rerun lines up with cleared edit state.

- Pros: No new API.
- Cons: No first-class validation/rejection path; fragile for additions/deletions; easy to lose or
  replay edits. This is the status quo that [#7749](https://github.com/streamlit/streamlit/issues/7749)
  shows is insufficient. Listed as out of scope rather than a shipping alternative.

### Option 3: Extend `on_change` to accept/return dataframes

```python
st.data_editor(df, key="orders", on_change=persist_orders)
```

- Pros: Reuses an existing callback name.
- Cons: Overloads `on_change` (today fire-and-forget, no return value, no supplied edit args) into a
  transformation hook; would make `st.data_editor`'s `on_change` differ from every other widget;
  still needs new arguments (`source_df`, `edited_df`, `edits`). Rejected in favor of a distinct
  parameter, consistent with other non-`on_*` callable hooks such as `format_func`.

### Option 4: `on_commit` / other `on_*` names

- Pros: Matches the common `on_*` callback naming pattern.
- Cons: Suggests the same fire-and-forget interactivity model as `on_change` / `on_click`, which is
  misleading for a transformation that must return a dataframe. `commit_edits` names the action
  (commit) and the object (edits) without colliding with `on_change`.

## Out of scope

- Automatic commit detection for simple session-state assignment
- Reconciliation or merge UI for concurrent external data changes
- Schema-changing callback results
- Partial per-row success and per-cell error UI
- Native async callbacks or automatic retries
- Dedicated retry control after failures (user must edit again to re-invoke)
- Dedicated validation rejection UX (for example `StreamlitDataEditorValidationError` with
  designed inline messaging on the editor that preserves edits for correction). Needs design
  work; initial release rejects via returning a baseline or raising a normal exception.

## Checklist

<!--
Check the boxes or add a comment with the reason it cannot be checked.
-->

| Item | ✅ or comment |
|---|---|
| Works on SiS, Cloud, etc? | ✅ Uses existing widget, rerun, and Session State infrastructure with no platform-specific behavior |
| No breaking API changes | ✅ Additive optional parameter; `DataEditorState` is already public. Existing item access remains supported. In-place mutation of widget state is already unsupported because it cannot reliably synchronize the frontend. |
| No new dependencies | ✅ Reuses existing dataframe, callback, frontend, and protobuf infrastructure |
| Metrics collected | ✅ Track `commit_edits` parameter usage through existing `st.data_editor` metrics |
| Any security/legal impact? | ✅ No new privileges; callbacks execute app code, and unexpected errors retain standard redaction and logging behavior |
| Any docs changes needed? | ✅ Document `commit_edits`, including attribute/item access on `DataEditorState`, read-only semantics, persistence, and reject-by-return. Dedicated validation-exception UX is a follow-up. |
