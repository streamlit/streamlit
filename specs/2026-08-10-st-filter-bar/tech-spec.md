---
author: mayagbarnes
created: 2026-08-10
---

# `st.filter_bar` — Internal Architecture

## Summary

This spec covers the internal architecture for `st.filter_bar`: the protobuf wire format,
backend widget registration and filtering execution, frontend component structure and state
management, and performance optimizations. For the user-facing API, behavior, and design,
see the [product spec](./product-spec.md).

## Problem

Streamlit has no built-in proto message or widget infrastructure for column-level filtering.
The closest analog — `st.data_editor` — serializes the entire DataFrame over WebSocket and
handles cell-level edits, which is architecturally wrong for a filter widget that only needs
to exchange metadata (column types, option lists, bounds) and filter state (user selections).

Key technical gaps:

- No proto message for filter metadata (column types, option values, min/max bounds)
- No widget serde pattern for "list of active filters" state
- No lazy option-loading mechanism for high-cardinality columns without triggering a full
  script rerun
- No established pattern for schema-based (rather than data-based) widget identity in
  data-centric widgets

## Proposal

### Proto Definition

A new `FilterBar.proto` file defines the forward message (server → client):

```protobuf
syntax = "proto3";
package streamlit.proto;

import "streamlit/proto/Common.proto";

message FilterBar {
  string id = 1;
  string form_id = 2;
  optional string label = 3;
  LabelVisibilityMessage label_visibility = 4;
  optional string help = 5;
  optional string placeholder = 6;
  bool expanded = 7;
  bool disabled = 8;
  repeated string disabled_columns = 9;
  sint32 width = 10;
  repeated FilterColumnMeta columns = 11;
  optional string default_state = 12;
  optional string bind = 13;
}

message FilterColumnMeta {
  string name = 1;
  FilterType filter_type = 2;
  repeated string operators = 3;
  string column_data_kind = 4;
  // Populated lazily — only after user selects this column
  repeated string options = 5;
  optional double min_value = 6;
  optional double max_value = 7;
  bool server_search = 8;
  optional string custom_label = 9;
}

enum FilterType {
  FILTER_TYPE_UNSPECIFIED = 0;
  FILTER_TYPE_MULTISELECT = 1;
  FILTER_TYPE_TEXT = 2;
  FILTER_TYPE_RANGE = 3;
  FILTER_TYPE_DATE_RANGE = 4;
  FILTER_TYPE_DATETIME_RANGE = 5;
  FILTER_TYPE_TIME_RANGE = 6;
  FILTER_TYPE_TOGGLE = 7;
}
```

Registration in `Element.proto` (next available field in the `type` oneof):

```protobuf
FilterBar filter_bar = <next_field>;
```

The widget state (client → server) uses `WidgetState.string_value` — a JSON-serialized
string matching the `DataEditorSerde` pattern. This avoids defining a new proto for
mutable filter state and keeps the format flexible during iteration.

### Backend Implementation

#### Widget Registration and Serde

```python
class FilterBarSerde:
    def deserialize(self, ui_value: str | None) -> FilterBarState:
        if ui_value is None:
            return FilterBarState(filters=[], selected_columns=[])
        data = json.loads(ui_value)
        return FilterBarState(
            filters=data.get("filters", []),
            selected_columns=data.get("selected_columns", []),
            search_query=data.get("search_query"),
        )

    def serialize(self, state: FilterBarState) -> str:
        return json.dumps(state.to_dict(), default=str)
```

`FilterBarState` is a `ReadOnlyAttributeDictionary` with:

| Field | Type | Description |
|-------|------|-------------|
| `filters` | `list[dict]` | Active filters: `[{column, operator, value}]` |
| `selected_columns` | `list[str]` | Columns the user has opened (triggers lazy option loading) |
| `search_query` | `dict[str, str] \| None` | Per-column search input for server-side search |

Widget registration follows the `data_editor` pattern:

```python
serde = FilterBarSerde()
widget_state = register_widget(
    element_id,
    on_change_handler=on_change,
    args=args,
    kwargs=kwargs,
    deserializer=serde.deserialize,
    serializer=serde.serialize,
    value_type="string_value",
)
```

#### Element ID / Signature

The element ID is computed from structural metadata — NOT data content:

```python
def _compute_filter_bar_signature(
    data_df: pd.DataFrame,
    dataframe_schema: dict[str, ColumnDataKind],
    user_key: str | None,
) -> str:
    h = create_fast_hasher()
    h.update(b"filter_bar")
    if user_key:
        h.update(user_key.encode())
    for col_name in sorted(data_df.columns):
        h.update(col_name.encode())
        h.update(dataframe_schema[col_name].value.encode())
    h.update(str(len(data_df.columns)).encode())
    return h.hexdigest()
```

