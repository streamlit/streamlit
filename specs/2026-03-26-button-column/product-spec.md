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

- [#5765](https://github.com/streamlit/streamlit/issues/5765) - Add button column type
  (100+ upvotes)
- [#6343](https://github.com/streamlit/streamlit/issues/6343) - Row actions in dataframe

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
    type: Literal["primary", "secondary", "tertiary"] = "secondary",
    on_click: WidgetCallback | None = None,
    args: WidgetArgs | None = None,
    kwargs: WidgetKwargs | None = None,
    key: str | None = None,
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

| Parameter  | Type                                     | Default       | Description                                                            |
|------------|------------------------------------------|---------------|------------------------------------------------------------------------|
| `label`    | `str \| None`                            | `None`        | Column header label. Uses column name if `None`.                       |
| `width`    | `"small" \| "medium" \| "large" \| int`  | `None`        | Column width.                                                          |
| `help`     | `str \| None`                            | `None`        | Tooltip on column header.                                              |
| `pinned`   | `bool \| None`                           | `None`        | Pin column to left side.                                               |
| `type`     | `"primary" \| "secondary" \| "tertiary"` | `"secondary"` | Button style variant.                                                  |
| `on_click` | `WidgetCallback \| None`                 | `None`        | Optional callback invoked when a button is clicked.                    |
| `args`     | `WidgetArgs \| None`                     | `None`        | Positional arguments for the callback.                                 |
| `kwargs`   | `WidgetKwargs \| None`                   | `None`        | Keyword arguments for the callback.                                    |
| `key`      | `str \| None`                            | `None`        | Session state key for click trigger value. Required for interactivity. |

**Note:** `key` is required to enable button clicks. `on_click` is optional - if omitted, you can
still check `st.session_state[key]` directly.

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
st.session_state.view_click  # {"row": 2, "label": ":material/visibility:"}

# On subsequent reruns (no click):
st.session_state.view_click  # None
```

The click state is a dict with:
- `row`: Row index (integer position in original dataframe)
- `label`: Button label that was clicked (full label including any icon prefix)

### Behavior

**Single button (string cell value):**
- Renders a clickable button with the string as label
- Clicking triggers `on_click` callback (if provided) and rerun

**Multiple buttons (list of strings):**
- Renders a three-dot menu icon (`:material/more_vert:`)
- Clicking the icon opens a dropdown menu (same style as `st.menu_button`)
- Selecting an action triggers `on_click` callback (if provided) and rerun

**Empty/None:**
- Cell is empty, no button rendered

**Button styles:**
- `"primary"`: Filled button with primary color background
- `"secondary"`: Outlined button (default)
- `"tertiary"`: Text-only button, minimal styling

**Read-only:**
- Button columns are always read-only, even in `st.data_editor`
- The `disabled` config option is ignored; buttons are never editable

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
| Any security/legal impact? | ⚠️ Callbacks execute user code; same as existing widget pattern |
| Any docs changes needed?   | ✅ Document new column type and on_click parameter              |
