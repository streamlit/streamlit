---
author: lukasmasuch
created: 2026-03-26
---

# `st.column_config.ButtonColumn`

## Summary

Add a new column type `ButtonColumn` to `st.column_config` that renders clickable buttons
within `st.dataframe` cells, enabling row-level actions with Python callbacks.

## Problem

Users frequently need to perform actions on individual rows in a dataframe—editing records,
deleting items, triggering workflows, or navigating to details. Currently, the only
interactive column types are:

- `LinkColumn` for opening URLs (no server-side callback)
- Selection modes for bulk operations (not row-level actions)
- `st.data_editor` for inline editing (not action buttons)

Users resort to workarounds like:
- Placing separate `st.button` widgets next to each row (cumbersome, doesn't scale)
- Using `LinkColumn` with custom routing (no true callback support)
- Building custom components (high friction)

**Requests:**

- [#7015](https://github.com/streamlit/streamlit/issues/7015) - Buttons in dataframe/table
  cells with callbacks

**Use cases:**

- **Edit/Delete buttons**: Trigger modal dialogs or delete rows via callback
- **Row actions**: "Approve", "Reject", "Process" buttons for workflow apps
- **Navigation**: Open detail views for specific records
- **Multi-action menus**: Show a dropdown of actions (Edit, Delete, Archive) per row

## Proposal

### API

```python
st.column_config.ButtonColumn(
    label: str | None = None,
    *,
    width: ColumnWidth | None = None,
    help: str | None = None,
    pinned: bool | None = None,
    alignment: Literal["left", "center", "right"] | None = None,
    type: Literal["primary", "secondary", "tertiary"] = "secondary",
    on_click: WidgetCallback | None = None,
    args: WidgetArgs | None = None,
    kwargs: WidgetKwargs | None = None,
    key: Key | None = None,
)
```

Each ButtonColumn can have its own callback and session state key. No changes to
`st.dataframe` are required.

```python
st.dataframe(
    df,
    column_config={
        "view": st.column_config.ButtonColumn(
            "", type="tertiary", on_click=handle_view, key="view_click"
        ),
        "actions": st.column_config.ButtonColumn(
            "Actions", on_click=handle_action, key="action_click"
        ),
    },
)
```

### Parameters

| Parameter   | Type                                     | Default       | Description                                                            |
|-------------|------------------------------------------|---------------|------------------------------------------------------------------------|
| `label`     | `str \| None`                            | `None`        | Column header label. Uses column name if `None`.                       |
| `width`     | `"small" \| "medium" \| "large" \| int`  | `None`        | Column width.                                                          |
| `help`      | `str \| None`                            | `None`        | Tooltip on column header.                                              |
| `pinned`    | `bool \| None`                           | `None`        | Pin column to left side.                                               |
| `alignment` | `"left" \| "center" \| "right" \| None`  | `None`        | Horizontal alignment of button in cell. Defaults to center if `None`.  |
| `type`      | `"primary" \| "secondary" \| "tertiary"` | `"secondary"` | Button style variant.                                                  |
| `on_click`  | `WidgetCallback \| None`                 | `None`        | Optional callback invoked when a button is clicked.                    |
| `args`      | `WidgetArgs \| None`                     | `None`        | Positional arguments for the callback.                                 |
| `kwargs`    | `WidgetKwargs \| None`                   | `None`        | Keyword arguments for the callback.                                    |
| `key`       | `Key \| None`                            | `None`        | Session state key for click trigger value. Required for interactivity. |

**Note:** `key` is required to enable button clicks and callbacks. If `on_click`, `args`, or
`kwargs` are provided without `key`, an error is raised. If `key` is provided without `on_click`,
you can still check `st.session_state[key]` directly.

### Data Format

The underlying column data determines button labels:

- **String**: Single button with the string as label
- **List of strings**: Multiple buttons shown in a dropdown menu (via three-dot icon)
- **None/empty**: Empty cell (no button rendered)

**Material icon support:**

Button labels can include a leading Material icon using the `:material/icon_name:` syntax:

- `:material/delete: Delete` → Icon + text button
- `:material/edit:` → Icon-only button
- `View Details` → Text-only button

Icons are rendered using the Material Symbols font on canvas. In the dropdown menu for
multi-actions, icons render via standard markdown.

```python
import pandas as pd
import streamlit as st

df = pd.DataFrame({
    "name": ["Alice", "Bob", "Charlie"],
    "email": ["alice@example.com", "bob@example.com", "charlie@example.com"],
    # Single action button with icon
    "view": [":material/visibility: View", ":material/visibility: View", ":material/visibility: View"],
    # Multiple actions with icons shown in dropdown
    "actions": [
        [":material/edit: Edit", ":material/delete: Delete"],
        [":material/edit: Edit", ":material/delete: Delete", ":material/archive: Archive"],
        [":material/edit: Edit"],
    ],
})
```

### Click State

When a button is clicked, the click information is available in `st.session_state[key]`
as a **trigger value** (like `st.menu_button`). The value is only present during the
rerun triggered by the click; on subsequent reruns it resets to `None`:

```python
# During click-triggered rerun:
st.session_state.view_click  # {"row": 2, "label": ":material/visibility: View"}

# On subsequent reruns (no click):
st.session_state.view_click  # None
```

The click state is a dict with:
- `row`: Row index (integer position in original dataframe)
- `label`: Button label that was clicked (full string including any icon prefix)

### Behavior

**Single button (string cell value):**
- Renders a clickable button with the string as label
- Clicking triggers `on_click` callback (if provided) and rerun

**Multiple buttons (list of strings):**
- Renders a three-dot menu icon (`:material/more_vert:`)
- Clicking the icon opens a dropdown menu positioned at the click location
- Menu closes automatically when the user scrolls (to prevent misalignment)
- Selecting an action triggers `on_click` callback (if provided) and rerun

**Empty/None:**
- Cell is empty, no button rendered

**Button styles:**
- `"primary"`: Filled button with primary color background
- `"secondary"`: Outlined button (default)
- `"tertiary"`: Text-only button, minimal styling

**Read-only:**
- Button columns are always read-only in supported contexts
- `ButtonColumn` is not supported in `st.data_editor`

**CSV export:**
- Button columns are excluded from CSV export (toolbar download button)
- The underlying data (button labels) is not meaningful for export

### Example

**With callback:**

```python
import pandas as pd
import streamlit as st

df = pd.DataFrame({
    "id": [1, 2, 3],
    "name": ["Alice", "Bob", "Charlie"],
    "view": [":material/visibility: View"] * 3,
})

def handle_view():
    click = st.session_state.view_click
    st.toast(f"Viewing row {click['row']}: {df.iloc[click['row']]['name']}")

st.dataframe(
    df,
    column_config={
        "view": st.column_config.ButtonColumn(
            "", type="tertiary", on_click=handle_view, key="view_click"
        ),
    },
    hide_index=True,
)
```

**Without callback (key only):**

```python
import pandas as pd
import streamlit as st

df = pd.DataFrame({
    "id": [1, 2, 3],
    "name": ["Alice", "Bob", "Charlie"],
    "view": [":material/visibility: View"] * 3,
})

st.dataframe(
    df,
    column_config={
        "view": st.column_config.ButtonColumn("", type="tertiary", key="view_click"),
    },
    hide_index=True,
)

# Check session state directly
if st.session_state.get("view_click"):
    click = st.session_state.view_click
    st.toast(f"Viewing row {click['row']}: {df.iloc[click['row']]['name']}")
```

**Multi-action dropdown:**

```python
import pandas as pd
import streamlit as st

df = pd.DataFrame({
    "id": [1, 2, 3],
    "name": ["Alice", "Bob", "Charlie"],
    "actions": [
        [":material/edit: Edit", ":material/delete: Delete"],
        [":material/edit: Edit", ":material/delete: Delete", ":material/archive: Archive"],
        [":material/edit: Edit"],
    ],
})

def handle_action():
    click = st.session_state.action_click
    label = click["label"]
    row_id = df.iloc[click["row"]]["id"]
    if "Delete" in label:
        st.warning(f"Deleting record {row_id}")
    elif "Edit" in label:
        st.info(f"Editing record {row_id}")
    elif "Archive" in label:
        st.success(f"Archiving record {row_id}")

st.dataframe(
    df,
    column_config={
        "actions": st.column_config.ButtonColumn(
            "Actions", on_click=handle_action, key="action_click"
        ),
    },
)
```

**Multiple button columns:**

Each ButtonColumn has its own callback and key:

```python
import pandas as pd
import streamlit as st

df = pd.DataFrame({
    "id": [1, 2, 3],
    "name": ["Alice", "Bob", "Charlie"],
    "view": [":material/visibility:"] * 3,
    "edit": [":material/edit:"] * 3,
    "delete": [":material/delete:"] * 3,
})

def handle_view():
    st.info(f"Viewing record {df.iloc[st.session_state.view_click['row']]['id']}")

def handle_edit():
    st.info(f"Editing record {df.iloc[st.session_state.edit_click['row']]['id']}")

def handle_delete():
    st.warning(f"Deleting record {df.iloc[st.session_state.delete_click['row']]['id']}")

st.dataframe(
    df,
    column_config={
        "view": st.column_config.ButtonColumn("", type="tertiary", on_click=handle_view, key="view_click"),
        "edit": st.column_config.ButtonColumn("", type="tertiary", on_click=handle_edit, key="edit_click"),
        "delete": st.column_config.ButtonColumn("", type="tertiary", on_click=handle_delete, key="delete_click"),
    },
    hide_index=True,
)
```

### Interaction with Other Features

**Selection modes:** Button clicks are independent of row/cell selection. Both can be used
together—selecting rows for bulk operations while buttons handle individual actions.

**st.data_editor:** Not supported. ButtonColumn is read-only and only works with
`st.dataframe`. This is intentional—`st.data_editor` is for editing data, not triggering
actions.

**Sorting:** Row indices in click state refer to the original dataframe positions, not the
visually sorted order. This matches the behavior of selection state.

## Alternatives Considered

### Alternative 1: ButtonColumn with parameter-defined labels

Instead of requiring button labels in the dataframe data, define them via a ButtonColumn
parameter. The column would be auto-generated without needing a corresponding data column:

```python
# No "actions" column needed in df - labels come from the `options` parameter
st.dataframe(
    df,
    column_config={
        "actions": st.column_config.ButtonColumn(
            "Actions",
            options=[":material/edit: Edit", ":material/delete: Delete"],
            on_click=handle_action,
            key="action_click",
        ),
    },
)
```

**Pros:**
- Simpler for the common case where all rows have the same actions
- No need to add a synthetic column to the dataframe just for buttons
- Cleaner mental model: buttons aren't really "data"
- Easier to add action columns to existing dataframes without modifying them

**Cons:**
- **Breaks column_config pattern**: All other column types configure *existing* columns.
  This would be the only column type that creates columns from nothing.
- **No per-row customization**: All rows get identical buttons. The current approach
  supports different actions per row (e.g., "Archive" only for active items).
- **Inconsistent with LinkColumn**: LinkColumn also requires data (URLs) in the column.
  Having ButtonColumn work differently would be surprising.
- **Frontend complexity**: Would require special handling to generate "virtual" cells
  that don't exist in the data. Currently, column_config only transforms existing data.
- **Ambiguous column position**: Where does a virtual column appear? Would need
  additional parameters or conventions.
- **Data/UI boundary blur**: Mixing virtual columns with real data columns could
  confuse users about what's actually in their dataframe.

**Rejected because:**
The inconsistency with how all other column types work outweighs the convenience benefit.
The current data-driven approach is more flexible (per-row actions) and aligns with
Streamlit's principle that the dataframe *is* the source of truth. Users can easily add
a column with repeated values: `df["actions"] = [["Edit", "Delete"]] * len(df)`.

### Alternative 2: Top-level `row_actions` parameter on st.dataframe

Add row actions as a top-level feature of `st.dataframe` rather than a column type:

```python
st.dataframe(
    df,
    row_actions=[":material/edit: Edit", ":material/delete: Delete"],
    on_row_action=handle_action,  # or "ignore" | "rerun"
    key="my_table",
)

# When clicked, returns trigger value and stores in session state if key provided
# st.session_state.my_table -> {"row": 2, "action": ":material/edit: Edit"}
```

When `on_row_action` is set to `"rerun"` or a callback, clicking an action returns a
trigger value with the row index and action label. If a `key` is provided, the click
state is also stored in `st.session_state[key]`. This mode is mutually exclusive with
`selection_mode`—row actions and selections cannot be used together.

**Pros:**
- Very simple API for the most common use case (uniform row actions)
- Clear semantic: these are "row actions", not data columns
- Avoids column_config complexity for simple scenarios
- Consistent with `selection_mode` being a top-level parameter
- Could render as a dedicated actions column or inline action icons

**Cons:**
- **One-size-fits-all**: Only one set of actions for the entire table. No per-row
  variation (e.g., different actions for different row states).
- **Single callback**: Must dispatch on label string to determine which action was
  clicked. Multiple button columns allow distinct callbacks per action type.
- **Limited to one actions column**: Can't have separate "View", "Edit", "Delete"
  columns with different styling (tertiary icons vs primary buttons).
- **API surface growth**: New top-level parameters add complexity to `st.dataframe`.
- **Ambiguous rendering**: Where does the actions column appear? What's its header?
  How wide is it? These questions need more parameters or opinionated defaults.
- **Mutually exclusive with selections**: Users who need both row actions and row
  selection would be blocked. The column_config approach allows both simultaneously.

**Rejected because:**
The column_config approach (current implementation) is more composable and consistent
with Streamlit's existing patterns. Users who want simple uniform actions can achieve
it with minimal code (`df["actions"] = ["Edit"] * len(df)`), while power users get
full flexibility with per-row actions, multiple button columns, and distinct callbacks.
The top-level parameter would optimize for the simple case at the cost of extensibility.

## Out of Scope (Future Work)

- **Trailing icons**: Only leading icons are supported; trailing icons could be added later
- **Confirmation dialogs**: Built-in "Are you sure?" prompts before destructive actions
- **Disabled buttons**: Per-cell disabled state based on data
- **Custom button colors**: Beyond the three type variants
- **Button in st.data_editor**: Focus on st.dataframe first

## Checklist

| Item                       | ✅ or comment                                                  |
|----------------------------|----------------------------------------------------------------|
| Works on SiS, Cloud, etc?  | ✅ Uses standard widget callback pattern                       |
| No breaking API changes    | ✅ New parameters are additive                                  |
| No new dependencies        | ✅ Custom cell rendering in existing framework                  |
| Metrics collected          | ✅ `column_config.ButtonColumn` via gather_metrics              |
| Any security/legal impact? | ✅ Callbacks execute user code; same as existing widget pattern |
| Any docs changes needed?   | ✅ Document new column type and on_click parameter              |