This means:
- Data value changes (new rows, updated values) do NOT reset filter state
- Schema changes (column added/removed/renamed, type changed) trigger a state reset
- Follows `_compute_data_editor_signature` pattern from `data_editor.py`

#### Schema Detection and Filter Metadata

Reuses the existing `determine_dataframe_schema()` from `column_config_utils.py` which
returns `dict[str, ColumnDataKind]`. A static mapping converts to filter types:

```python
_FILTER_TYPE_MAPPING: Final[dict[ColumnDataKind, FilterType]] = {
    ColumnDataKind.STRING: FilterType.MULTISELECT,  # or TEXT if high cardinality
    ColumnDataKind.BOOLEAN: FilterType.TOGGLE,
    ColumnDataKind.INTEGER: FilterType.RANGE,
    ColumnDataKind.FLOAT: FilterType.RANGE,
    ColumnDataKind.DECIMAL: FilterType.RANGE,
    ColumnDataKind.DATE: FilterType.DATE_RANGE,
    ColumnDataKind.DATETIME: FilterType.DATETIME_RANGE,
    ColumnDataKind.TIME: FilterType.TIME_RANGE,
    # Excluded types (LIST, DICT, BYTES, COMPLEX) not in mapping → not filterable
}
```

**Performance**: `determine_dataframe_schema()` is O(1) per well-typed column via
Arrow/pandas dtype inspection. For `object`-dtype columns it falls back to
`pandas.api.types.infer_dtype()` which scans values — O(rows). The implementation caches
the schema result keyed by `(id(df), df.shape)` so subsequent reruns with the same
DataFrame skip re-computation. This departs from `st.data_editor` which recomputes on
every rerun.

**Single Arrow conversion**: convert to PyArrow table once and derive both `ColumnDataKind`
mapping and filter metadata from that conversion (following `data_editor.py` line 1222).
The Arrow schema is the canonical source for type classification.

#### Lazy Cardinality and Options

Options (unique values for multiselect) are NOT computed eagerly for all columns:

1. **Initial render**: only column names + type icons sent (from cheap schema detection)
2. **Column selected**: when frontend reports a column in `selected_columns`, backend
   computes `unique()` for that column and includes it in `FilterColumnMeta.options`
3. **Caching**: unique values cached per column keyed by `(column_name, id(df), df.shape)`,
   reused across reruns until DataFrame changes

For columns with >1,000 unique values:
- `FilterColumnMeta.server_search = true` is set
- Only the top 1,000 values are shipped in `options`
- When `search_query[column]` is set, backend filters `unique()` with the query and
  returns matching values in the next rerun's proto

This avoids multi-second startup on wide DataFrames (e.g., 10M rows × 20 columns would
require 20 × `nunique()` calls eagerly).

#### Filter Execution

```python
def _apply_filters(
    df: pd.DataFrame,
    filters: list[dict],
) -> pd.DataFrame:
    if not filters:
        return df

    mask = pd.Series(True, index=df.index)
    for f in filters:
        col = f["column"]
        op = f["operator"]
        val = f["value"]
        mask &= _apply_single_filter(df[col], op, val)

    return df[mask]
```

Per-filter-type mask functions use vectorized pandas/numpy operations:

| Filter Type | Operator | Implementation |
|-------------|----------|----------------|
| Multiselect | is | `col.isin(values)` |
| Multiselect | is not | `~col.isin(values)` |
| Text | contains | `col.str.contains(val, case=False, na=False)` |
| Text | equals | `col == val` |
| Range | between | `col.between(min_val, max_val)` |
| Range | greater than | `col > val` |
| Toggle | is true | `col == True` |
| Date range | between | `col.between(start, end)` |

**Null handling**: nulls are excluded by positive filters (`isin`, `between`, `contains`)
via pandas' default NA behavior. Explicit `is null` / `is not null` operators are
supported on all types via `col.isna()` / `col.notna()`.

**Mask composition**: O(N × M) for N filters on M rows. pandas/numpy boolean operations are
vectorized and cache-efficient — 20 filters on 10M rows completes sub-second.

#### Input Conversion and Type Preservation

For non-pandas inputs (Polars, Arrow, etc.):

```python
data_df, data_format = convert_df_to_pandas(data)  # O(n) for non-pandas
# ... compute schema, apply filters ...
filtered_df = _apply_filters(data_df, filters)
return convert_pandas_df_to_data_format(filtered_df, data_format)
```

