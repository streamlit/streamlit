---
author: mayagbarnes
created: 2026-08-10
---

# `st.filter_bar` — DataFrame filter widget

## Summary

Add a new `st.filter_bar` widget that provides a composable, type-aware filter UI for
DataFrames. The widget auto-infers appropriate filter types from column dtypes, renders
dismissible filter chips for active filters, and returns a filtered DataFrame. No table
display is required — it is a standalone widget that users compose with `st.dataframe`,
charts, or any downstream element.

```python
filtered_df = st.filter_bar(df)
st.dataframe(filtered_df)

# With label and help tooltip:
filtered_df = st.filter_bar(df, label="Filter results", help="Narrow down the dataset")
```

## Problem

Filtering is the most common interaction pattern for data apps, yet Streamlit provides no
built-in way to do it. Developers must manually compose multiple widgets (`st.selectbox`,
`st.slider`, `st.date_input`) and wire them together with filtering logic — a pattern that
is verbose, error-prone, and inconsistent across apps.

**Requests:**

- [#6272](https://github.com/streamlit/streamlit/issues/6272) — Add capability to filter
  columns in `st.data_editor` via UI (63 upvotes) — Excel-like column header filters;
  addressed long-term by `st.dataframe` integration (Out of Scope)
- [#1879](https://github.com/streamlit/streamlit/issues/1879) — Add filter functionality to
  dataframes (33 upvotes) — oldest filtering request; inline search/filter on displayed
  DataFrames
- [#12396](https://github.com/streamlit/streamlit/issues/12396) — `st.filter_bar` widget to
  filter dataframes (21 upvotes) — the direct request for this widget
- [#10156](https://github.com/streamlit/streamlit/issues/10156) — Make dataframe search
  filter rows instead of jumping to match (11 upvotes) — search-as-filter behavior
- [#12395](https://github.com/streamlit/streamlit/issues/12395) — Easier cross-filtering
  between charts/dataframes (8 upvotes)
- [#13066](https://github.com/streamlit/streamlit/issues/13066) — Add interactive filtering
  and sorting to vega-based charts (3 upvotes) — addressed by filter_bar composability
  (filter_bar drives chart downstream)
- Related: the [dataframe lazy-load spec](../2026-05-07-dataframe-lazy-load/product-spec.md)
  explicitly defers filtering to future work

**Use cases:**

- Data exploration dashboards ("show me sales in Q3 where region is APAC")
- Admin panels with tabular data and user-driven filters
- Log viewers filtering by severity, timestamp, service
- Any app where users need to narrow down a DataFrame before visualizing or exporting

**Current workarounds:**

```python
# Manual filter composition — repeated per column, per app
col1, col2, col3 = st.columns(3)

with col1:
    status = st.multiselect("Status", df["status"].unique())
with col2:
    min_date, max_date = st.date_input("Date range", value=(df["date"].min(), df["date"].max()))
with col3:
    min_price = st.number_input("Min price", value=0.0)

mask = pd.Series(True, index=df.index)
if status:
    mask &= df["status"].isin(status)
mask &= df["date"].between(min_date, max_date)
mask &= df["price"] >= min_price

filtered = df[mask]
st.dataframe(filtered)
```

This pattern requires ~15-20 lines per dashboard, doesn't scale to wide DataFrames, and
forces developers to manually handle dtype-specific filter logic that could be inferred.

## Proposal

### API

```python
st.filter_bar(
    data: DataFrameLike,
    *,
    columns: Sequence[str] | Mapping[str, FilterConfig | None] | None = None,
    label: str | None = None,
    help: str | None = None,
    placeholder: str | None = None,
    expanded: bool = True,
    key: Key | None = None,
    on_change: WidgetCallback | None = None,
    args: WidgetArgs | None = None,
    kwargs: WidgetKwargs | None = None,
    disabled: bool | Sequence[str] = False,
    label_visibility: LabelVisibility = "visible",
    width: WidthWithoutContent = "stretch",
    bind: BindOption = None,
) -> DataFrameLike
```

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `data` | `DataFrameLike` | required | The source DataFrame to filter. Accepts pandas, Polars, PyArrow, or any object convertible via Streamlit's data-frame protocol. |
| `columns` | `Sequence[str] \| Mapping[str, FilterConfig \| None] \| None` | `None` | Controls which columns are filterable. `None`: auto-include all eligible columns. `Sequence[str]`: include only the named columns (filter type auto-inferred). `Mapping`: keys are column names, values are `FilterConfig` for explicit control or `None` to exclude. Column names not present in the input DataFrame trigger a `StreamlitAPIException` (unlike `st.dataframe`'s `column_order` which silently ignores missing names). |
| `label` | `str \| None` | `None` | A short label displayed above the filter bar explaining its purpose (e.g., "Filter results"). Supports GitHub-flavored Markdown (bold, italics, inline code, links, images). If `None`, no label is displayed. |
| `help` | `str \| None` | `None` | A tooltip displayed next to the widget label. Streamlit only displays the tooltip when `label_visibility="visible"`. If `None` (default), no tooltip is displayed. Supports GitHub-flavored Markdown. |
| `placeholder` | `str \| None` | `None` | Custom text for the "Add filter" button. If `None`, defaults to "Add filter". Useful for guiding users toward specific columns: e.g., `"Filter by status, date, or region..."`. |
| `expanded` | `bool` | `True` | If `True` (default), the filter bar renders fully with active chips and the "Add filter" button visible. If `False`, the filter bar collapses to a compact trigger button showing the active filter count (e.g., "Filters (3)") that expands on click. This controls the initial render state; the user can toggle at runtime. Note: unlike `st.expander` (which defaults to `False`), the filter bar defaults to expanded because showing the filter controls is the widget's primary purpose. |
| `key` | `str \| int \| None` | `None` | Unique widget key. The filter state is stored in `st.session_state[key]`. |
| `on_change` | `Callable \| None` | `None` | Callback invoked when filters change. |
| `args` | `list \| tuple \| None` | `None` | Positional args for the callback. |
| `kwargs` | `dict \| None` | `None` | Keyword args for the callback. |
| `disabled` | `bool \| Sequence[str]` | `False` | If `True`, disables the entire widget (all filters visible but not interactive). If a `Sequence[str]` of column names, only those columns' filters are locked (cannot be added, modified, or removed) while other columns remain interactive. Useful for BI dashboards with admin-controlled base filters. |
| `label_visibility` | `"visible" \| "hidden" \| "collapsed"` | `"visible"` | The visibility of the label. `"visible"` (default): label is shown. `"hidden"`: label is not displayed but Streamlit reserves an empty spacer to keep the widget aligned with other widgets. `"collapsed"`: no label or spacer is displayed. Only applies when `label` is set. |
| `width` | `"stretch" \| int` | `"stretch"` | Width of the filter bar. `"stretch"` fills the container width. An `int` value sets a fixed pixel width. |
| `bind` | `Literal["query-params"] \| None` | `None` | If `"query-params"`, the active filter state is persisted in the URL query string. This enables shareable filtered dashboard links (e.g., `?filter=status:active&filter=price:<30`). Changes to the URL update the filter state; changes to filters update the URL. Follows the same `bind` pattern as `st.multiselect` and other widgets. |

### Return Value

| Condition | Return Value |
|---|---|
| No filters active | The original DataFrame (unmodified reference) |
| Filters active | A filtered copy of the input DataFrame with only matching rows |

**Type preservation:** The return type matches the input type. If the user passes a Polars
DataFrame, they get a Polars DataFrame back. If they pass pandas, they get pandas. This
matches `st.data_editor` behavior. Internally, filtering operates on a pandas
representation (via the existing `convert_anything_to_pandas_df` → operate →
`convert_pandas_df_to_data_format` pattern from `st.data_editor`).

The widget applies all active filters with AND logic between columns. Within a single
multiselect filter (e.g., `status in ["active", "pending"]`), OR logic applies.

### Filter Type Inference

When no explicit `FilterConfig` is provided, the widget infers filter types from column
dtypes using the same `ColumnDataKind` system that powers `st.dataframe`:

| Column Data Kind | Filter Type | UI |
|---|---|---|
| `STRING` (≤ 100 unique values) | Multiselect | Searchable checklist of values |
| `STRING` (> 100 unique values) | Text search | Text input with contains/equals operators |
| `BOOLEAN` | Toggle | True / False / All |
| `INTEGER`, `FLOAT`, `DECIMAL` | Range | Min/max inputs (or slider for bounded ranges) |
| `DATE` | Date range | Date picker with before/after/between |
| `DATETIME` | Datetime range | Datetime picker with before/after/between |
| `TIME` | Time range | Time picker with before/after/between |
| `LIST`, `DICT`, `BYTES`, `COMPLEX` | Excluded | Not filterable by default |

The cardinality threshold (100) for string columns switching from multiselect to text
search is an implementation detail that may be tuned.

**Additional inference rules:**

- `TIMEDELTA`, `PERIOD`, `INTERVAL` — excluded (no natural filter UI)
- `EMPTY`, `UNKNOWN` — excluded
- Categorical columns (`pd.CategoricalDtype`) — always multiselect regardless of
  cardinality, since the category set is explicitly bounded by the dtype
- Columns with all null values — excluded from auto-inference (can be forced via
  `columns` parameter with explicit `FilterConfig`)

### Filter Type Inference — Implementation Strategy

Filter type inference runs **Python-side**, reusing the existing column type infrastructure
from `st.dataframe` / `st.data_editor`. The frontend receives pre-resolved filter metadata
via proto and only renders the appropriate filter UI — it does not re-infer types.

**Reuse from existing infrastructure:**

| What | Location | How filter_bar uses it |
|---|---|---|
| `ColumnDataKind` enum | `elements/lib/column_config_utils.py` | The source-of-truth type classification. Imported directly. |
| `determine_dataframe_schema()` | `elements/lib/column_config_utils.py` | Called on the input DataFrame to get `dict[str, ColumnDataKind]` per column. Handles the full inference chain: Arrow type → pandas dtype → inferred type. |
| `process_config_mapping()` pattern | `elements/arrow.py` | Pattern for merging user-provided `FilterConfig` with auto-inferred defaults. |
| Categorical detection | `determine_dataframe_schema()` internals | Already special-cases `CategoricalDtype` by inferring from the category values themselves. |

**New logic filter_bar must add:**

1. **`ColumnDataKind → FilterType` mapping** — a static dict mapping each data kind to its
   default filter type (multiselect, text, range, date_range, etc.). Does not exist in the
   codebase today.

2. **Cardinality check** — `column.nunique() <= threshold` to decide multiselect vs. text
   search for string columns. No direct precedent in the column config system (the closest
   is `built_in_chart_utils.py` which uses a similar threshold for chart overflow detection).

3. **Filter metadata proto** — the resolved filter type + column metadata (available
   operators, options list for multiselect, min/max bounds for range) sent to the frontend
   per column. The frontend is a pure renderer of this metadata.

**Inference flow:**

```
Input DataFrame
    │
    ▼
determine_dataframe_schema(data_df, arrow_schema)
    │
    ▼
dict[str, ColumnDataKind]  (per-column type classification — cheap, runs eagerly)
    │
    ▼
Send column list + type icons to frontend (column picker is immediately usable)
    │
    ▼  (on user selecting a column from the picker)
_FILTER_TYPE_MAPPING[kind]  (NEW: maps kind → filter type)
    │
    ├── STRING? → nunique() check → "multiselect" or "text"  (lazy, computed on demand)
    ├── Categorical? → always "multiselect"
    └── Others → direct mapping (range, date_range, toggle, etc.)
    │
    ▼
Merge with user-provided FilterConfig (overrides auto-inferred)
    │
    ▼
Send resolved filter metadata for selected column to frontend via proto
```

**Why Python-side (not frontend):**

- Filter_bar applies filters in Python and returns a filtered DataFrame — the backend
  must understand column types to execute filter operations
- The cardinality check (`nunique()`) requires access to the actual column data
- `determine_dataframe_schema()` already exists and returns exactly what's needed
- Matches `st.data_editor` architecture (Python-side inference, frontend renders)
- Avoids duplicating type inference logic across Python and TypeScript

### Operators Per Filter Type

Each filter type supports a set of operators. The first operator listed is the default.
All filter types additionally support `is null` and `is not null` for explicit null
filtering.

| Filter Type | Operators |
|---|---|
| Multiselect | is (multiselect from values), is not, is null, is not null |
| Text search | contains, equals, starts with, ends with, is null, is not null |
| Toggle | is true, is false, is null |
| Range | between, equals, greater than, less than, is null, is not null |
| Date/time range | between, before, after, equals, is null, is not null |

### FilterConfig

For explicit control over individual columns:

```python
from streamlit import FilterConfig

st.filter_bar(df, columns={
    "status": FilterConfig(type="multiselect", options=["active", "inactive"]),
    "price": FilterConfig(type="range", min_value=0, max_value=1000),
    "created_at": FilterConfig(type="date_range"),
    "internal_id": None,  # excluded
})
```

`FilterConfig` fields:

| Field | Type | Default | Description |
|---|---|---|---|
| `type` | `Literal["multiselect", "text", "range", "date_range", "datetime_range", "time_range", "toggle"] \| None` | `None` | Override the auto-inferred filter type. `None` uses auto-inference. |
| `label` | `str \| None` | `None` | Custom display label for the filter chip. Defaults to the column name. |
| `options` | `Sequence[Any] \| None` | `None` | Explicit set of selectable values for multiselect filters. If `None`, values are derived from the column data. |
| `min_value` | `int \| float \| None` | `None` | Minimum bound for range filters. If `None`, derived from column data. |
| `max_value` | `int \| float \| None` | `None` | Maximum bound for range filters. If `None`, derived from column data. |
| `operators` | `Sequence[str] \| None` | `None` | Restrict available operators to a subset of the defaults for that filter type. If `None`, all operators for the type are available. |

All fields are optional. An empty `FilterConfig()` is equivalent to auto-inference for
that column (useful for the mapping form where you want to include a column without
customization: `{"status": FilterConfig(), "secret_id": None}`).

### Behavior

**Label and help:**

When `label` is provided, it renders above the filter bar following standard Streamlit
widget label conventions (supports limited Markdown). The `help` tooltip is displayed
next to the label only when `label_visibility="visible"`. When `label_visibility="hidden"`,
the label text is used as an `aria-label` for accessibility but no visual label or tooltip
is shown. If no `label` is provided, `help` and `label_visibility` have no effect.

**Visual layout — expanded state (default):**

```
Filter results ⓘ                              (label + help tooltip)
[ + Add filter ]

# After adding filters:
Filter results ⓘ
[ Status: Active, Pending  ×]  [ Price: < $30  ×]  [ + Add filter ]
```

**Visual layout — collapsed state (`expanded=False`):**

```
Filter results ⓘ
[ ▸ Filters (2) ]                             (compact trigger button)
```

When the user clicks the compact trigger, the bar expands to reveal the chips and
"Add filter" button. The collapsed/expanded state is user-toggleable at runtime; the
`expanded` parameter controls only the initial render state.

**Chip behavior:**

- Active filters are displayed as dismissible chips/pills
- Each chip shows `Column: Value` (or `Column: Operator Value` for non-default operators)
- Clicking `×` removes that filter
- Clicking a chip opens its edit popover
- The `+ Add filter` button opens a column picker dropdown

**Adding a filter:**

1. User clicks `+ Add filter`
2. A dropdown shows all filterable columns (with type icons)
3. User selects a column
4. A popover appears with the appropriate filter UI for that column's type
5. User configures the filter and it becomes an active chip

**Editing a filter:**

1. User clicks an existing filter chip
2. The edit popover opens with the current filter configuration
3. User modifies the value/operator
4. Changes apply immediately (triggers rerun)

**Removing a filter:**

- Click the `×` on a chip, or
- Click "Clear all" (shown when 2+ filters are active), or
- Delete from within the edit popover

**State management:**

- The widget is stateful: active filters persist across reruns
- Filter state is stored in `st.session_state[key]` as a list of filter descriptors:
  ```python
  # Shape of st.session_state[key]:
  [
      {"column": "status", "operator": "is", "value": ["active", "pending"]},
      {"column": "price", "operator": "less_than", "value": 30.0},
  ]
  ```
- The expanded/collapsed visual state is tracked internally by the frontend and persists
  across reruns (similar to `st.expander`). It is NOT stored in `st.session_state[key]` —
  only filter data is stored there.
- `on_change` is triggered on the next rerun whenever the filter state changes compared
  to the previous rerun:
  - User adds, modifies, or removes a filter → triggers `on_change`
  - User expands/collapses the widget → does NOT trigger `on_change` (visual-only)
  - Stale filter silently dropped (column removed from input df) → triggers `on_change`
    only if the effective filter set changed
  - Programmatic update to `st.session_state[key]` between reruns → triggers `on_change`
    if the new value differs from the previous value
- If the input DataFrame schema changes (columns removed), stale filters for those
  columns are silently dropped
- Users can programmatically set filters via `st.session_state[key] = [...]` using the
  filter descriptor format above. Invalid descriptors (unknown columns, invalid operators)
  are silently dropped on the next rerun.

**Widget identity and key behavior:**

- **With `key` set**: the widget identity is stable across reruns. Filter state persists
  even when the input DataFrame's *data* changes (e.g., new rows, updated values). Only a
  *schema* change (columns added/removed/renamed) resets the widget and drops stale
  filters. This matches `st.data_editor` behavior and is the expected pattern for BI
  dashboards where the underlying data refreshes periodically.
- **Without `key`**: widget identity is derived from the call position in the script. The
  filter state still persists across reruns as long as the script structure and input
  DataFrame schema remain the same.
- Schema changes that invalidate active filters (column removed or type changed) cause
  those specific filters to be dropped; other filters remain intact.

**Null handling:**

Null/NaN/None values in the source data are handled as follows:

- **No filter active on a column**: all rows are included (nulls pass through)
- **Positive filter applied** (e.g., "status is Active"): null rows are **excluded** by
  default — a null is not equal to any selected value
- **"is null" / "is not null" operators**: available on all filter types as additional
  operators, allowing explicit null filtering
- **Multiselect column picker**: if a column has nulls, "(Blanks)" appears as a
  selectable option in the multiselect checklist
- **Range/date filters**: null rows are excluded when any range constraint is active

This matches the behavior users expect from Tableau and Looker.

**Filtering execution:**

- Filtering happens Python-side on each rerun
- The widget applies filters to the input DataFrame and returns the result
- Each committed filter change triggers a full rerun (standard Streamlit widget behavior)
- For large DataFrames, users can combine with `@st.cache_data` or `@st.fragment`

**Performance:**

- Lightweight regardless of DataFrame size — only filter metadata crosses the wire (not
  the full DataFrame)
- Handles 1M+ rows without startup delay (lazy option computation per column, vectorized
  filtering)
- Works with `@st.fragment` to scope reruns; pairs with `@st.cache_data` for large datasets
- See the [tech spec](./tech-spec.md) for full implementation details

### Examples

**Basic — auto-infer everything:**

```python
import streamlit as st
import pandas as pd

df = pd.read_csv("sales.csv")
filtered = st.filter_bar(df)
st.dataframe(filtered)
```

**Restrict filterable columns:**

```python
filtered = st.filter_bar(df, columns=["status", "region", "date"])
```

**With explicit configuration:**

```python
filtered = st.filter_bar(df, columns={
    "status": FilterConfig(type="multiselect"),
    "price": FilterConfig(type="range", min_value=0, max_value=500),
    "created_at": FilterConfig(type="date_range"),
    "internal_id": None,  # hide this column from filters
})
```

**With label and help:**

```python
filtered = st.filter_bar(
    df,
    label="Filter sales data",
    help="Add filters to narrow down the results shown below.",
)
st.dataframe(filtered)
```

**Collapsed by default (for secondary/sidebar usage):**

```python
with st.sidebar:
    filtered = st.filter_bar(
        df,
        label="Filters",
        expanded=False,
        columns=["status", "region", "date"],
    )
```

**Driving multiple views:**

```python
import streamlit as st

df = load_data()
filtered = st.filter_bar(df, label="Dashboard filters", key="main_filter")

col1, col2 = st.columns(2)
with col1:
    st.bar_chart(filtered.groupby("region")["revenue"].sum())
with col2:
    st.dataframe(filtered)

st.metric("Total Revenue", f"${filtered['revenue'].sum():,.0f}")
```

**With callback:**

```python
def on_filter_change():
    st.toast(f"Showing {len(st.session_state.my_filter)} active filters")

filtered = st.filter_bar(df, key="my_filter", on_change=on_filter_change)
```

### Edge Cases

| Scenario | Behavior |
|---|---|
| Empty DataFrame | Widget renders but no filters can be added |
| All rows filtered out | Returns empty DataFrame (0 rows, same columns) |
| Column removed from input df | Stale filter for that column is silently dropped |
| Column with all null values | Excluded from auto-inference; can be forced via `columns` |
| Very wide DataFrame (50+ columns) | Column picker shows all; chips wrap to multiple lines |
| `data` is not a DataFrame | Raises `StreamlitAPIException` with clear message |
| `label=None` with `help` set | `help` is ignored (no label to attach tooltip to) |
| `label` set with `label_visibility="hidden"` | Label used as `aria-label`; tooltip not shown |
| `label=None` with `label_visibility` set | `label_visibility` is ignored |
| `expanded=False` with no active filters | Shows compact trigger: "Filters" (no count) |
| `expanded=False` with active filters | Shows compact trigger: "Filters (N)" with count |
| `columns` contains name not in DataFrame | Raises `StreamlitAPIException` |
| `disabled=["status"]` with no "status" filter active | "status" column is locked in the column picker (cannot be added) |
| Input DataFrame data changes (same schema) | Filter state persists (with `key`) |
| Input DataFrame schema changes | Stale filters dropped; other filters persist |

### Design

The filter bar follows the chip/pill pattern seen in Notion, Attio, and the existing
Streamlit Figma designs (design system node 3437-9926):

- Filter chips use Streamlit's standard chip styling (border, rounded corners)
- Active chips show column name + summarized value
- The `+ Add filter` button uses secondary/ghost button styling
- Column picker dropdown shows column names with type-indicator icons
- Edit popovers match Streamlit's existing popover styling
- Light and dark theme support

Detailed visual specs are tracked in the
[Figma design system](https://www.figma.com/design/svukmRMf0N9yQzdv8f7sgO/Streamlit-Open-Source-design-system?node-id=3437-9926).

### Accessibility

**Keyboard navigation:**

- `Tab` moves focus between filter chips and the "Add filter" button
- `Enter` / `Space` on a chip opens its edit popover
- `Delete` / `Backspace` on a focused chip removes that filter
- `Escape` closes an open popover without applying changes
- Within the column picker dropdown: arrow keys navigate, `Enter` selects, `Escape`
  closes. Follows WAI-ARIA listbox pattern — Arrow Up/Down cycle items, Home/End jump to
  first/last, type-ahead focuses matching item.
- Within filter popovers: standard form control keyboard behavior (Tab between inputs,
  Enter to confirm)

**Screen reader support:**

- The filter bar container is marked with `role="toolbar"` and
  `aria-label="Data filters"` (or the user-provided `label` value)
- Each filter chip is a button with an accessible label describing its state
  (e.g., "Status: Active, Pending. Press Delete to remove.")
- The "Add filter" button has `aria-haspopup="listbox"`
- Filter add/remove actions produce a live region announcement
  (e.g., "Filter added: Status", "Filter removed: Price")
- When `label` is provided with `label_visibility="hidden"`, the label text is applied
  as `aria-label` on the toolbar container

**Reduced motion:**

- Any chip transition animations respect `prefers-reduced-motion` (animations disabled
  when reduced motion is preferred)

### Comparison with Related Patterns

| Approach | Filtering logic | UI | Composability |
|---|---|---|---|
| `st.filter_bar(df)` (proposed) | Built-in, type-aware | Chips/pills with popovers | Drives any downstream element |
| Manual widgets (`st.multiselect` + `st.slider` + ...) | User-written | Separate widgets | Full control, verbose |
| `st.data_editor` selection | Row selection only | Checkbox column | Tightly coupled to table |
| Community: `streamlit-dynamic-filters` | User-written mask | Auto-generated widgets | DataFrame-only |

## Alternatives Considered

**Option 1: Return filtered DataFrame (proposed)** ✅ PREFERRED

```python
filtered_df = st.filter_bar(df)
```

Pros:
- Simplest API — one line to add filtering
- Users work with familiar DataFrame operations downstream
- Consistent with Streamlit's "top-to-bottom script" model

Cons:
- Causes a rerun on every filter change (standard widget behavior)
- For very large DataFrames, Python-side filtering may be slow

**Option 2: Return filter state dict**

```python
filters = st.filter_bar(df)
# filters = [{"column": "status", "operator": "is", "value": ["active"]}]
```

Pros:
- More composable (user applies filters themselves)
- Could be passed to SQL queries or remote APIs

Cons:
- Requires users to implement their own filtering logic
- Defeats the "one-liner" value proposition
- Not beginner-friendly

**Option 3: Integrated into `st.dataframe`**

```python
st.dataframe(df, filterable=True)
```

Pros:
- Tighter UX (filters visually attached to the table)
- Fewer elements to compose

Cons:
- Can't use filters without a visible table
- Couples filtering to `st.dataframe`'s already-complex API
- Unclear return value semantics (dataframe already returns selection state)
- Harder to use filters to drive charts, metrics, or other views

The standalone approach is preferred for V1. Integration with `st.dataframe` can follow
as a future enhancement that reuses the same underlying filter bar component.

**Option 4: `label` as first positional argument (like `st.multiselect`)**

```python
filtered_df = st.filter_bar("Filter sales", df)
```

Pros:
- Consistent with input widgets (`st.selectbox`, `st.multiselect`, `st.slider`)

Cons:
- Breaks the `st.filter_bar(df)` one-liner (Principle #1: Simplicity First)
- The filter bar is data-centric like `st.data_editor` — its purpose is self-evident from
  the filter chip UI without a label
- Forces a label string even when unnecessary

The `st.data_editor` pattern (data first, optional keyword-only `label`) is preferred
because the filter bar's primary framing object is the DataFrame, not a text label.

## Out of Scope (Future Work)

**High priority (expected BI demand):**

- **Relative date presets**: Quick-select options like "Last 7 days", "Last 30 days",
  "This quarter", "YTD" for date/datetime filters. These are ubiquitous in BI tools
  (Tableau, Looker, Metabase) and will be the most-requested addition after V1. Could be
  exposed via a `presets` field in `FilterConfig`:
  `FilterConfig(type="date_range", presets=["last_7_days", "last_30_days", "this_quarter"])`.
- **Cascading / dependent filters**: Selecting "Country=US" narrows "City" options to US
  cities only. Common in BI dashboards with hierarchical dimensions. The current API
  cannot express inter-column dependencies; a future `depends_on` field in `FilterConfig`
  or a callback-based approach could enable this.

**Medium priority:**

- **OR logic between columns**: V1 uses AND between all active filters. OR groups can be
  added later based on demand.
- **Default / pre-populated filter values** (`default` parameter): A declarative way to
  initialize the widget with filters already applied (e.g., "start with status='active'").
  V1 supports this via programmatic `st.session_state[key] = [...]` assignment before the
  widget call. A dedicated `default` parameter can be added later if the session_state
  pattern proves too verbose.
- **`st.dataframe` / `st.data_editor` integration**: Rendering filter controls inline
  (e.g., column header filters or an embedded filter bar via `filterable=True`). This
  addresses [#6272](https://github.com/streamlit/streamlit/issues/6272) (63 upvotes),
  [#1879](https://github.com/streamlit/streamlit/issues/1879) (33 upvotes), and
  [#10156](https://github.com/streamlit/streamlit/issues/10156) (11 upvotes).
- **Server-side / SQL pass-through filtering**: For lazy-loaded or remote data sources
  where filtering should happen at the query layer. The likely implementation path is
  integration with the [dataframe lazy-load](../2026-05-07-dataframe-lazy-load/product-spec.md)
  source adapter system — filter descriptors would be passed to the adapter which converts
  them to SQL WHERE clauses (e.g., for Snowpark DataFrames).
- **`st.form` batch-apply mode**: Allowing filter_bar inside an `st.form` to batch
  multiple filter changes into a single rerun (chips appear but don't apply until the form
  submit button is clicked). The `@st.fragment` pattern is the preferred approach for
  reducing reruns in V1.

**Lower priority:**

- **Saved filter presets**: Ability to name and persist filter combinations.
- **Custom filter types**: User-defined filter UIs beyond the built-in types.
- **Filter count badge / summary**: Showing "3 filters active, 142 of 1000 rows" inline.
- **Cross-widget filtering**: Clicking a chart segment to add a filter (requires
  event-scoped fragment reruns from the
  [related spec](../2026-06-23-event-scoped-fragment-reruns/product-spec.md)).

## Checklist

| Item                       | ✅ or comment                                    |
|----------------------------|--------------------------------------------------|
| Works on SiS, Cloud, etc?  | ✅ Yes — pure widget, no platform dependencies   |
| No breaking API changes    | ✅ Yes — new widget, additive change             |
| No new dependencies        | ✅ Yes — reuses existing dtype inference          |
| Metrics collected          | ✅ Yes — new `filter_bar` command metric          |
| Any security/legal impact? | ✅ None                                           |
| Any docs changes needed?   | ✅ Yes — API reference, filtering patterns guide  |
