---
author: mayagbarnes
created: 2026-08-17
---

# `st.filter_bar` — DataFrame filter widget

## Summary

Add a new `st.filter_bar` widget that provides a composable, type-aware filter UI for
DataFrames. The widget infers an appropriate filter from each column's contents, renders
dismissible filter chips for active filters, and returns a filtered DataFrame. No table display is
required, so one filter bar can drive `st.dataframe`, charts, and metrics together.

```python
filtered_df = st.filter_bar(df)
st.dataframe(filtered_df)

# With label and help tooltip:
filtered_df = st.filter_bar(df, label="Filter results", help="Narrow down the dataset")
```

V1 filters frames held in memory. Unevaluated sources such as Snowpark tables and Polars
LazyFrames are materialized only when they are small enough that `st.dataframe` would materialize
them too; larger ones raise. Filtering at the query layer is deferred. See [Warehouse-scale data](#warehouse-scale-data).

**Nine decisions want input before implementation.** Seven are ready to approve as written; one
needs the `column_config` owners and one needs design. They are summarized in one table, each with
whatever it needs beyond this review: [Decisions for Review](#decisions-for-review).

## Problem

Filtering is the most common interaction pattern for data apps, yet Streamlit provides no
built-in way to do it. Developers must manually compose multiple widgets (`st.selectbox`,
`st.slider`, `st.date_input`) and wire them together with filtering logic. The result is verbose,
error-prone, and inconsistent across apps.

**Requests:**

| Issue | Upvotes | Asks for |
|---|---|---|
| [#6272](https://github.com/streamlit/streamlit/issues/6272) | 63 | Excel-like column header filters in `st.data_editor`. Addressed long-term by table integration (Out of Scope) |
| [#1879](https://github.com/streamlit/streamlit/issues/1879) | 33 | The oldest filtering request: inline search and filter on displayed DataFrames |
| [#12396](https://github.com/streamlit/streamlit/issues/12396) | 21 | `st.filter_bar` itself, the direct request for this widget |
| [#10156](https://github.com/streamlit/streamlit/issues/10156) | 11 | Dataframe search that filters rows instead of jumping to the match |
| [#12395](https://github.com/streamlit/streamlit/issues/12395) | 8 | Easier cross-filtering between charts and dataframes |
| [#13066](https://github.com/streamlit/streamlit/issues/13066) | 3 | Interactive filtering and sorting on vega charts, which composability covers |

The in-flight dataframe lazy-load work explicitly defers filtering to future work.

**Use cases:**

- Data exploration dashboards ("show me sales in Q3 where region is APAC")
- Admin panels with tabular data and user-driven filters
- Log and event tables filtered by severity, service, and date. Live incident triage also needs
  sub-day ranges and regex matching, both deferred
- Any app where users need to narrow down a DataFrame before visualizing or exporting

**Current workarounds:**

```python
# One widget plus one mask branch per column, repeated in every app
status = st.multiselect("Status", df["status"].unique())
min_date, max_date = st.date_input(
    "Date range", value=(df["date"].min(), df["date"].max())
)
min_price = st.number_input("Min price", value=0.0)

mask = pd.Series(True, index=df.index)
if status:
    mask &= df["status"].isin(status)
mask &= df["date"].between(min_date, max_date)
mask &= df["price"] >= min_price

filtered = df[mask]
```

Roughly 15 lines per dashboard, it doesn't scale to wide DataFrames, and it forces developers to
hand-write the dtype-specific filter logic that could be inferred.

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
| `data` | `DataFrameLike` | required | The source DataFrame to filter. Accepts pandas, Polars, PyArrow, or any object convertible via Streamlit's data-frame protocol. Unevaluated sources (Snowpark, Polars `LazyFrame`) follow `st.dataframe`'s thresholds — see [Warehouse-scale data](#warehouse-scale-data). |
| `columns` | `Sequence[str] \| Mapping[str, ColumnConfig \| str \| None] \| None` | `None` | Controls which columns are filterable and how. `None`: auto-include all eligible columns. `Sequence[str]`: include only the named columns (filter type inferred). `Mapping`: keys are column names, values are `st.column_config.*` objects for explicit control, a string as a label shorthand, or `None` to exclude. Column names not present in the input DataFrame raise `StreamlitAPIException`. |
| `default` | `FilterState \| None` | `None` | Initial filter state applied on first render (before user interaction). A dict keyed by column name with filter descriptors (e.g., `{"status": {"type": "select", "operator": "is", "values": ["active"]}}`). The nested form `{"filters": {...}}` that `st.session_state[key]` returns is also accepted, so state can be captured and replayed unchanged. A column name not present in the DataFrame raises `StreamlitAPIException`; that differs from stale filters in restored user state, which are dropped silently. Once the user interacts, `default` no longer applies (same semantics as `st.multiselect(default=...)`) — assigning to `st.session_state[key]` is how an app returns to a known filter set. |
| `label` | `str \| None` | `None` | A short label displayed above the filter bar. Supports Markdown. If `None`, no label is displayed. |
| `help` | `str \| None` | `None` | A tooltip displayed next to the widget label (only shown when `label_visibility="visible"`). |
| `width` | `"stretch" \| "content" \| int` | `"stretch"` | `"stretch"` fills container. `"content"` sizes to content. An `int` sets fixed pixel width. |
| `label_visibility` | `"visible" \| "hidden" \| "collapsed"` | `"visible"` | `"hidden"` reserves spacer space; `"collapsed"` displays nothing. |
| `disabled` | `bool \| Sequence[str]` | `False` | `True` disables the entire widget. A `Sequence[str]` of column names locks only those columns' filters (cannot be added, modified, or removed). |
| `key` | `str \| int \| None` | `None` | Unique widget key. Filter state stored in `st.session_state[key]`. |
| `on_change` | `Callable \| None` | `None` | Callback invoked when filters change. |
| `args` / `kwargs` | | `None` | Positional/keyword args for the callback. |
| `bind` | `Literal["query-params"] \| None` | `None` | Persists filter state in the URL query string, so a filtered view can be shared as a link. The value is a compressed, opaque blob rather than readable keys, so links round-trip what the widget wrote but cannot be hand-authored. Takes precedence over `persist_state`. |
| `persist_state` | `Literal["page", "session"] \| None` | `None` | `"page"` persists across page navigations; `"session"` persists across browser session. |

### Return Value

| Condition | Return Value |
|---|---|
| No filters active | The original DataFrame (unmodified reference) |
| Filters active | A filtered copy of the input DataFrame with only matching rows |

**Type preservation:** The return type matches the input type. Polars in → Polars out.
Pandas in → pandas out. Matches `st.data_editor` behavior.

Filters combine with AND logic: one condition per column, and every condition must match. There is
no user-facing AND/OR control (decision 2). Within a single filter, OR applies wherever the filter
type provides it. A multiselect matches any selected value, so "status is Active or Pending" is one
filter.

### Filter Type Inference

When no explicit column config is provided, the widget infers a filter from each column's
contents, using the same type detection that powers `st.dataframe`:

| Column contents | Filter type | UI |
|---|---|---|
| Categorical text | Multiselect | Searchable checklist of values |
| Prose text | Text search | Text input with contains/equals operators |
| Boolean | Toggle | True / False / All |
| Number (integer, float, decimal) | Range | Min/max inputs |
| Date | Date range | Date picker with before/after/between |
| Datetime | Datetime range | Datetime picker with before/after/between |
| Time | Time range | Time picker with before/after/between |
| Anything else (lists, dicts, binary, durations) | Excluded | Not filterable |

**Categorical vs. prose.** For string columns the only inference decision is whether the values are
a set to pick from or free text. A `city` column gets a picker even with thousands of values; a
`comments` column gets text search. Either inference is overridable with `SelectboxColumn` or
`TextColumn`.

**High-cardinality columns** get the same picker, with options searched as the user types under a
"Showing 100 of 3,412, type to search" header. How many options render at a time, and whether
search runs in the browser or on the server, is internal behavior, not a parameter.

Additional rules:
- Columns with a categorical dtype are always a multiselect, regardless of cardinality
- Columns that are entirely null are excluded from inference, and can be forced via column config

### Operators Per Filter Type

Each filter type supports a set of operators. The first listed is the default. All types
additionally support `is null` and `is not null`.

| Filter Type | Operators |
|---|---|
| Multiselect | is, is not, is null, is not null |
| Text search | contains, not contains, equals, not equals, starts with, ends with, is null, is not null |
| Toggle | is true, is false, is null |
| Range | between, not between, equals, not equals, greater than, greater than or equal, less than, less than or equal, is null, is not null |
| Date range, Datetime range | between, not between, equals, not equals, before, on or before, after, on or after, is relative to today, is null, is not null |
| Time range | between, not between, equals, not equals, before, on or before, after, on or after, is null, is not null |

Time columns get no relative option. "Past 7 days" is meaningless for a time of day.

In the UI, `is null` and `is not null` are labelled "is empty" and "is not empty", matching how
Notion and Excel present them.

`contains` and `not contains` accept **several terms**, matching a row if any of them match:
`message contains "timeout" or "connection refused"`. This is the same within-field OR that a
multiselect gives categorical columns. It needs no second condition row and no and/or selector.
Requiring *all* terms is deferred.

**Relative date ranges** use one operator with a direction dropdown, a unit dropdown, and a count
that appears only for `past`:

| Direction | Count | Unit | Resolves to, on August 24 |
|---|---|---|---|
| `this` | — | month | Aug 1 – 24 — the current period, to date |
| `last` | — | month | Jul 1 – 31 — the previous complete period |
| `next` | — | month | Sep 1 – 30 |
| `past` | 30 | day | Jul 26 – Aug 24 — a trailing window |

Units are `day`, `week`, `month`, `quarter`, and `year`. `this`, `last`, and `next` name calendar
periods and take no count. `past` takes a count and measures backwards from today. The direction
word carries the distinction because that is how the phrases already read: "last month" means July,
while "past 30 days" means the trailing window. `last day` and `next day` give yesterday and
tomorrow.

Prior art: Excel's date presets are exactly This/Last/Next by week, month, quarter, and year, and
Power BI, Tableau, and Metabase all use a count for trailing windows. Power BI reaches the same
capability by listing `Months` and `Months (Calendar)` as separate units, which needs nine unit
entries and has to suppress combinations like "this month (calendar)".

Ranges resolve on every rerun. "Past 30 days" always means the last 30 days, never a range frozen
when the filter was created. Quarters follow the calendar year; a configurable fiscal-year
start is deferred, as are sub-day units (hours and minutes).

### Column configuration

Explicit control uses the existing `st.column_config.*` classes, the same objects `st.dataframe`
and `st.data_editor` accept:

```python
st.filter_bar(
    df,
    columns={
        "status": st.column_config.SelectboxColumn(options=["active", "inactive"]),
        "price": st.column_config.NumberColumn(min_value=0, max_value=1000),
        "created_at": st.column_config.DateColumn(label="Created", help="Order date"),
        "region": "Sales region",  # string shorthand for label
        "internal_id": None,  # excluded
    },
)
```

The column class determines the filter type, and the domain fields it already carries are
reused:

| Column config type | Filter type | Fields used |
|---|---|---|
| `SelectboxColumn` | Multiselect | `options`, `format_func` |
| `TextColumn`, `LinkColumn`, `MarkdownColumn` | Text search | — |
| `NumberColumn`, `ProgressColumn` | Range | `min_value`, `max_value`, `format` |
| `CheckboxColumn` | Toggle | — |
| `DateColumn`, `DatetimeColumn`, `TimeColumn` | Date / datetime / time range | `format` |
| `MultiselectColumn`, `ListColumn`, `JsonColumn`, `ImageColumn`, `AudioColumn`, `VideoColumn`, `LineChartColumn`, `BarChartColumn`, `AreaChartColumn`, `ButtonColumn` | Not filterable — raises `StreamlitAPIException` | — |

`label`, `help`, and `format` all apply to the filter. `format` matters because a column stored as
`0.05` and displayed as `5%` must also filter as `5%`; otherwise a user typing `-5` silently matches
everything. Presentational fields (`width`, `pinned`, `alignment`, `required`) are ignored, as are
`disabled` and `hidden`. `filter_bar` uses its own `disabled` parameter and `None` for exclusion.
Each concept has exactly one mechanism.

`MultiselectColumn` and `ListColumn` hold several values per cell, which needs a different kind of
match ("has any of"). They are deferred with the list/tags filter. Naming an unfilterable type
explicitly raises, while auto-inference skips such columns silently. That is the same split as
`columns`, where a name absent from the DataFrame raises but a stale filter in restored state is
dropped quietly.

**Option order** follows the explicit `options` sequence when given, then a Categorical dtype's
declared order, then the column's natural type order. Numbers sort numerically and dates
chronologically. Options are never ordered by their string form.

**Filter-only options** live in a new `filter` field on any column config, accepting
`bool | FilterConfig`:

```python
st.filter_bar(
    df,
    columns={
        # Restrict which operators the user can choose
        "price": st.column_config.NumberColumn(
            min_value=0,
            filter=st.column_config.FilterConfig(operators=["between", "greater_than"]),
        ),
        # Keep the column honestly typed, but filter it as a checklist
        "store_id": st.column_config.NumberColumn(
            filter=st.column_config.FilterConfig(type="select"),
        ),
    },
)
```

| Field | Type | Default | Description |
|---|---|---|---|
| `type` | `Literal["select", "text", "range", "toggle"] \| None` | `None` | Override the filter type implied by the column class, for columns whose display type and natural filter differ — integer codes filtered as a checklist. The column's data type still picks the flavor: `"range"` gives a numeric range on a number column and a date range on a date column, so there is no separate `date_range`. |
| `operators` | `Sequence[str] \| None` | `None` | Restrict the operators offered to a subset of the defaults for that filter type. |
| `anchor` | `Literal["today", "latest"]` | `"today"` | What relative date ranges resolve from. `"latest"` uses the column's maximum value instead of the current date, so "past 7 days" ends at the newest row — the right default when data arrives on a lag and today is empty. |

`anchor` follows Power BI, whose relative date slicer offers Today, Last date, and First date as an
author-side setting for the same stated reason: "useful when your data isn't current". Setting it in
code instead of exposing a picker is deliberate. Whether a dataset lags is a property of the data,
not a per-viewer preference. The pill still reads "Past 30 days"; only what it
counts back from changes.

Type names are data-facing, not widget-facing: `select` instead of `multiselect`, and one `range`
instead of four. These values travel in filter state, and later into `st.dataframe`'s column headers
and translated SQL predicates. They should not carry a Streamlit widget name.
Sigma calls this "list values", Tableau "multiple values list", Excel a checklist.

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

Filter types and domains come from the `column_config` the developer already wrote. Nothing is
declared twice. What keeps that path open is the `filter` field: it lets a table turn
filtering off per column (`filter=False`) and override the filter type wherever display type and
natural filter diverge — an integer column shown as a `ProgressColumn` but filtered as a range.
Everything else needs no change. The domain fields are already defined as overrides of
what would otherwise be inferred from the data; in a table context they are simply inferred from
`column_config` instead.

The two are intended as siblings, not stages. A filter bar drives several elements at once,
returning rows the app uses downstream. In-table filtering explores a single table in place and
would expose state instead of returning rows, the way selection does. Both jobs are real and Sigma
ships both. The standalone widget is not a waypoint that in-table filtering later replaces.

`st.data_editor` is a harder case, and blocked rather than deferred: mapping edits back to
source rows through a filtered view needs stable row identity — the same dependency the
dataframe lazy-load work raises for `on_select`.

### FilterBarState

Reading `st.session_state[key]` returns a `FilterBarState` object:

```python
state = st.session_state["my_filter"]

state.filters  # → {"Industry": {...}, "Stage": {...}}
state.filters["Industry"]  # → {"type": "select", "operator": "is", "values": ["Tech"]}
state.filtered_columns  # → ["Industry", "Stage"]
state.matched_rows  # → 142
state.total_rows  # → 8431

# Assigning new state programmatically (drill-down, presets, reset to default):
st.session_state["my_filter"] = {
    "filters": {"Industry": {"type": "select", "values": ["Tech"]}}
}
```

Importable as `streamlit.typing.FilterBarState` for type annotations, alongside `DataEditorState`
and `DataframeState`. Reading is read-only, so in-place mutation raises `TypeError`. Assigning a new
value to the Session State key is supported and replaces the filter set, the same pattern
`st.dataframe` uses for programmatic selection. That is what makes saved presets,
chart-click-to-filter, and a "Reset to defaults" button buildable in app code before any of them
ship as features.

Column filters are nested under `filters` instead of sitting at the top level. Column names can
never collide with helpers or reserved keys. `_id` and `_source` columns, standard in MongoDB and
Elasticsearch exports, are ordinary filterable columns here. An assigned dict is validated: unknown
column names, unknown filter types, and unknown operators raise `StreamlitAPIException` instead of
being ignored.

The `filters` shape is documented and readable so apps can act on it, for example applying the same
conditions to a second DataFrame at a different grain. Values are JSON types: dates and datetimes
are ISO 8601 strings, decimals are floats. It is not yet a frozen public contract; naming it as a
typed input schema is deferred, matching how `DataframeStateInput` was handled.

### Behavior

**Visual layout:**

```
Filter results ⓘ                              (label + help tooltip)
[ + Add filter ]

# After adding filters:
Filter results ⓘ
[ Status: Active, Pending ˅]  [ Price: < $30 ˅]  [Clear all]  [ + Add filter ]
```

The bar shows how many rows survived the current filters (`142 of 8,431`), which is the feedback
Excel users read reflexively after every filter change.

The filter bar is always expanded; collapsing it entirely is deferred. In a narrow container, such
as the ~300px sidebar where filters usually live, the pill row caps at two rows and the remainder
collapses into a `+N more` chip that expands in place. Six active filters cannot consume the whole
viewport above the fold.

**Chip behavior:**

- Active filters display as chips/pills (always primary-colored once added)
- Each chip shows `Column: Value` (or `Column: Operator Value` for non-default operators)
- Clicking a chip opens its edit popover (which contains a delete button)
- `+ Add filter` opens a column picker dropdown

**Pill summary text:**

- Multiselect: 0 → "All", 1 → value name, 2 → "A, B", 3+ → "N selected"
- Text: the query text, truncated; several terms read as "timeout, +2 more"
- Range: operator + value(s) (e.g., "≥ 10", "10 – 50")
- Toggle: "True", "False", or "All"
- Date, datetime, time: the resolved range for absolute operators ("2020-01-01 – 2023-12-31"), or
  the phrase itself for relative ones ("Last month", "Past 30 days") — a relative pill never shows
  the dates it currently resolves to, since those change daily
- Null operators: "is empty" or "is not empty"

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
- Changes apply live: every filter change triggers a rerun, like any other widget
- `on_change` fires when the filter set changes
- With `bind="query-params"`, opening a shared link seeds the filters from the URL, which takes
  precedence over anything `persist_state` restored. This is existing framework behavior for bound
  widgets, not something this widget defines
- The URL value is deflate-compressed and base64-encoded (both Python standard library, and done
  server-side, so nothing decompresses in the browser). Compression is what keeps large filter sets
  shareable: uncompressed JSON would exceed practical URL limits at around eight active filters,
  and silently falling back to session-only state would mean a link that works with three filters
  stops working with eight for no visible reason. If a state is still too large after compression,
  Streamlit warns instead of degrading quietly

**Null handling:**

- No filter active: all rows pass (nulls included)
- Positive filter applied: null rows excluded by default
- `is null` / `is not null` operators available on all filter types
- Multiselect: "(Blanks)" appears as a selectable option if column has nulls

**Performance and reruns:**

- The DataFrame is never sent to the browser; only filter metadata crosses the wire
- Handles 1M+ rows without startup delay, and high-cardinality columns search server-side
- For large data, wrap the filter bar in `@st.fragment` so a filter interaction re-executes
  only the fragment, and use `@st.cache_data` for the data load above it. At 10M rows, where
  filtering itself costs several hundred milliseconds, this becomes necessary, not advisory
- `st.form` also works, with pills updating locally and the returned DataFrame changing only on
  submit. It defers the cost instead of removing it, and is not the recommended pattern

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

**With explicit configuration** — see [Column configuration](#column-configuration).

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
        "status": {"type": "select", "operator": "is", "values": ["active"]},
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
    st.toast(f"Filtering on: {state.filtered_columns}")


filtered = st.filter_bar(df, key="my_filter", on_change=on_filter_change)
```

### Warehouse-scale data

Filtering happens in the Streamlit process, so `data` must be a frame that fits in memory.
Unevaluated sources follow the same thresholds `st.dataframe` already uses for them, so the two
elements agree on what is safe to pull into the process:

| Source | Behavior |
|---|---|
| Row count known, at or below 10,000 | Materialized and filtered normally, as `st.dataframe` does |
| Row count known, above 10,000 | Raises, naming the pattern below |
| Row count unknown | Raises, since nothing establishes that materializing is safe |

Raising beats materializing at scale because pulling an 80M-row Snowpark table to return 4,000 rows
presents as a hang with no explanation. Lazy `st.dataframe` resolves the same dilemma the same way:
it disables search instead of filtering only the loaded chunks, since a mask over a subset returns
silently wrong rows.

Until filtering can push down to the query layer, warehouse-backed apps drive the UI from cheap
distinct values and translate the state themselves:

```python
# One cheap query supplies the pickers
dims = conn.query("select distinct region, segment, status from orders")
st.filter_bar(dims, key="f")

# The real query stays in the warehouse
where = build_where(st.session_state["f"].filters)
rows = conn.query(f"select * from orders where {where} limit 1000")
```

Pass-through is deferred, not precluded. The return contract is already
`DataFrameLike -> DataFrameLike`, so a lazy source in and out needs no signature change.

### Edge Cases

| Scenario | Behavior |
|---|---|
| Empty DataFrame | Widget renders, no filters can be added |
| All rows filtered out | Returns empty DataFrame (0 rows, same columns) |
| Very wide DataFrame (50+ columns) | Column picker shows all; chips wrap |
| `columns` contains name not in DataFrame | Raises `StreamlitAPIException` |
| Input data changes (same schema) | Filter state persists |
| Input schema changes | Filters for removed columns dropped; others persist |
| Range min > max | No blocking validation; produces zero results (user sees immediately) |
| Duplicate column names | Raises `StreamlitAPIException`. Filter state is keyed by column name, so duplicates cannot be addressed unambiguously |
| Index column | Not filterable. Unlike `column_config`, `columns` does not accept `"_index"`; reset the index first to filter on it |
| Two filter bars, same data, no `key` | Raises `DuplicateWidgetID`, as with any two identical widgets. Pass distinct `key` values |
| `disabled` names a column not in the DataFrame | Raises `StreamlitAPIException`, consistent with `columns` |
| `default` set alongside a pre-existing `st.session_state[key]` | Session State wins and Streamlit warns, matching other widgets |

### Design

The filter bar follows the chip/pill pattern seen in Notion and Attio, reusing existing
Streamlit chip, popover, and dropdown styling in both light and dark themes. Chips carry the
column name and a summarized value; `+ Add filter` uses secondary/ghost button styling; the
column picker shows type-indicator icons per column.

Visual specs: [Figma design system](https://www.figma.com/design/svukmRMf0N9yQzdv8f7sgO/Streamlit-Open-Source-design-system?node-id=3437-9926).

The pill row is keyboard navigable, filter changes are announced to screen readers, and
animations respect `prefers-reduced-motion`.

### Comparison

| Approach | Filtering logic | UI | Composability |
|---|---|---|---|
| `st.filter_bar(df)` (proposed) | Built-in, type-aware | Chips/pills with popovers | Drives any downstream element |
| Manual widgets | User-written | Separate widgets | Full control, verbose |
| `st.data_editor` selection | Row selection only | Checkbox column | Tightly coupled to table |
| Community: `streamlit-dynamic-filters` | User-written mask | Auto-generated widgets | DataFrame-only |

## Alternatives Considered

### API shape and return value

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

### Configuration vocabulary

**Option A: Reuse `st.column_config.*`** ✅ PREFERRED

```python
st.filter_bar(df, columns={"price": st.column_config.NumberColumn(min_value=0)})
```

Pros:
- One vocabulary for facts `column_config` already expresses
- Invalid combinations are unrepresentable — `NumberColumn(options=[...])` cannot be written
- Per-column `help` and the `{"col": "Label"}` shorthand come free
- The same mapping moves to `column_config=` unchanged when table filtering ships

Cons:
- Accepts a config type carrying table-only fields it ignores (`width`, `pinned`, `alignment`)
- Must raise for the ten column types with no filter meaning
- Needs an additive field on `ColumnConfig`, a shared public type

**Option B: A dedicated top-level `FilterConfig`**

```python
st.filter_bar(df, columns={"price": FilterConfig(type="range", min_value=0)})
```

Pros: Self-contained; no change to a shared type; no ignored fields
Cons: Restates `options`, `min_value`/`max_value`, `format_func`, `label`, and `help`, leaving
two vocabularies for the same facts and forcing double declaration once table filtering ships;
`FilterConfig(type="range", options=[...])` is representable but meaningless

**Option C: A `st.filter_config.*` class family**

Pros: Same type-safety benefit as Option A
Cons: Duplicates ten-plus public classes that already exist as `st.column_config.*`

## Decisions for Review

These are the choices we want input on: the ones a reviewer might reasonably land differently, or
that get expensive to change once apps depend on them. Other design decisions are documented inline
in the sections above alongside their reasoning. Each row carries the recommendation, the reasoning,
and anything it needs beyond this review.

| # | Decision | Recommendation | Why | Needs |
|---|---|---|---|---|
| 1 | Per-column configuration | Reuse the existing `st.column_config.*` classes; filter-only knobs go in a new optional `ColumnConfig.filter` field | One vocabulary instead of two for facts `column_config` already carries; encoding the filter type as a class makes invalid combinations unrepresentable; the same mapping later moves to `column_config=` unchanged if table filtering ships | **Sign-off from the `column_config` owners** — this adds a field to a shared public type, expressible in `st.dataframe`/`st.data_editor` and inert there until table filtering exists |
| 2 | Filter logic | AND only, with no user-facing AND/OR control. Ships standalone; `st.dataframe` integration is separate later work | No comparable ships a global toggle (table below). A global toggle also gets *less* useful as filters multiply, and it is the shape we would want to replace with grouped logic later — adding an affordance is additive, removing a shipped one is a regression. Within-field OR still ships via multiselect and `between` | — |
| 3 | Apply timing | Live only. No `mode="live" \| "batch"` parameter | Standard Streamlit widget behavior, and `@st.fragment` is the cost lever — it removes the cost rather than deferring it. Power BI and Tableau also apply immediately by default and treat an Apply button as an opt-in for expensive queries | — |
| 4 | Cardinality | A value picker at every size. Free text only for prose columns; how many options render is internal, not a parameter | A threshold that flips a column to text search changes the filter's *semantics* at a low boundary, which no comparable does — Metabase and Tableau both keep a picker at high cardinality and change only how options are fetched. The cost that motivates such a rule is rendering, so it bounds rendered rows instead | — approvable as written. The cap's value is set during implementation, once the popover's per-row render cost is profiled |
| 5 | Collapsing | None in V1 — neither an `expanded` parameter nor a runtime disclosure control | The collapsed states come from the runtime control rather than the parameter, so this is one decision and not two. Narrow containers are handled by pill overflow instead, at two design states rather than four | **Design confirmation** |
| 6 | Conditions per column | One condition per column, with the text filter accepting several terms | Excel and Power BI both offer a two-condition builder in their normal flow, but the gap here is narrower than it appears: `not between` already expresses disjoint numeric and date ranges, and multiselect already gives categorical OR. What remains is multi-term text matching, and letting `contains` take several terms closes it without an and/or selector or a second condition row in five popovers | — |
| 7 | Relative date ranges | Two dropdowns, `this`/`last`/`next`/`past` and day/week/month/quarter/year, with a count that appears only for `past`. The direction word decides calendar versus trailing: "last month" is July, "past 30 days" is the trailing window | Notion ships this grid with no count. Power BI adds a count but separates calendar units (`Months` versus `Months (Calendar)`), which needs nine unit entries and has to suppress nonsense combinations. Putting the distinction in the direction word reads the way the phrases already read. This shape is ours rather than borrowed, which makes it the most novel thing in the spec and the most worth a second opinion | — |
| 8 | Filter state contract | Column filters nested under `filters`, with `meta` alongside. Assignment to `st.session_state[key]` is supported and validated. Exported from `streamlit.typing` | Nesting stops user column names colliding with helpers or reserved keys, so `_id` and `_source` columns filter normally. Assignment is what makes presets, chart-click-to-filter, and a reset button buildable in app code before any of them ship. Apps that read this shape freeze it, so it is costly to change later | — |
| 9 | Unevaluated sources | Follow `st.dataframe`'s thresholds: materialize at or below 10,000 known rows, raise above that or when the count is unknown | Filtering a subset returns silently wrong rows, and materializing an 80M-row table to return 4,000 presents as a hang. Matching `st.dataframe`'s line keeps sibling elements consistent instead of making `filter_bar` arbitrarily stricter | — |

Evidence for decision 2 — how comparable tools combine filters:

| Tool | Across fields | Within one field | Cross-field OR |
|---|---|---|---|
| Excel AutoFilter | AND — "filters are additive" | And/Or radio in Custom Filter | Separate Advanced Filter with a criteria range |
| Tableau | AND, no toggle between cards | Multi-value lists, Condition formula | Calculated field, set, or formula |
| Power BI | AND across fields | Basic vs Advanced filtering per field | DAX measure |
| Notion | Per-group AND/OR, nested 3 deep | Multi-select values | Behind "Add advanced filter" — explicitly no global toggle |

Notes:

- Decision 1's trade-offs against the alternatives are in
  [Configuration vocabulary](#configuration-vocabulary), the mechanics in
  [Column configuration](#column-configuration), and the payoff in
  [Integration path](#integration-path). The integration payoff is a wager: if table filtering
  never ships, the consistency win stands and the migration win is lost.
- Also confirmed out of scope: grouped AND/OR, and cascading/dependent filters — the latter being
  the highest-priority follow-up, and notably Tableau's own recommendation for high-cardinality
  fields.
- Decision 5 would be revisited if design finds that a sidebar bar with six or more pills is not
  adequately served by pill overflow.

## Out of Scope (Future Work)

**High priority (expected BI demand):**

- **Cascading / dependent filters**: Selecting "Country=US" narrows "City" options to US
  cities. Tableau's own recommendation for high-cardinality fields is sequential filters with
  "Only Relevant Values", which makes this the most-requested shape. The likely design is
  deriving a column's options from the already-filtered frame with an opt-out, rather than a
  `depends_on` field — it needs a design pass for options vanishing mid-interaction and for
  widening a filter after narrowing.
- **A general two-condition builder per column**, with a per-column and/or selector as Excel and
  Power BI offer. V1 covers the cases that motivate it — multi-term `contains`, `not between` for
  disjoint ranges, multiselect for categorical OR — so what is left is combinations like "starts
  with A and ends with B", which are rare.
- **Applying one filter set to a second DataFrame**: comparing actuals against a target or budget
  table at a different grain needs the same conditions applied to both. The state is documented
  and readable so apps can do this themselves, and for dimension filters
  `targets[targets.region.isin(filtered.region.unique())]` covers it; a first-class
  `state.apply(other_df)` would remove the hand-rolling. Deferred because Streamlit apps
  normally reshape data in `@st.cache_data` before filtering, so this pressure is lower here than in
  Tableau or Sigma. No widget-state object carries methods today either, so it would set a new
  pattern. Additive whenever we want it.
- **Sub-day relative ranges and regex text matching**: "past 15 minutes" and case-sensitive or
  regex `contains`, both needed for live incident triage.
- **Viewer-selectable anchor dates**: letting a viewer pick the date a relative range counts back
  from, as Tableau allows. Fixing the anchor makes the range static, so it is already expressible
  as `between X and Y`; the value is arithmetic convenience, which belongs on the absolute path
  instead of as a mode of the relative operator. The dynamic anchors ship in V1 via
  `FilterConfig(anchor=...)`.
- **Fiscal calendars**: a configurable fiscal-year start, so "this quarter" follows a company's
  FY instead of the calendar.

**Medium priority:**

- **`st.dataframe` integration**: Embedded filter bar via `filterable=True`. Addresses
  [#6272](https://github.com/streamlit/streamlit/issues/6272) (63 upvotes),
  [#1879](https://github.com/streamlit/streamlit/issues/1879) (33 upvotes). See
  [Integration path](#integration-path).
- **Cross-field OR**: no comparable exposes this as a flat toggle; if built, the shape is
  Notion-style nested groups behind an explicit advanced affordance. Cheap to add later — no
  state migration is needed. The real work is defining "unconfigured filter" per filter type: an
  unset filter currently matches every row, which is correct as "no constraint" under AND but
  would make an OR union match everything.
- **Server-side / SQL pass-through filtering**: pushing predicates down so filtering happens at
  the query layer. This should ride the existing lazy-dataframe adapter system instead of building a
  parallel one — that system already delivers chunked rows and server-side *sorting* over Snowpark
  and Polars `LazyFrame`, the same shape of translation filtering needs. The lazy-load work deferred
  server-side filtering partly because no filtering UI existed yet, so the two halves meet here.
  Polars `LazyFrame` is the cheapest entry point: predicate application needs no SQL translation.
- **List / tags filters**: `MultiselectColumn` and `ListColumn` hold multiple values per cell
  and need "has any of" / "has all of" mask semantics.

**Lower priority:**

- **Saved filter presets**: Named filter combinations with a dropdown switcher. Buildable in app
  code meanwhile, because filter state can be read and assigned.
- **Collapsible filter bar**: an `expanded` parameter plus the runtime disclosure control.
- **`placeholder`**: custom empty-state text.
- **Custom filter types**: User-defined filter UIs (component v2 integration).
- **Per-filter row count badge**: how many rows each individual pill removes — the bar-level
  count ships in V1, but per-pill counts require re-filtering once per filter.
- **Cross-widget filtering**: Chart click → add filter as a built-in. Buildable in app code
  meanwhile by assigning filter state from a chart selection event.
- **Select inverse for multiselect**: Quick "Invert" action.
- **Drag-to-reorder pills**: `dnd-kit` integration.
- **`st.data_editor` integration**: blocked, not merely deferred — mapping edits back to source
  rows through a filtered view needs stable row identity.

## Checklist

| Item                       | ✅ or comment                                    |
|----------------------------|--------------------------------------------------|
| Works on SiS, Cloud, etc?  | ✅ Yes — no platform-specific behavior. Option loading and search for high-cardinality columns use the existing backend round-trip mechanism, so they follow the same path as lazy dataframe loading. Narrow-viewport/mobile layout still needs a design pass |
| No breaking API changes    | ✅ Additive — new widget, plus a new optional `filter` field on `ColumnConfig` (needs review by `column_config` owners) |
| No new dependencies        | ✅ Yes — reuses existing dtype inference          |
| Metrics collected          | ✅ Yes — new `filter_bar` command metric          |
| Any security/legal impact? | ✅ None                                           |
| Any docs changes needed?   | ✅ Yes — API reference, filtering patterns guide  |