`convert_anything_to_pandas_df` runs on every rerun. For apps with expensive inputs,
documentation recommends `@st.cache_data` wrapping the data load.

### Frontend Implementation

#### Component Structure

```
frontend/lib/src/components/widgets/FilterBar/
├── FilterBar.tsx              # Top-level (React.memo wrapped)
├── FilterBar.test.tsx
├── FilterChip.tsx             # Individual filter chip/pill
├── ColumnPicker.tsx           # "Add filter" dropdown
├── FilterPopover.tsx          # Edit popover (dispatches to type-specific UIs)
├── filters/
│   ├── MultiselectFilter.tsx
│   ├── TextFilter.tsx
│   ├── RangeFilter.tsx
│   ├── DateRangeFilter.tsx
│   └── ToggleFilter.tsx
└── hooks/
    ├── useFilterBarState.ts   # State management + debounce
    └── useOptionSearch.ts     # Client/server-side option search
```

The top-level component is wrapped in `React.memo()` matching `DataFrame.tsx:1492`.

#### State Management Hook

`useFilterBarState.ts` manages local filter state and syncs to the backend:

```typescript
const DEBOUNCE_TIME_MS = 150  // matches st.data_editor

interface FilterBarState {
  filters: FilterDescriptor[]
  selectedColumns: string[]
  searchQuery: Record<string, string>
}

function useFilterBarState(element: FilterBarProto, widgetMgr: WidgetStateManager) {
  const [state, setState] = useState<FilterBarState>(initialState)

  const syncToBackend = useDebouncedCallback(() => {
    widgetMgr.setStringValue(element.id, JSON.stringify(state.toWire()))
  }, DEBOUNCE_TIME_MS)

  // ... state mutation methods that call syncToBackend ...
}
```

**`elementHash` memoization**: option lists and derived state use `useMemo` keyed by the
proto's content hash (computed upstream by the Streamlit runtime). When filter metadata
hasn't changed between reruns, the frontend skips re-processing entirely — same pattern
as `DataFrame.tsx:167-183`.

#### Include/Exclude Optimization

Multiselect filter state uses a compact wire representation:

```typescript
interface MultiselectValue {
  mode: "include" | "exclude"
  values: string[]
}
// undefined = all selected (no filter active)
```

The frontend decides the smallest representation:
- User selects 3 of 1000 → `{mode: "include", values: ["A", "B", "C"]}`
- User deselects 2 of 1000 → `{mode: "exclude", values: ["X", "Y"]}`
- All selected → `undefined` (filter removed)

This minimizes wire payload and makes state diffs cheap. Follows the `DimensionFilter`
pattern from `streamlit-pivot-table`.

**Stale value cleanup**: when the underlying data changes and a previously-excluded value
no longer exists in the column's unique set, the stale value is silently dropped from the
exclude list on the next rerun. The backend performs this reconciliation during filter
application:

```python
def _reconcile_multiselect(filter_desc: dict, current_options: set[str]) -> dict:
    if filter_desc.get("mode") == "exclude":
        # Drop exclude values that no longer exist in the data
        valid_excludes = [v for v in filter_desc["values"] if v in current_options]
        if not valid_excludes:
            return None  # No valid excludes → remove filter entirely
        filter_desc["values"] = valid_excludes
    elif filter_desc.get("mode") == "include":
        # Drop include values that no longer exist
        valid_includes = [v for v in filter_desc["values"] if v in current_options]
        if not valid_includes:
            return None  # No valid includes → remove filter entirely
        filter_desc["values"] = valid_includes
    return filter_desc
```

This follows the same pattern as schema-change cleanup (stale column filters dropped)
but at the value level.

#### Two-Tier Option Rendering

Option lists use plain DOM rendering with client-side search — the industry-standard
pattern (Notion, MUI Autocomplete, Mantine, React Select, Tableau, Looker):

| Tier | Cardinality | Behavior |
|------|-------------|----------|
| Client-side | ≤1,000 unique values | All values shipped to frontend, rendered as plain DOM in scrollable list. Client-side `filter()` narrows visible set as user types. |
| Server-side | >1,000 unique values | Top 1,000 shipped initially. Search input triggers debounced (150ms) state update with `search_query[column]`. Backend computes filtered options on next rerun. |

Virtualization is intentionally omitted — modern browsers handle 1,000 checkbox items
without jank, and virtualization adds complexity (scroll position restoration, variable
heights, keyboard navigation edge cases) without proven benefit at this scale.

#### Query Params Binding

When `bind="query-params"` is set, filter state is persisted in the URL:

