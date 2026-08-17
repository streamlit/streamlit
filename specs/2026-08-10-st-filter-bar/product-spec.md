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

## Decisions for Review

Key decisions that need PM alignment before implementation:

1. **AND/OR toggle visible by default** — Tableau/Looker default to AND-only and hide OR
   behind advanced mode. We show a flat toggle to all users. Should this be hidden by
   default or gated behind a parameter?

2. **No "Apply" button — live filtering only** — Every filter change triggers a rerun
   immediately. BI tools (Power BI, Looker) often have "Apply filters" buttons. We rely on
   `st.form` wrapping as the batch-apply workaround. Is that sufficient?

3. **Cardinality threshold = 100** — Determines whether a string column gets multiselect
   (nice UX) vs. text search (fallback). Is 100 the right number? Should it be
   configurable via `FilterConfig`?

4. **`default` parameter format** — The dict format is verbose:
   `{"status": {"type": "multiselect", "operator": "is", "values": ["active"]}}`. Should
   we support shorthand like `{"status": ["active"]}` for the common case?

5. **Standalone widget (not integrated into `st.dataframe`)** — We ship a composable
   standalone widget first. `st.dataframe(filterable=True)` integration comes later as a
   separate feature that reuses this component.

## Proposal

### API

```python
st.filter_bar(
    data: DataFrameLike,
    *,
    # Configuration
    columns: Sequence[str] | Mapping[str, FilterConfig | None] | None = None,
    default: FilterState | None = None,
    # Display
    label: str | None = None,
    help: str | None = None,
    placeholder: str | None = None,
    expanded: bool = True,
    width: "stretch" | "content" | int = "stretch",
    label_visibility: LabelVisibility = "visible",
    # Interaction
    disabled: bool | Sequence[str] = False,
    key: Key | None = None,
    on_change: WidgetCallback | None = None,
    args: WidgetArgs | None = None,
    kwargs: WidgetKwargs | None = None,
    # Framework
    bind: BindOption = None,
    persist_state: PersistStateOption = None,
) -> DataFrameLike
```

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `data` | `DataFrameLike` | required | The source DataFrame to filter. Accepts pandas, Polars, PyArrow, or any object convertible via Streamlit's data-frame protocol. |
| `columns` | `Sequence[str] \| Mapping[str, FilterConfig \| None] \| None` | `None` | Controls which columns are filterable. `None`: auto-include all eligible columns. `Sequence[str]`: include only the named columns (filter type auto-inferred). `Mapping`: keys are column names, values are `FilterConfig` for explicit control or `None` to exclude. Column names not present in the input DataFrame raise `StreamlitAPIException`. |
| `default` | `FilterState \| None` | `None` | Initial filter state applied on first render (before user interaction). A dict keyed by column name with filter descriptors (e.g., `{"status": {"type": "multiselect", "operator": "is", "values": ["active"]}}`). Once the user interacts, `default` is ignored (same semantics as `st.multiselect(default=...)`). |
| `label` | `str \| None` | `None` | A short label displayed above the filter bar. Supports Markdown. If `None`, no label is displayed. |
| `help` | `str \| None` | `None` | A tooltip displayed next to the widget label (only shown when `label_visibility="visible"`). |
| `placeholder` | `str \| None` | `None` | Custom text for the "Add filter" button. Defaults to "Add filter". |
| `expanded` | `bool` | `True` | If `True`, the filter bar is fully expanded. If `False`, collapses to a trigger showing active filter count (e.g., "Filters (3)"). Unlike `st.expander`, defaults to expanded because showing filter controls is the primary purpose. |
| `width` | `"stretch" \| "content" \| int` | `"stretch"` | `"stretch"` fills container. `"content"` sizes to content. An `int` sets fixed pixel width. |
| `label_visibility` | `"visible" \| "hidden" \| "collapsed"` | `"visible"` | `"hidden"` reserves spacer space; `"collapsed"` displays nothing. |
| `disabled` | `bool \| Sequence[str]` | `False` | `True` disables the entire widget. A `Sequence[str]` of column names locks only those columns' filters (cannot be added, modified, or removed). |
| `key` | `str \| int \| None` | `None` | Unique widget key. Filter state stored in `st.session_state[key]`. |
| `on_change` | `Callable \| None` | `None` | Callback invoked when filters change. |
| `args` / `kwargs` | | `None` | Positional/keyword args for the callback. |
| `bind` | `Literal["query-params"] \| None` | `None` | Persists filter state in URL query string as JSON. Enables shareable filtered links. |
| `persist_state` | `Literal["page", "session"] \| None` | `None` | `"page"` persists across page navigations; `"session"` persists across browser session. |

