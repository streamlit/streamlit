---
author: lukasmasuch
created: 2026-03-18
---

# `required` parameter for `st.pills` and `st.segmented_control`

## Summary

Add a `required: bool = False` parameter to `st.pills` and `st.segmented_control` that prevents
deselection in single-select mode. This enables using these widgets as styled alternatives to
`st.radio` where a selection is always required.

## Problem

Currently, `st.pills` and `st.segmented_control` in single-select mode allow users to deselect
the currently selected option by clicking it again. This behavior differs from `st.radio`, which
always requires a selection. Many users want to use these widgets as "prettier radio buttons" but
need to ensure a value is always selected.

**Requests:**

- [#9870](https://github.com/streamlit/streamlit/issues/9870) — Segmented control with a required
  value (25+ upvotes)

**Use cases:**

- Navigation controls where a section must always be active
- Filter controls where a filter type must always be selected
- Mode selectors (e.g., view mode: list/grid/map) that require a valid state
- Replacing radio buttons with a more compact, modern UI

**Current workarounds:**

Users currently work around this with `on_change` callbacks that restore the previous selection:

```python
def prevent_deselection():
    if st.session_state.my_key is None:
        st.session_state.my_key = st.session_state.get("_prev_value", default)
    st.session_state["_prev_value"] = st.session_state.my_key

selection = st.segmented_control(
    "Mode", options, key="my_key", on_change=prevent_deselection
)
```

This causes a visible flicker when the user attempts to deselect, making for a poor UX.

## Proposal

### API

Add `required` parameter to both `st.pills` and `st.segmented_control`:

```python
st.pills(
    label: str,
    options: OptionSequence[V],
    *,
    selection_mode: Literal["single", "multi"] = "single",
    default: V | None = None,
    required: bool = False,  # NEW
    ...
) -> V | None  # or V when required=True and default is set

st.segmented_control(
    label: str,
    options: OptionSequence[V],
    *,
    selection_mode: Literal["single", "multi"] = "single",
    default: V | None = None,
    required: bool = False,  # NEW
    ...
) -> V | None  # or V when required=True and default is set
```

### Parameters

| Parameter  | Type   | Default | Description                                                                                                            |
| ---------- | ------ | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `required` | `bool` | `False` | When `True` and `selection_mode="single"`, prevents deselection. The user can change selections but cannot clear them. |

### Behavior

**When `required=False` (default, current behavior):**

- Clicking a selected option deselects it
- Widget can return `None` in single-select mode

**When `required=True` and `selection_mode="single"`:**

- Clicking an already-selected option does nothing (no deselection)
- Once a selection is made, the widget always returns a value
- Initial state depends on `default`:
  - If `default` is set: widget starts with that value selected; return type is `V`
  - If `default=None`: widget starts with no selection (`None`), but once the user selects an
    option, they cannot deselect it; return type is `V | None`

**When `required=True` and `selection_mode="multi"`:**

- Raises `StreamlitAPIException` — the combination is not supported
- Multi-select already returns `list[V]` (empty list when nothing selected), and "required"
  semantics are ambiguous (require at least one? require all?)

```python
# Raises StreamlitAPIException
st.pills("Tags", ["A", "B", "C"], selection_mode="multi", required=True)
```

### Return Type Narrowing

Use `@overload` to narrow the return type when `required=True` and `default` is provided:

```python
# required=True with default set -> guaranteed non-None return
@overload
def pills(
    ...,
    selection_mode: Literal["single"] = "single",
    default: V,
    required: Literal[True],
    ...
) -> V: ...

# required=True without default -> can still be None initially
@overload
def pills(
    ...,
    selection_mode: Literal["single"] = "single",
    default: None = None,
    required: Literal[True],
    ...
) -> V | None: ...

# required=False (default) -> existing behavior
@overload
def pills(
    ...,
    selection_mode: Literal["single"] = "single",
    default: V | None = None,
    required: Literal[False] = False,
    ...
) -> V | None: ...
```

This allows typed codebases to benefit from the guarantee:

```python
# Type: str (not str | None)
mode = st.segmented_control(
    "Mode", ["View", "Edit", "Admin"],
    default="View",
    required=True,
)
# No need for None check before using `mode`
```

### Examples

**Basic required selection:**

```python
import streamlit as st

mode = st.segmented_control(
    "Display mode",
    ["List", "Grid", "Map"],
    default="List",
    required=True,
)
st.write(f"Current mode: {mode}")  # Always has a value
```

**Required without default (must select, then locked):**

```python
import streamlit as st

direction = st.pills(
    "Select direction",
    ["North", "East", "South", "West"],
    required=True,  # No default
)

if direction is None:
    st.info("Please select a direction to continue")
else:
    st.write(f"Heading: {direction}")  # Cannot be cleared once set
```

**Comparison with radio behavior:**

```python
import streamlit as st

# These behave similarly:
st.radio("Pick one", ["A", "B", "C"])
st.segmented_control("Pick one", ["A", "B", "C"], default="A", required=True)
st.pills("Pick one", ["A", "B", "C"], default="A", required=True)
```

### Implementation Notes

**Frontend changes:**

- Pass `required` flag to the ButtonGroup proto
- When `required=True` and `selection_mode="single"`, ignore click events on the currently
  selected button (don't send deselection to backend)

**Backend changes:**

- Add `required: bool = False` parameter to both `pills()` and `segmented_control()`
- Add type overloads for return type narrowing
- Raise `StreamlitAPIException` if `required=True` and `selection_mode="multi"`

## Out of Scope (Future Work)

- **`clearable` parameter for `st.selectbox`:** Related issue
  [#7165](https://github.com/streamlit/streamlit/issues/7165) proposes adding explicit clear
  functionality to selectbox. While conceptually related (clearable is the inverse of required),
  selectbox has different UX patterns (clear button vs. click-to-deselect) that warrant separate
  consideration.

- **`required` for multi-select:** Semantics are unclear (require at least one? require N
  selections?). If needed, could be a future `min_selections` parameter.

- **Form validation integration:** A broader `required` concept that shows validation errors and
  prevents form submission. This would be a larger feature across all form widgets.

## Checklist

| Item                       | ✅ or comment                                 |
| -------------------------- | -------------------------------------------- |
| Works on SiS, Cloud, etc?  | ✅                                           |
| No breaking API changes    | ✅ New optional parameter, default preserves current behavior |
| No new dependencies        | ✅                                           |
| Metrics collected          | ✅                                           |
| Any security/legal impact? | ✅ None                                      |
| Any docs changes needed?   | ✅ Document new parameter                    |