```
?filter_status=is:active,pending&filter_price=lt:30&filter_date=between:2024-01-01,2024-12-31
```

Format: `filter_{column}={operator}:{value(s)}` — multiple values comma-separated.

Bidirectional sync:
- Filter change → URL update (via `pushState`, no page reload)
- URL change (e.g., shared link opened) → filter state hydrated on first render
- Reuses existing `bind="query-params"` infrastructure from `st.multiselect`

Edge cases:
- Column names with special characters are URL-encoded
- Filter types that can't be URL-serialized (e.g., complex ranges) fall back to session
  state only
- Stale URL params (referencing columns not in current DataFrame) are silently dropped

**Implementation risks and open questions:**

The existing `bind="query-params"` infrastructure (used by `st.multiselect`, `st.slider`,
etc.) handles simple value types — flat strings and lists. `st.filter_bar` needs a richer
serialization: multiple filters, each with column + operator + value(s). This may require:

1. **Custom serializer/deserializer** for the query-param layer. The current
   `register_widget` query-param handling may need extension to support structured state.
   Needs validation during implementation — if the existing plumbing can't accommodate it,
   query-param binding may slip to a fast-follow rather than V1.

2. **Commas in values**: the proposed `is:active,pending` format breaks if a value itself
   contains a comma. Mitigation: URL-encode commas within values (`%2C`) while using raw
   commas as delimiters. Alternatively, use a different delimiter (pipe `|`) or switch to
   JSON-encoded values.

3. **URL length limits**: browsers cap URLs at ~2,000–8,000 characters. With many active
   filters on high-cardinality columns, the URL could exceed this. Mitigation: if
   serialized filter state exceeds 1,500 characters, fall back to session-state-only and
   log a warning. The URL should degrade gracefully, not error.

4. **Round-trip fidelity**: date/datetime values must survive URL serialization without
   precision loss. Use ISO 8601 format (`2024-01-15T09:30:00`) for all temporal values.

If validation during implementation reveals that the existing `bind` plumbing requires
significant changes, query-param support should be scoped as a fast-follow (V1.1) rather
than blocking V1 launch.

### Forward Message Deduplication

The Streamlit runtime's `forward_msg_cache.py` automatically hashes each `ForwardMsg`.
For `st.filter_bar`:

- **No-op reruns** (user interacted with an unrelated widget): filter metadata proto is
  identical → only `ref_hash` sent. Essentially free.
- **Lazy option load** (user selected a new column): proto changes (new `options` field
  populated) → full proto sent once, then cached for subsequent reruns.
- **Filter state change**: the proto itself doesn't change (filter state lives in
  `WidgetState`, not the element proto). No re-send needed.

This means that after initial render + one column selection, the `st.filter_bar` element
contributes near-zero wire overhead on subsequent reruns.

### State Flow Diagram

```
[User adds/edits filter in browser]
  → useFilterBarState.setState(newFilters)
  → syncToBackend() [debounced 150ms]
  → widgetMgr.setStringValue(id, JSON.stringify(state))
  → BackMsg(rerun_script with WidgetStates)
  → Backend: FilterBarSerde.deserialize(json_string)
  → _apply_filters(df, state.filters) → filtered DataFrame
  → Build FilterBar proto (with lazy options for selected_columns)
  → populate_hash_if_needed() → if unchanged → send ref_hash
  → Frontend: resolve ref to cached proto, React.memo skips re-render
  → Return filtered DataFrame to user's script
```

For lazy option loading:
```
[User clicks "Add filter" → selects column "status"]
  → state.selectedColumns.push("status")
  → syncToBackend()
  → Backend sees "status" in selected_columns, computes unique()
  → FilterColumnMeta for "status" now has options populated
  → Proto hash changes → full proto sent (cached for next time)
  → Frontend renders multiselect with options
```

## Behavior Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Eager vs lazy metadata | Lazy per column | Avoids O(columns × rows) startup cost on wide DataFrames |
| State on schema change | Drop stale filters individually | Valid filters preserved; only orphaned column filters removed |
| Server-side search mechanism | Widget state `search_query` field (V1); `BackendOperationRequest` fallback path documented | Simpler for V1; can migrate without API change if latency is a problem |
| Widget state wire format | JSON string via `string_value` | Matches `st.data_editor` pattern; flexible during iteration |
| Include/exclude optimization | Frontend decides smallest representation | Reduces payload for "deselect few" pattern (common in BI) |
| Expanded/collapsed state | Frontend-only, not in widget value | UI chrome; doesn't affect filtering logic or trigger `on_change` |
| Element ID source | Schema signature (names + types) | Data changes don't reset state; only structural changes do |
| Debounce strategy | 150ms frontend-side | Matches `st.data_editor`; batches rapid toggling into one rerun |