### Return Value

| Condition | Return Value |
|---|---|
| No filters active | The original DataFrame (unmodified reference) |
| Filters active | A filtered copy of the input DataFrame with only matching rows |

**Type preservation:** The return type matches the input type. Polars in → Polars out.
Pandas in → pandas out. Matches `st.data_editor` behavior.

By default, filters combine with AND logic (all must match). A toggle in the UI allows
switching to OR logic (any filter must match). Within a single multiselect filter,
OR logic always applies (e.g., "status is Active OR Pending").

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

**Collapsed by default (for sidebar usage):**

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
df = load_data()
filtered = st.filter_bar(df, label="Dashboard filters", key="main_filter")

col1, col2 = st.columns(2)
with col1:
    st.bar_chart(filtered.groupby("region")["revenue"].sum())
with col2:
    st.dataframe(filtered)

st.metric("Total Revenue", f"${filtered['revenue'].sum():,.0f}")
```

**With default filters (pre-filtered on load):**

```python
filtered = st.filter_bar(
    df,
    default={
        "status": {"type": "multiselect", "operator": "is", "values": ["active"]},
        "price": {"type": "range", "operator": "greater_than", "min": 50},
    },
    key="my_filter",
)
```

**With URL binding (shareable filtered links):**

```python
filtered = st.filter_bar(df, key="dashboard_filter", bind="query-params")
# URL: ?st_dashboard_filter=<JSON-encoded filter state>
```

**With callback:**

```python
def on_filter_change():
    state = st.session_state.my_filter
    st.toast(f"Active filters: {state.active_filters}, logic: {state.logic}")

filtered = st.filter_bar(df, key="my_filter", on_change=on_filter_change)
```

### Filter Type Inference

When no explicit `FilterConfig` is provided, the widget infers filter types from column
dtypes using the same `ColumnDataKind` system that powers `st.dataframe`:

| Column Data Kind | Filter Type | UI |
|---|---|---|
| `STRING` (≤ 100 unique values) | Multiselect | Searchable checklist of values |
| `STRING` (> 100 unique values) | Text search | Text input with contains/equals operators |
| `BOOLEAN` | Toggle | True / False / All |
| `INTEGER`, `FLOAT`, `DECIMAL` | Range | Min/max inputs |
| `DATE` | Date range | Date picker with before/after/between |
| `DATETIME` | Datetime range | Datetime picker with before/after/between |
| `TIME` | Time range | Time picker with before/after/between |
| `LIST`, `DICT`, `BYTES`, `COMPLEX` | Excluded | Not filterable by default |

Additional rules:
- Categorical columns — always multiselect regardless of cardinality
- Columns with all null values — excluded from auto-inference (can be forced via `FilterConfig`)
- `TIMEDELTA`, `PERIOD`, `INTERVAL`, `EMPTY`, `UNKNOWN` — excluded

### Operators Per Filter Type

Each filter type supports a set of operators. The first listed is the default. All types
additionally support `is null` and `is not null`.

| Filter Type | Operators |
|---|---|
| Multiselect | is, is not, is null, is not null |
| Text search | contains, not contains, equals, not equals, starts with, ends with, is null, is not null |
| Toggle | is true, is false, is null |
| Range | between, not between, equals, not equals, greater than, less than, is null, is not null |
| Date/time range | between, not between, equals, not equals, before, after, is null, is not null |
| Date/time range (relative) | today, past 7 days, past 30 days, past 90 days, this week, this month, this year |

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

| Field | Type | Default | Description |
|---|---|---|---|
| `type` | `Literal["multiselect", "text", "range", "date_range", "datetime_range", "time_range", "toggle"] \| None` | `None` | Override auto-inferred filter type. |
| `label` | `str \| None` | `None` | Custom display label for the filter chip. Defaults to column name. |
| `options` | `Sequence[Any] \| None` | `None` | Explicit values for multiselect. If `None`, derived from data. |
| `min_value` / `max_value` | `int \| float \| None` | `None` | Bounds for range filters. If `None`, derived from data. |
| `operators` | `Sequence[str] \| None` | `None` | Restrict operators to a subset. |
| `format_func` | `Callable[[Any], str] \| None` | `None` | Display formatter for multiselect labels. Values unchanged; only labels affected. |

All fields are optional. An empty `FilterConfig()` is equivalent to auto-inference.

### FilterBarState

Reading `st.session_state[key]` returns a `FilterBarState` object:

```python
state = st.session_state["my_filter"]

