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

Each decision below carries a recommendation and its reasoning. Reviewers should approve or
push back per item.

**1. Configuration — reuse `column_config` rather than add a `FilterConfig`**

Per-column configuration uses the existing `st.column_config.*` classes, which already carry
every domain field a filter needs. Filter-only knobs live in a new `filter` field on
`ColumnConfig`. Details in [Column configuration](#column-configuration).

One vocabulary instead of two for the same facts. `ColumnConfigMappingInput` already accepts
`ColumnConfig | str | None`, so `{"col": None}` (exclude) and `{"col": "Label"}` (label
shorthand) are existing idioms rather than new invention. Encoding filter type as a class
makes invalid combinations unrepresentable — `NumberColumn(options=[...])` cannot be written,
where `FilterConfig(type="range", options=[...])` could. Per-column `help` and the label
shorthand come free. And when `st.dataframe(filterable=...)` ships, the same mapping moves
from `columns=` to `column_config=` unchanged — a wager on that integration happening, with
the consistency win standing on its own if it slips.

Cost: adding `filter` to `ColumnConfig` changes a **shared public type**, so it needs a
reviewer who owns `column_config`. Most of the 21 column types have no filter meaning and
must raise clearly, and table-only fields (`width`, `pinned`, `alignment`) are ignored — with
precedent, since `st.dataframe` already ignores `required` and `disabled`.

**2. Scope — standalone widget, AND-only logic**

`st.filter_bar` ships standalone; `st.dataframe(filterable=True)` is separate later work.
Filters combine with AND, implicitly, with no user-facing AND/OR toggle — no comparable ships
one:

| Tool | Across fields | Within one field | Cross-field OR |
|---|---|---|---|
| Excel AutoFilter | AND — "filters are additive" | And/Or radio in Custom Filter | Separate Advanced Filter with a criteria range |
| Tableau | AND, no toggle between cards | Multi-value lists, Condition formula | Calculated field, set, or formula |
| Power BI | AND across fields | Basic vs Advanced filtering per field | DAX measure |
| Notion | Per-group AND/OR, nested 3 deep | Multi-select values | Behind "Add advanced filter" — explicitly no global toggle |

A global toggle also gets *less* useful as filters multiply — with four filters, flipping all
of them to OR is rarely the intent — and it is the shape we would want to replace with
grouped logic later. Adding an affordance is additive; removing a shipped one is a
regression, so the cheap-to-reverse direction is to cut. Within-field OR still ships, via
multiselect ("status is Active OR Pending") and `between`.

Also confirmed out of scope: grouped AND/OR, and cascading/dependent filters — the latter
being the highest-priority follow-up, and notably Tableau's own recommendation for
high-cardinality fields.

**3. Live filtering only**

Every filter change triggers a rerun, like any other widget. No `mode="live" | "batch"`
parameter.

Power BI applies filters immediately and its Apply button is opt-in, off by default, under
options named "Query reduction"; Tableau's Apply button is a per-filter-card option. In both,
live is the default and batching is an author-controlled opt-in motivated by query cost. In
Streamlit the cost lever is `@st.fragment`, which scopes the rerun so expensive loading above
the filter bar does not re-execute — a better fit than an apply button, since it removes the
cost rather than deferring it.

**4. Cardinality — a value picker at every size, governed by one render-cap constant**

A categorical column always gets a value picker; cardinality changes only where its options
come from, never what kind of filter it is. Free text is reserved for prose columns, and the
render cap is not configurable. Details in [Filter type inference](#filter-type-inference).

A simpler rule — text search above N unique values — would change the filter's *semantics* at
a low boundary, which no comparable does. Metabase switches a dropdown to a search box
above 1,000 distinct values and reserves a plain input box for text-heavy columns, and
Tableau caps displayed search results at 100 while keeping a value picker. Our own
measurement (100 options → ~294ms popover) is a rendering cost, so it should bound how many
rows *render* rather than what kind of filter a column gets. That also settles
configurability: the number no longer decides the filter type, so there is nothing for a user
to configure.

**5. No collapsing in V1** (needs design confirmation)

The filter bar is always expanded. Both the `expanded` parameter and the runtime disclosure
control are cut.

Dropping the parameter alone would save no frontend surface, because the collapsed and
expanded states come from the runtime control rather than from the parameter — so this is one
decision, not two. Cutting both removes four design states plus the count badge and chevron
work, and `expanded` is purely additive later. The case that argues for keeping it is a sidebar
filter bar with six or more pills consuming vertical space; worth confirming against that in
design review.

## Proposal

### API

```python
st.filter_bar(
    data: DataFrameLike,
    *,
    # Configuration
    columns: Sequence[str] | Mapping[str, ColumnConfig | str | None] | None = None,
    default: FilterState | None = None,
    # Display
    label: str | None = None,
    help: str | None = None,
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
| `columns` | `Sequence[str] \| Mapping[str, ColumnConfig \| str \| None] \| None` | `None` | Controls which columns are filterable and how. `None`: auto-include all eligible columns. `Sequence[str]`: include only the named columns (filter type inferred). `Mapping`: keys are column names, values are `st.column_config.*` objects for explicit control, a string as a label shorthand, or `None` to exclude. Column names not present in the input DataFrame raise `StreamlitAPIException`. |
| `default` | `FilterState \| None` | `None` | Initial filter state applied on first render (before user interaction). A dict keyed by column name with filter descriptors (e.g., `{"status": {"type": "multiselect", "operator": "is", "values": ["active"]}}`) — the same shape `st.session_state[key]` returns, so state can be captured and replayed. A column name not present in the DataFrame raises `StreamlitAPIException`; that differs from stale filters in restored user state, which are dropped silently. Once the user interacts, `default` is ignored (same semantics as `st.multiselect(default=...)`). |
| `label` | `str \| None` | `None` | A short label displayed above the filter bar. Supports Markdown. If `None`, no label is displayed. |
| `help` | `str \| None` | `None` | A tooltip displayed next to the widget label (only shown when `label_visibility="visible"`). |
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

Filters combine with AND logic: one condition per column, and every condition must match.
There is no user-facing AND/OR control (see Decisions for Review #2). Within a single filter,
OR applies wherever the filter type provides it — a multiselect matches any selected value
(e.g., "status is Active OR Pending").

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
    "status": st.column_config.SelectboxColumn(options=["active", "inactive"]),
    "price": st.column_config.NumberColumn(min_value=0, max_value=500),
    "created_at": st.column_config.DateColumn(label="Created"),
    "region": "Sales region",  # string shorthand for the pill label
    "internal_id": None,  # hide this column from filters
})
```

**In the sidebar:**

```python
with st.sidebar:
    filtered = st.filter_bar(df, label="Filters", columns=["status", "region", "date"])
```

**Scoping reruns for expensive data:**

```python
@st.cache_data
def load_data():
    return expensive_query()

@st.fragment
def filter_section():
    filtered = st.filter_bar(load_data(), key="filters")
    st.dataframe(filtered)

filter_section()
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
    st.toast(f"Active filters: {state.active_filters}")

filtered = st.filter_bar(df, key="my_filter", on_change=on_filter_change)
```

### Filter Type Inference

When no explicit column config is provided, the widget infers filter types from column dtypes
using the same `ColumnDataKind` system that powers `st.dataframe`:

| Column Data Kind | Filter Type | UI |
|---|---|---|
| `STRING` (categorical) | Multiselect | Searchable checklist of values |
| `STRING` (prose) | Text search | Text input with contains/equals operators |
| `BOOLEAN` | Toggle | True / False / All |
| `INTEGER`, `FLOAT`, `DECIMAL` | Range | Min/max inputs |
| `DATE` | Date range | Date picker with before/after/between |
| `DATETIME` | Datetime range | Datetime picker with before/after/between |
| `TIME` | Time range | Time picker with before/after/between |
| `LIST`, `DICT`, `BYTES`, `COMPLEX` | Excluded | Not filterable by default |

**Categorical vs. prose.** For string columns the only inference decision is whether the
values are a set to pick from or free text. Cardinality alone cannot separate those — 10,000
customer names are a set, 10,000 comments are not — so two cheap sampled signals are used:
the uniqueness ratio (`nunique / len`, near 1 meaning nearly every row is distinct) and mean
string length (prose runs long, labels are short). A categorical column gets a picker no
matter how many values it holds; only prose columns get the text filter. Either inference is
overridable with `SelectboxColumn` or `TextColumn`.

**Where options come from.** Cardinality never changes the *kind* of filter, only how options
reach the browser. A single render cap governs both how many rows the popover draws and when
option loading moves server-side:

| Condition | Behavior |
|---|---|
| `nunique` ≤ render cap | All options shipped with the element; client-side search |
| `nunique` > render cap | First *cap* options shipped; typing searches server-side with no rerun ("Showing 100 of 3,412 — type to search") |

The cap is an implementation constant rather than a parameter — it no longer determines what
kind of filter a column gets, so there is nothing for a user to configure. Its value is set by
how many checkbox rows the popover can draw comfortably; see the tech spec.

Additional rules:
- Categorical dtype columns — always multiselect regardless of cardinality
- Columns with all null values — excluded from auto-inference (can be forced via column config)
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
| Date/time range | between, not between, equals, not equals, before, after, is relative to today (direction × unit: this/past/next × day/week/month/year), is null, is not null |

### Column configuration

Explicit control uses the existing `st.column_config.*` classes — the same objects
`st.dataframe` and `st.data_editor` accept:

```python
st.filter_bar(df, columns={
    "status": st.column_config.SelectboxColumn(options=["active", "inactive"]),
    "price": st.column_config.NumberColumn(min_value=0, max_value=1000),
    "created_at": st.column_config.DateColumn(label="Created", help="Order date"),
    "region": "Sales region",  # string shorthand for label
    "internal_id": None,  # excluded
})
```

The column class determines the filter type, and the domain fields it already carries are
reused:

| Column config type | Filter type | Fields used |
|---|---|---|
| `SelectboxColumn` | Multiselect | `options`, `format_func` |
| `TextColumn`, `LinkColumn`, `MarkdownColumn` | Text search | — |
| `NumberColumn`, `ProgressColumn` | Range | `min_value`, `max_value` |
| `CheckboxColumn` | Toggle | — |
| `DateColumn`, `DatetimeColumn`, `TimeColumn` | Date / datetime / time range | — |
| `MultiselectColumn`, `ListColumn`, `JsonColumn`, `ImageColumn`, `AudioColumn`, `VideoColumn`, `LineChartColumn`, `BarChartColumn`, `AreaChartColumn`, `ButtonColumn` | Not filterable — raises `StreamlitAPIException` | — |

`label` and `help` apply to the filter pill in every case. Table-only fields (`width`,
`pinned`, `alignment`, `required`) are ignored, as are `disabled` and `hidden` — `filter_bar`
uses its own `disabled` parameter and `None` for exclusion, so there is one mechanism for each
rather than two. `MultiselectColumn` and `ListColumn` hold multiple values per cell and need
"has any of" mask semantics; they are deferred with the list/tags filter.

**Filter-only options** live in a new `filter` field on any column config, accepting
`bool | FilterConfig`:

```python
st.filter_bar(df, columns={
    # Restrict which operators the user can choose
    "price": st.column_config.NumberColumn(
        min_value=0,
        filter=st.column_config.FilterConfig(operators=["between", "greater_than"]),
    ),
    # Keep the column honestly typed, but filter it as a checklist
    "store_id": st.column_config.NumberColumn(
        filter=st.column_config.FilterConfig(type="multiselect"),
    ),
})
```

| Field | Type | Default | Description |
|---|---|---|---|
| `type` | `Literal["multiselect", "text", "range", "date_range", "datetime_range", "time_range", "toggle"] \| None` | `None` | Override the filter type implied by the column class. For columns whose display type and natural filter differ — integer codes filtered as a checklist. |
| `operators` | `Sequence[str] \| None` | `None` | Restrict the operators offered to a subset of the defaults for that filter type. |

`filter=False` marks a column non-filterable while leaving the rest of its configuration
intact. In `st.filter_bar`, that is equivalent to `None`; the distinction matters in a table
context, where `None` means "hide the column entirely".

### Integration path

Reusing `column_config` is a deliberate bet that filtering will eventually be available on
`st.dataframe`. The intended shape:

```python
st.dataframe(
    df,
    filterable=True,
    column_config={
        "status": st.column_config.SelectboxColumn(options=["active", "inactive"]),
        "price": st.column_config.NumberColumn(min_value=0, max_value=1000),
    },
)
```

Filter types and domains come from the `column_config` the developer already wrote, so nothing
is declared twice. Three properties of the V1 design keep that path open:

1. **`filter` is the hook.** It accepts `bool | FilterConfig` on any column config, so a table
   can disable filtering per column (`filter=False`) and override the filter type wherever
   display type and filter type diverge — an integer column shown as a `ProgressColumn` but
   filtered as a range.
2. **Domain fields are overrides, not declarations.** `options`, `min_value`/`max_value`,
   `label`, and `format_func` override what would otherwise be inferred from the data. In a
   table context they are inferred from `column_config` instead — same semantics, no API
   change.
3. **Exclusion differs by context, and both forms are accepted.** `None` excludes a column
   from filtering in `st.filter_bar`; `filter=False` expresses "displayed but not filterable"
   for the table case.

`st.data_editor` is a harder case, and blocked rather than deferred: mapping edits back to
source rows through a filtered view needs stable row identity — the same dependency the
[dataframe lazy-load spec](../2026-05-07-dataframe-lazy-load/product-spec.md) raises for
`on_select`.

### FilterBarState

Reading `st.session_state[key]` returns a `FilterBarState` object:

```python
state = st.session_state["my_filter"]

state.Industry             # → {"type": "multiselect", "operator": "is", "values": ["Tech"]}
state["Industry"]["values"]  # → ["Tech"]

state.active_filters  # → ["Industry", "Stage"] (columns with active filters)
```

`FilterBarState` is exported as `st.FilterBarState` for type annotations. It is read-only
(mutations raise `TypeError`).

### Behavior

**Visual layout:**

```
Filter results ⓘ                              (label + help tooltip)
[ + Add filter ]

# After adding filters:
Filter results ⓘ
[ Status: Active, Pending ˅]  [ Price: < $30 ˅]  [Clear all]  [ + Add filter ]
```

The filter bar is always expanded. Collapsing is deferred — see
[Out of Scope](#out-of-scope-future-work).

**Chip behavior:**

- Active filters display as chips/pills (always primary-colored once added)
- Each chip shows `Column: Value` (or `Column: Operator Value` for non-default operators)
- Clicking a chip opens its edit popover (which contains a delete button)
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

**Empty state:** With no active filters, a subtle guidance message displays:
`Click "Add filter" to get started`.

**Removing filters:**

- Click the delete (trash) button inside a filter's edit popover, or
- "Clear all" (shown when 2+ filters active)

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
- Changes apply live — every filter change triggers a rerun, like any other widget
- `on_change` fires when the filter set changes

**Reducing reruns:** `@st.fragment` scopes a filter interaction to the fragment, so expensive
data loading above the filter bar does not re-execute. This is the recommended pattern for
large data. Placing the filter bar inside `st.form` also works — pills update locally and the
returned DataFrame changes only on submit — but it defers the cost rather than removing it, so
it is not the recommended pattern.

**Null handling:**

- No filter active: all rows pass (nulls included)
- Positive filter applied: null rows excluded by default
- `is null` / `is not null` operators available on all filter types
- Multiselect: "(Blanks)" appears as a selectable option if column has nulls

**Performance:**

- Only filter metadata crosses the wire (not the full DataFrame)
- Handles 1M+ rows without startup delay (signature-keyed cache eliminates repeated
  `unique()` calls on subsequent reruns)
- **Recommended pattern for large datasets:** wrap the filter bar in `@st.fragment` so
  filter interactions only re-execute the fragment, not the full script. Combine with
  `@st.cache_data` for expensive data loading above the filter
- High-cardinality multiselect columns scale gracefully (incremental server-side search
  for very large option sets)
- At 10M+ rows, filter application itself takes ~800ms — production apps at this scale
  should use `@st.fragment` to keep interactions responsive

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

- **Cascading / dependent filters**: Selecting "Country=US" narrows "City" options to US
  cities. Tableau's own recommendation for high-cardinality fields is sequential filters with
  "Only Relevant Values", which makes this the most-requested shape. The likely design is
  deriving a column's options from the already-filtered frame with an opt-out, rather than a
  `depends_on` field — it needs a design pass for options vanishing mid-interaction and for
  widening a filter after narrowing.
- **Within-field multi-condition**: a condition builder on one column — text "contains A or
  contains B", or disjoint numeric ranges like "< 10 or > 100". This is what Excel's Custom
  Filter And/Or radio and Power BI's Advanced filtering offer in their normal flow, which
  ranks it above cross-field OR. The remaining gap is narrow: multiselect already covers
  within-field OR for categorical columns, and `between` covers two-sided numeric and date
  ranges.

**Medium priority:**

- **`st.dataframe` integration**: Embedded filter bar via `filterable=True`. Addresses
  [#6272](https://github.com/streamlit/streamlit/issues/6272) (63 upvotes),
  [#1879](https://github.com/streamlit/streamlit/issues/1879) (33 upvotes). See
  [Integration path](#integration-path).
- **Cross-field OR**: no comparable exposes this as a flat toggle; if built, the shape is
  Notion-style nested groups behind an explicit advanced affordance. Cheap to add — the widget
  state is a JSON string, so no proto change and no state migration are needed, and the reader
  defaults to AND when no logic is recorded. The real work is defining "unconfigured filter"
  per filter type: an unset filter currently matches every row, which is correct as "no
  constraint" under AND but would make an OR union match everything.
- **Server-side / SQL pass-through filtering**: For lazy-loaded data where filtering
  should happen at the query layer. Likely integrates with the
  [dataframe lazy-load](../2026-05-07-dataframe-lazy-load/product-spec.md) adapter system.
- **List / tags filters**: `MultiselectColumn` and `ListColumn` hold multiple values per cell
  and need "has any of" / "has all of" mask semantics.

**Lower priority:**

- **Saved filter presets**: Named filter combinations with a dropdown switcher.
- **Collapsible filter bar**: an `expanded` parameter plus the runtime disclosure control.
- **`placeholder`**: custom empty-state text.
- **Custom filter types**: User-defined filter UIs (component v2 integration).
- **Per-filter row count badge**: "142 of 1000 rows" per pill — performance concern.
- **Cross-widget filtering**: Chart click → add filter (requires event-scoped fragments).
- **Select inverse for multiselect**: Quick "Invert" action.
- **Drag-to-reorder pills**: `dnd-kit` integration.
- **`st.data_editor` integration**: blocked, not merely deferred — mapping edits back to source
  rows through a filtered view needs stable row identity.

## Prototype status

A working prototype exists on this branch and produced the performance numbers cited above. It
differs from this spec in four ways, all implementation follow-ups rather than open questions:

- Configuration uses a standalone `FilterConfig` rather than `st.column_config.*`
- A flat AND/OR toggle is rendered in the pill row
- `placeholder` and `expanded` parameters exist
- String columns above 50 unique values fall back to a text filter instead of a
  server-searched value picker

The measured results are unaffected by these differences: they concern how filters are
declared and composed, not how they execute.

## Checklist

| Item                       | ✅ or comment                                    |
|----------------------------|--------------------------------------------------|
| Works on SiS, Cloud, etc?  | ✅ Yes — pure widget, no platform dependencies   |
| No breaking API changes    | ✅ Additive — new widget, plus a new optional `filter` field on `ColumnConfig` (needs review by `column_config` owners) |
| No new dependencies        | ✅ Yes — reuses existing dtype inference          |
| Metrics collected          | ✅ Yes — new `filter_bar` command metric          |
| Any security/legal impact? | ✅ None                                           |
| Any docs changes needed?   | ✅ Yes — API reference, filtering patterns guide  |