## Testing Plan

**Python unit tests** (`lib/tests/streamlit/elements/widgets/filter_bar_test.py`):
- Serde round-trip: serialize → deserialize → serialize produces identical output
- Signature stability: same schema → same ID; different schema → different ID
- Filter mask correctness: one test per operator per filter type
- Null handling: nulls excluded by positive filters, included by `is null`
- Schema change cleanup: stale column filters dropped, valid filters preserved
- Type preservation: Polars in → filtered Polars out
- High cardinality: >1000 unique values triggers `server_search=true`
- Edge cases: empty DataFrame, all-null column, single-value column

**Frontend unit tests** (`FilterBar.test.tsx`, hook tests):
- Debounce behavior: rapid state changes produce one `setStringValue` call
- Include/exclude: picks smallest representation correctly
- Option search: client-side filtering for ≤1000, state update for >1000
- Chip rendering: correct label, operator, value display
- Keyboard navigation: Tab/Enter/Escape/Delete behaviors
- React.memo: no re-render when props unchanged

**E2E tests** (`e2e_playwright/st_filter_bar_test.py`):
- Add/edit/remove filter flow (multiselect, range, date, text, toggle)
- Multiple filters with AND logic
- Wide DataFrame (20+ columns) — column picker works
- High cardinality column — server-side search flow
- URL binding round-trip (set filter → URL changes → reload → filter restored)
- `@st.fragment` scoped rerun (filter change doesn't rerun full script)
- Type preservation (Polars input → Polars output)
- Disabled state (full and per-column)

**AppTest integration**:
- Programmatic state setting via `st.session_state[key]`
- `on_change` callback fires on filter add/modify/remove

## Alternatives Considered

**1. Metadata-only proto vs reusing Dataframe proto** ✅ Metadata-only (PREFERRED)

- Pros: Lightweight wire format; no unnecessary data serialization; clear separation of
  concerns
- Cons: New proto file to maintain
- Why not reuse `Dataframe`: filter_bar never displays data; sending Arrow bytes would be
  wasteful and architecturally misleading

**2. Lazy options via BackendOperationRequest vs widget state round-trip** ✅ Widget state (PREFERRED for V1)

- Pros (widget state): Simpler implementation; aligns with "each interaction triggers
  rerun" product model; no new backend operation handler
- Pros (BackendOperationRequest): No script rerun; faster for the user; proven pattern
  from lazy dataframe chunk loading
- Chosen for V1 because: simpler to implement and consistent with the product model.
  The lazy pattern still avoids the *startup* cost (options load on column selection,
  which is already a rerun trigger).

  **Fallback plan**: if user feedback post-V1 reveals that option loading is too slow
  for apps with expensive scripts (even with `@st.fragment`), the architecture supports
  migrating to `BackendOperationRequest` without API changes — the frontend would send a
  `DataframeChunkRequestPayload`-style message instead of updating widget state, and the
  backend would respond with options without triggering a rerun. The proto already has
  `FilterColumnMeta.options` as a repeated field, so the response format is the same
  regardless of delivery mechanism. This is a pure implementation change invisible to
  users.

**3. Separate FilterBar.proto vs extending Dataframe.proto** ✅ Separate file (PREFERRED)

- Pros: Separation of concerns; filter_bar has distinct lifecycle from data display;
  avoids bloating an already-complex proto
- Cons: One more proto file
- Rejected extending because: `Dataframe.proto` is already complex (14 fields, nested
  messages for lazy loading, selection, editing); adding filter semantics there would
  couple unrelated features

**4. Frontend-side type inference vs backend-side** ✅ Backend (PREFERRED)

- Pros: Reuses existing `ColumnDataKind` / `determine_dataframe_schema()` infrastructure;
  no duplication of type inference logic in TypeScript; backend has access to actual data
  for cardinality checks
- Cons: Requires a rerun to learn column types (acceptable since schema is sent eagerly)
- Rejected frontend-side because: would require duplicating the 17-kind type
  classification in TypeScript, including the `object`-dtype fallback logic

**5. Always-include vs include/exclude wire format** ✅ Include/exclude (PREFERRED)

- Pros: Dramatic payload reduction for "deselect 2 of 1000" patterns common in BI
  dashboards; cheaper state diffs
- Cons: Slightly more complex frontend serialization logic
- Rejected always-include because: a user deselecting 2 items from a 1000-item list
  would serialize 998 values — expensive to send, diff, and parse