state.Industry             # → {"type": "multiselect", "operator": "is", "values": ["Tech"]}
state["Industry"]["values"]  # → ["Tech"]

state.active_filters  # → ["Industry", "Stage"] (columns with active filters)
state.logic           # → "and" or "or"
```

`FilterBarState` is exported as `st.FilterBarState` for type annotations. It is read-only
(mutations raise `TypeError`).

### Behavior

**Visual layout — expanded (default):**

```
Filter results ⓘ                              (label + help tooltip)
[ + Add filter ]

# After adding filters:
Filter results ⓘ
[ Status: Active, Pending  ×]  [ Price: < $30  ×]  [ + Add filter ]
```

**Visual layout — collapsed (`expanded=False`):**

```
Filter results ⓘ  ≡ [2] ›                     (disclosure pattern)
```

The label, filter icon, count badge, and chevron are always visible. The pill row is
hidden when collapsed. The `expanded` parameter controls only the initial state; users
toggle at runtime.

**Chip behavior:**

- Active filters display as dismissible chips/pills
- Each chip shows `Column: Value` (or `Column: Operator Value` for non-default operators)
- Clicking `×` removes the filter; clicking a chip opens its edit popover
- `+ Add filter` opens a column picker dropdown

**Pill summary text:**

- Multiselect: 0 → "All", 1 → value name, 2 → "A, B", 3+ → "N selected"
- Text: query text (truncated to 20 chars)
- Range: operator + value(s) (e.g., "≥ 10", "10 – 50")
- Toggle: "True", "False", or "All"
- Null operators: "is null" or "is not null"

**Adding a filter:**

1. User clicks `+ Add filter`
2. Dropdown shows filterable columns (with type icons)
3. User selects a column → popover appears with appropriate filter UI
4. User configures the filter → becomes an active chip

**Empty state:** When expanded with no active filters, a subtle guidance message displays:
`Click "Add filter" to get started` (uses `placeholder` text if set).

**Removing filters:**

- Click `×` on a chip, or
- "Clear all" (shown when 2+ filters active), or
- Delete from within the edit popover

**Popover interactions:**

- `Enter` closes the popover (confirms current values)
- `Escape` closes without applying pending changes
- Clicking outside dismisses the popover

**Column ordering:**

- `Sequence[str]`: pills and picker follow sequence order
- `Mapping`: follows dict insertion order
- `None`: picker shows DataFrame column order; active pills follow user-added order

**State management:**

- Active filters persist across reruns (standard widget statefulness)
- If the input DataFrame schema changes, stale filters for removed columns are dropped
- Changes apply live as the user interacts (no "Apply" button)
- `on_change` fires when the filter set changes (not on expand/collapse)

**Null handling:**

- No filter active: all rows pass (nulls included)
- Positive filter applied: null rows excluded by default
- `is null` / `is not null` operators available on all filter types
- Multiselect: "(Blanks)" appears as a selectable option if column has nulls

**Performance:**

- Only filter metadata crosses the wire (not the full DataFrame)
- Handles 1M+ rows without startup delay
- Works with `@st.fragment` and `@st.cache_data`

### Edge Cases

| Scenario | Behavior |
|---|---|
| Empty DataFrame | Widget renders, no filters can be added |
| All rows filtered out | Returns empty DataFrame (0 rows, same columns) |
| Column removed from input df | Stale filter silently dropped |
| Very wide DataFrame (50+ columns) | Column picker shows all; chips wrap |
| `columns` contains name not in DataFrame | Raises `StreamlitAPIException` |
| Input data changes (same schema) | Filter state persists |
| Input schema changes | Stale filters dropped; others persist |
| Range min > max | No blocking validation; produces zero results (user sees immediately) |

### Design

The filter bar follows the chip/pill pattern seen in Notion, Attio, and the existing
Streamlit Figma designs (design system node 3437-9926):

- Filter chips use standard chip styling (border, rounded corners)
- Active chips show column name + summarized value
- `+ Add filter` uses secondary/ghost button styling
- Column picker shows column names with type-indicator icons
- Edit popovers match existing popover styling
- Light and dark theme support

Detailed visual specs: [Figma design system](https://www.figma.com/design/svukmRMf0N9yQzdv8f7sgO/Streamlit-Open-Source-design-system?node-id=3437-9926).

### Accessibility

- **Keyboard**: Tab between chips and buttons. Enter/Space opens popover. Delete removes
  chip. Arrow keys in dropdowns. Enter closes popover.
- **Screen reader**: Container has `role="toolbar"` with `aria-label`. Chips are buttons
  with descriptive labels. Live region announces filter add/remove.
- **Reduced motion**: Animations respect `prefers-reduced-motion`.

### Comparison

| Approach | Filtering logic | UI | Composability |
|---|---|---|---|
| `st.filter_bar(df)` (proposed) | Built-in, type-aware | Chips/pills with popovers | Drives any downstream element |
| Manual widgets | User-written | Separate widgets | Full control, verbose |
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
- Consistent with "top-to-bottom script" model

Cons:
- Rerun on every filter change (standard widget behavior)
- Python-side filtering for very large DataFrames may be slow

**Option 2: Return filter state dict**

```python
filters = st.filter_bar(df)
# filters = [{"column": "status", "operator": "is", "value": ["active"]}]
```

Pros: More composable, could pass to SQL queries
Cons: Users implement their own filtering, defeats "one-liner" value prop

**Option 3: Integrated into `st.dataframe`**

```python
st.dataframe(df, filterable=True)
```

Pros: Tighter UX (filters attached to table)
Cons: Can't filter without a visible table, couples filtering to an already-complex API,
unclear return value semantics, can't drive charts/metrics

**Option 4: `label` as first positional (like `st.multiselect`)**

```python
filtered_df = st.filter_bar("Filter sales", df)
```

Pros: Consistent with input widgets
Cons: Breaks the `st.filter_bar(df)` one-liner; the filter bar is data-centric like
`st.data_editor` — its purpose is self-evident from the chip UI without a label

## Out of Scope (Future Work)

**High priority (expected BI demand):**

- ~~**Relative date presets**~~: **Implemented in V1.** Available as operators: `today`,
  `past_7_days`, `past_30_days`, `past_90_days`, `this_week`, `this_month`, `this_year`.
- **Cascading / dependent filters**: Selecting "Country=US" narrows "City" options to US
  cities. The current API cannot express inter-column dependencies; a future `depends_on`
  field in `FilterConfig` could enable this.

**Medium priority:**

- **Grouped AND/OR (Notion-style)**: V1 ships a flat AND/OR toggle. The state model
  supports multi-group logic in V2 without migration.
- **`st.dataframe` integration**: Embedded filter bar via `filterable=True`. Addresses
  [#6272](https://github.com/streamlit/streamlit/issues/6272) (63 upvotes),
  [#1879](https://github.com/streamlit/streamlit/issues/1879) (33 upvotes).
- **Server-side / SQL pass-through filtering**: For lazy-loaded data where filtering
  should happen at the query layer. Likely integrates with the
  [dataframe lazy-load](../2026-05-07-dataframe-lazy-load/product-spec.md) adapter system.
- **`st.form` batch-apply mode**: Filter_bar inside `st.form` batches changes until
  submit. The `@st.fragment` pattern is preferred for reducing reruns in V1.

**Lower priority:**

- **Saved filter presets**: Named filter combinations with a dropdown switcher.
- **Custom filter types**: User-defined filter UIs (component v2 integration).
- **Per-filter row count badge**: "142 of 1000 rows" per pill — performance concern.
- **Cross-widget filtering**: Chart click → add filter (requires event-scoped fragments).
- **Select inverse for multiselect**: Quick "Invert" action.
- **Per-column help tooltips**: `help` field on `FilterConfig`.
- **Drag-to-reorder pills**: `dnd-kit` integration.
- **String shorthand**: `{"col": "Label"}` as `FilterConfig(label="Label")`.

## Rollout

- Ship directly as `st.filter_bar` (no experimental prefix) — the API is minimal enough
  that breaking changes are unlikely.
- Docs: API reference + "Filtering patterns" guide + gallery example.
- Community Cloud support from day 1 (pure widget, no platform dependencies).

## Success Metrics

- **Adoption**: 10%+ of data apps using `st.filter_bar` within 6 months of launch.
- **Satisfaction**: Reduction in GitHub issues requesting filtering features; positive
  community response (Discord, forum).
- **Engagement**: Track `filter_bar` command usage via existing command metrics pipeline.

## Checklist

| Item                       | ✅ or comment                                    |
|----------------------------|--------------------------------------------------|
| Works on SiS, Cloud, etc?  | ✅ Yes — pure widget, no platform dependencies   |
| No breaking API changes    | ✅ Yes — new widget, additive change             |
| No new dependencies        | ✅ Yes — reuses existing dtype inference          |
| Metrics collected          | ✅ Yes — new `filter_bar` command metric          |
| Any security/legal impact? | ✅ None                                           |
| Any docs changes needed?   | ✅ Yes — API reference, filtering patterns guide  |
