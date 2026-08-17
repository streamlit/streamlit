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

`proto/streamlit/proto/FilterBar.proto` defines the forward message (server → client):

```protobuf
syntax = "proto3";

import "streamlit/proto/LabelVisibility.proto";

message FilterBar {
  string id = 1;
  string form_id = 2;
  optional string label = 3;
  optional string help = 4;
  optional string placeholder = 5;
  bool expanded = 6;
  bool disabled = 7;
  repeated FilterColumnMeta columns = 8;
  bool set_value = 9;
  string value = 10;
  string default = 11;
  LabelVisibility label_visibility = 12;
  optional uint32 width = 13;
}

message FilterColumnMeta {
  string name = 1;
  FilterType filter_type = 2;
  string column_data_kind = 3;
  repeated string options = 4;
  optional double min_value = 5;
  optional double max_value = 6;
  bool server_search = 7;
  optional string custom_label = 8;
  repeated string operators = 9;
  bool disabled = 10;
  repeated string display_options = 11;  // format_func-generated labels
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

Key differences from the original design:
- Per-column `disabled` lives on `FilterColumnMeta` (field 10) rather than a separate
  `repeated string disabled_columns` on the parent message
- `set_value` / `value` / `default` pattern matches standard widget proto (like
  `st.text_input`) rather than a custom `default_state` field
- `bind` and `persist_state` use the framework's existing infrastructure (not in proto —
  handled at `register_widget` level)

Registration in `Element.proto` (next available field in the `type` oneof):

```protobuf
FilterBar filter_bar = <next_field>;
```

The widget state (client → server) uses `WidgetState.string_value` — a JSON-serialized
string matching the `DataEditorSerde` pattern. This avoids defining a new proto for
mutable filter state and keeps the format flexible during iteration.

### Backend Implementation

#### Widget Registration and Serde

The filter state is a flat JSON dict keyed by column name, with `_`-prefixed metadata.
Deserialization returns a `FilterBarState` typed object (see below):

```python
FilterState = dict[str, Any]

class FilterBarState(ReadOnlyAttributeDictionary):
    """Typed, read-only state object returned by st.session_state[key].

    Provides attribute access (dot notation) and dict access (bracket notation)
    to filter configuration. Nested dicts are auto-wrapped as
    ReadOnlyAttributeDictionary for deep dot-access.
    """

    @property
    def active_filters(self) -> list[str]:
        """Column names with active filter configurations."""
        return [k for k in self if not k.startswith("_")]

    @property
    def logic(self) -> str:
        """Current filter logic mode: 'and' or 'or'."""
        groups = self.get("_groups")
        if isinstance(groups, list) and len(groups) > 0:
            return groups[0].get("logic", "and")
        return self.get("_logic", "and")

class FilterBarSerde:
    def __init__(self, default: FilterState):
        self._default = default

    def deserialize(self, ui_value: str | None) -> FilterBarState:
        if ui_value is None or ui_value == "":
            return FilterBarState(self._default)
        try:
            return FilterBarState(json.loads(ui_value))
        except (json.JSONDecodeError, TypeError):
            return FilterBarState(self._default)

    def serialize(self, filter_state: FilterBarState) -> str:
        return json.dumps(dict(filter_state), default=str)
```

`FilterBarState` is exported from `streamlit` as `st.FilterBarState` for type annotations.
`FilterConfig` is also exported as `st.FilterConfig`.

**State shape** (groups-ready model):

```json
{
  "_groups": [{"logic": "and", "columns": ["status", "price"]}],
  "status": {"type": "multiselect", "operator": "is", "values": ["active"]},
  "price": {"type": "range", "operator": "between", "min": 10, "max": 500}
}
```

| Key pattern | Purpose |
|-------------|---------|
| `_groups` | AND/OR logic configuration (single group in V1, extensible to multi-group) |
| `_*` (any `_`-prefix) | Reserved metadata, preserved through state reconciliation |
| Column names | Per-filter state: `{type, operator, ...type-specific values}` |

Widget registration:

```python
serde = FilterBarSerde(default=default or {})
widget_state = register_widget(
    proto.id,
    on_change_handler=on_change,
    args=args,
    kwargs=kwargs,
    deserializer=serde.deserialize,
    serializer=serde.serialize,
    ctx=ctx,
    value_type="string_value",
    bind=bind,
    clearable=True,
    persist_state=persist_state,
)
```

- `bind="query-params"`: uses the framework's existing bind infrastructure. The JSON
  `string_value` is stored as a single URL parameter (key derived from widget key/id).
  This is the industry-standard approach for complex filter state in URLs (same pattern
  as Apache Superset and nuqs).
- `clearable=True`: allows the widget state to be cleared back to default.
- `persist_state`: wires through to the framework's page/session persistence layer.

#### Element ID / Signature

The element ID is computed from structural metadata — NOT data content:

```python
def _compute_filter_bar_signature(
    schema: dict[str, ColumnDataKind],
) -> str:
    hasher_input = "|".join(
        f"{col}:{kind.value}" for col, kind in sorted(schema.items())
    )
    return calc_hash(hasher_input)
```

The signature is then passed to `compute_and_register_element_id()` as `schema_signature`.

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

#### Option Loading Strategy

V1 computes options eagerly for all eligible columns on each rerun. The implementation
uses a cardinality threshold (`_TEXT_FILTER_CARDINALITY_THRESHOLD = 100`) to decide
between multiselect and text filter:

1. **Multiselect** (≤100 unique values): all unique values sent in `FilterColumnMeta.options`
2. **Text filter** (>100 unique values): no options sent; uses free-text input with operators
3. **Server search** (>1000 values with multiselect forced via `FilterConfig`):
   `FilterColumnMeta.server_search = true`, first 1000 options sent

This eager approach is simpler than the lazy pattern originally proposed. Performance
impact is acceptable because:
- `determine_dataframe_schema()` is O(1) per well-typed column
- `unique()` runs only for string columns below the cardinality threshold
- Wide DataFrames are bounded by the number of filterable columns (not rows)

**Future optimization:** If startup latency becomes a problem on very wide DataFrames,
the architecture supports lazy loading (compute options only when user opens a filter's
popover) without API changes.

#### Filter Execution

```python
def _apply_filters(data_df: pd.DataFrame, filter_state: FilterBarState) -> pd.DataFrame:
    if not filter_state:
        return data_df

    logic = _get_filter_logic(filter_state)  # Groups-ready: reads _groups[0].logic
    use_or = logic == "or"

    if use_or:
        combined_mask = pd.Series(False, index=data_df.index)
    else:
        combined_mask = pd.Series(True, index=data_df.index)

    for col_name, filter_config in filter_state.items():
        if col_name.startswith("_"):  # Skip metadata keys
            continue
        if col_name not in data_df.columns:
            continue

        col_mask = _apply_single_filter(data_df, col_name, filter_config)

        if use_or:
            combined_mask |= col_mask
        else:
            combined_mask &= col_mask

    return data_df[combined_mask]
```

Per-filter-type mask functions use vectorized pandas/numpy operations:

| Filter Type | Operator | Implementation |
|-------------|----------|----------------|
| Multiselect | is | `col.astype(str).isin(values)` |
| Multiselect | is_not | `~col.astype(str).isin(values)` |
| Text | contains | `col.str.contains(val, case=False, na=False, regex=False)` |
| Text | equals | `col == val` |
| Text | starts_with | `col.str.startswith(val, na=False)` |
| Text | ends_with | `col.str.endswith(val, na=False)` |
| Range | between | `(col >= min) & (col <= max)` |
| Range | greater_than | `col > val` |
| Range | less_than | `col < val` |
| Range | equals | `col == val` |
| Toggle | is_true | `col == True` |
| Toggle | is_false | `col == False` |
| Date range | between | `(col >= start) & (col <= end)` |
| Date range | before | `col < val` |
| Date range | after | `col > val` |
| All types | is_null | `col.isna()` |
| All types | is_not_null | `col.notna()` |

**Null handling**: nulls are excluded by positive filters (`isin`, `between`, `contains`)
via pandas' default NA behavior. `is_null` / `is_not_null` operators use `col.isna()` /
`col.notna()` and are checked first (before type-specific dispatch).

**AND/OR logic**: The combined mask starts as `True` (AND) or `False` (OR). Per-column
masks are combined with `&=` (AND) or `|=` (OR). The `_get_filter_logic()` helper reads
from `_groups[0].logic` in the groups-ready state model, falling back to the legacy
`_logic` key for backward compatibility:

```python
def _get_filter_logic(filter_state: FilterBarState) -> str:
    groups = filter_state.get("_groups")
    if isinstance(groups, list) and len(groups) > 0:
        return groups[0].get("logic", "and")
    return filter_state.get("_logic", "and")
```

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

#### `format_func` → `display_options` Computation

When a column has `FilterConfig(format_func=...)`, the backend eagerly computes display
labels during proto construction and ships them in `FilterColumnMeta.display_options`:

```python
if filter_config.format_func is not None:
    meta.display_options[:] = [
        str(filter_config.format_func(v)) for v in meta.options
    ]
```

`display_options` is index-aligned with `options` — the frontend renders
`display_options[i]` as the label but sends `options[i]` as the value in filter state.
When `display_options` is empty (no format_func), the frontend uses the raw option values
as labels. The format_func runs once per rerun during proto build, not per-interaction.

#### Per-Column Disabled Propagation

The `disabled` parameter accepts `bool | Sequence[str]`. During proto construction:

```python
if isinstance(disabled, bool):
    proto.disabled = disabled  # top-level disabled (entire widget)
    # Individual FilterColumnMeta.disabled left as default (False)
else:
    disabled_set = set(disabled)
    for col_meta in proto.columns:
        col_meta.disabled = col_meta.name in disabled_set
```

When `proto.disabled = True` (full widget), the frontend grays out all pills and hides
the "Add filter" button. When individual `FilterColumnMeta.disabled = True`, only those
specific pills are non-interactive (no click-to-edit, no `×` button) and the column is
unavailable in the column picker.

#### Relative Date Resolution

Relative date operators (`today`, `past_7_days`, `this_month`, etc.) are resolved
server-side on each rerun — the filter state stores only the operator name, not computed
dates:

```python
def _resolve_relative_date_range(operator: str) -> tuple[date, date]:
    today = date.today()
    match operator:
        case "today":
            return (today, today)
        case "past_7_days":
            return (today - timedelta(days=7), today)
        case "past_30_days":
            return (today - timedelta(days=30), today)
        case "this_week":
            start = today - timedelta(days=today.weekday())
            return (start, today)
        case "this_month":
            return (today.replace(day=1), today)
        case "this_year":
            return (today.replace(month=1, day=1), today)
        # ... etc
```

This means relative filters produce different results on different days (correct
behavior — "past 7 days" should always mean the last 7 days). The frontend displays
the operator label ("Past 7 days"), not the resolved dates. The resolved dates never
enter the state — they're ephemeral, computed fresh on each script run.

#### Width Handling

The `width` parameter maps to `optional uint32 width = 13` on the proto:

| Python value | Proto `width` | Frontend behavior |
|---|---|---|
| `"stretch"` | unset (0) | Container fills parent width (default CSS `width: 100%`) |
| `"content"` | unset (0) + separate signal | Container auto-sizes to pill row content |
| `int` (e.g., 500) | `500` | Container sets `max-width: 500px` |

The `"stretch"` vs `"content"` distinction uses the framework's existing container width
system (same mechanism as `st.data_editor`'s `Width` type). The frontend reads from the
element's container properties rather than the proto field — `width` in the proto is only
set for pixel values.

### Frontend Implementation

#### Component Structure

```
frontend/lib/src/components/widgets/FilterBar/
├── FilterBar.tsx              # Top-level (React.memo wrapped), owns all state
├── FilterPill.tsx             # Individual filter chip/pill with value summary
├── ColumnPicker.tsx           # "Add filter" dropdown (searchable column list)
├── styled-components.ts      # All Emotion styled components
├── filters/
│   ├── MultiselectFilter.tsx  # Checkbox list with search + select/clear all
│   ├── TextFilter.tsx         # Text input with operator selector
│   ├── RangeFilter.tsx        # Min/max number inputs with operator
│   ├── DateRangeFilter.tsx    # Date/datetime inputs with operator + relative presets
│   ├── TimeRangeFilter.tsx    # Time inputs (HH:MM) with operator
│   ├── ToggleFilter.tsx       # True/False/Null segmented control
│   └── OperatorSelector.tsx   # Shared operator dropdown (portal-rendered to body)
```

Key architectural choices:
- **No separate state hook**: state management lives directly in `FilterBar.tsx` using
  `useState` + `useCallback`. Debouncing is handled via a `setTimeout` ref.
- **No `FilterPopover.tsx` dispatcher**: `FilterBar.tsx` renders the popover content
  directly via a `renderPopoverContent()` function that switches on filter type.
- **Floating UI**: uses `@floating-ui/react` (`useFloatingOverlay` + `useOverlayDismissal`
  hooks from shared lib) for popover positioning.
- The top-level component is wrapped in `React.memo()`.

#### State Management

State is managed directly in `FilterBar.tsx` (no separate hook):

```typescript
type FilterState = Record<string, FilterValue>  // column name → filter config

const [filterState, setFilterState] = useState<FilterState>(
  () => getInitialState(element, widgetMgr)
)

// Immediate commit (for toggle, date, operator changes)
const commitState = useCallback((state: FilterState): void => {
  widgetMgr.setStringValue({ id, formId }, JSON.stringify(state), { fromUi: true }, fragmentId)
}, [id, formId, widgetMgr, fragmentId])

// Debounced commit (150ms, for text input and range changes)
const debouncedCommit = useCallback((state: FilterState): void => {
  clearTimeout(commitTimeoutRef.current)
  commitTimeoutRef.current = setTimeout(() => commitState(state), 150)
}, [commitState])
```

**AND/OR logic** is read from `filterState._groups[0].logic` (groups-ready model) and
toggled via a dedicated `handleLogicToggle` that updates `_groups[0].logic`.

**Stale filter reconciliation**: a `useEffect` on `validColumnNames` prunes entries for
columns no longer in the proto, preserving `_`-prefixed metadata keys.

#### Commit Timing Architecture

Filter changes use two commit paths based on interaction type:

| Commit path | Used by | Trigger |
|-------------|---------|---------|
| `commitState` (immediate) | Toggle, date picker, operator change, filter add/remove, logic toggle, clear all | Single-shot selection that produces a meaningful state transition |
| `debouncedCommit` (150ms) | Text input keystrokes, range number input typing | Rapid input where committing each character would waste reruns |

The 150ms debounce is frontend-only (a `setTimeout` ref cleared on each keystroke).
When the popover is closed via Enter key or outside click, any pending debounce flushes
immediately (the `commitState` path is called directly on close for the current state).

**Enter-to-close**: The `StyledPopoverContainer` has an `onKeyDown` handler that closes
the popover on `Enter` if `!e.defaultPrevented`. Child elements that use Enter for their
own purpose (e.g., the operator selector opening/closing) call `e.preventDefault()` so
the popover stays open. This ensures the Enter key is a no-op while the operator dropdown
is focused, but acts as "done" when focus is on the popover body or a standard input.

#### Pill Summary Rendering

The `getSummaryText()` function in `FilterPill.tsx` renders a compact text summary for
each pill. The logic for multiselect (the most complex case):

```typescript
case "multiselect":
  if (values.length === 0) → "All"
  if (values.length === 1) → value name (with display name from format_func)
  if (values.length === 2) → "A, B"
  if (values.length >= 3) → "N selected"
```

The "N selected" pattern (rather than showing first 2 + "...") matches BI tool conventions
(Tableau, Notion, Attio) and is more informative at a glance for dashboard users.

#### Empty State

When `activeCount === 0 && !disabled`, a `StyledEmptyMessage` renders inside the pill row:
`Click "Add filter" to get started` (substituting the `element.placeholder` text if
customized). This provides discoverability for first-time users without adding visual
weight once filters are active.

#### Shared Filter Utilities (`filter-utils.ts`)

All filter components share operator predicate functions and label mappings extracted
into a single module to avoid duplication:

```typescript
// Operator predicates — determine UI behavior
export function isNullOperator(op: string): boolean {
  return op === "is_null" || op === "is_not_null"
}

export function isSingleValueOperator(op: string): boolean {
  return ["equals", "not_equals", "greater_than", "less_than", "before", "after"].includes(op)
}

// Operator display labels (operator key → human-readable label)
export const OPERATOR_LABELS: Record<string, string> = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  not_contains: "does not contain",
  between: "between",
  // ...
}
```

**Null operator UI pattern**: Every filter component checks `isNullOperator(operator)` at
the top of its render. When true, value inputs are hidden entirely — the operator alone
is the full filter (e.g., "is null" needs no value). This avoids duplicating the same
conditional in each component and ensures consistent behavior:

```typescript
// Inside any filter component:
if (isNullOperator(operator)) {
  return <OperatorSelector ... />  // Only show operator dropdown, no value inputs
}
// ... normal value inputs below
```

#### Keyboard Navigation

The pill row uses **roving tabindex** for arrow key navigation between pills:

```typescript
// Only the focused pill has tabIndex=0; all others have tabIndex=-1
const [focusedIndex, setFocusedIndex] = useState(0)

const handleKeyDown = (e: KeyboardEvent): void => {
  switch (e.key) {
    case "ArrowRight":
      setFocusedIndex(i => Math.min(i + 1, pillCount - 1))
      break
    case "ArrowLeft":
      setFocusedIndex(i => Math.max(i - 1, 0))
      break
    case "Home":
      setFocusedIndex(0)
      break
    case "End":
      setFocusedIndex(pillCount - 1)
      break
    case "Delete":
    case "Backspace":
      handleRemoveFilter(columns[focusedIndex])
      break
  }
}
```

The container has `role="toolbar"` and `aria-label`. Tab moves focus INTO the toolbar
(landing on the focused pill) and OUT to the "Add filter" button. Arrow keys move
between pills within the toolbar. This matches the WAI-ARIA toolbar pattern.

#### Multiselect State Format

V1 uses a simple include-only format (sufficient for the 100-value cardinality limit):

```typescript
// Per-column filter value for multiselect:
{ type: "multiselect", operator: "is", values: ["A", "B", "C"] }
```

- Selected values stored as a flat `values` array
- Removing the filter (pill deleted) removes the column key entirely
- All values deselected → filter still exists in state but produces "no constraint"

**Future optimization (deferred):** For high-cardinality scenarios (post-V1), an
include/exclude toggle could minimize payload when users deselect 2 of 1000.

#### Stale Filter Reconciliation

Backend reconciliation (`_reconcile_state`) removes column entries that no longer exist in
the DataFrame schema, while preserving `_`-prefixed metadata keys:

```python
def _reconcile_state(filter_state: FilterState, valid_columns: set[str]) -> FilterState:
    return {k: v for k, v in filter_state.items() if k.startswith("_") or k in valid_columns}
```

Frontend mirrors this with a `useEffect` that prunes on `validColumnNames` change.

#### Option Rendering

Multiselect options are rendered as a plain DOM scrollable checkbox list with client-side
search filtering. The cardinality threshold ensures lists stay under 100 items (above
that, the column uses a text filter instead):

| Cardinality | Filter Type | Rendering |
|-------------|-------------|-----------|
| ≤100 unique | Multiselect | All values as checkboxes with client-side search |
| >100 unique | Text search | Free-text input with operator (contains/equals/starts_with/ends_with) |
| Forced multiselect >1000 | Multiselect (server_search) | Top 1000 shipped; further search deferred to V2 |

Virtualization is omitted — modern browsers handle 100 checkbox items without jank.

#### Query Params Binding

When `bind="query-params"` is set, filter state is persisted in the URL as a single
JSON-encoded parameter:

```
?st_my_filter=%7B%22status%22%3A%7B%22type%22%3A%22multiselect%22%2C%22operator%22%3A%22is%22%2C%22values%22%3A%5B%22active%22%5D%7D%7D
```

Decoded: `?st_my_filter={"status":{"type":"multiselect","operator":"is","values":["active"]}}`

**Design decision: JSON-in-single-URL-param** (industry standard)

After researching how comparable tools handle complex filter state in URLs:
- **Apache Superset**: encodes filter state as JSON in a single `native_filters` URL param
- **nuqs (Next.js)**: JSON-encodes complex state in single params with custom serializers
- **Metabase**: base64-encoded JSON in a single param

The JSON-in-single-param approach was chosen because:
1. It reuses the existing `bind` infrastructure without modification — the widget's
   `string_value` (already JSON) is the natural serialization format
2. No custom URL encoding/decoding logic needed
3. Round-trip fidelity is perfect (dates, nested structures, special characters all survive)
4. Framework handles URL-encoding automatically

Bidirectional sync:
- Filter change → URL update (via framework's existing `bind` push mechanism)
- URL change (e.g., shared link opened) → filter state hydrated via widget serde
- Reuses existing `bind="query-params"` infrastructure identically to other widgets

Edge cases:
- **URL length limits**: browsers cap URLs at ~2,000–8,000 characters. With many active
  filters on high-cardinality multiselect columns, the encoded JSON could exceed this.
  Mitigation: if serialized filter state exceeds 1,500 characters, fall back to
  session-state-only and log a warning.
- **Stale URL params**: referencing columns not in current DataFrame are silently dropped
  during `_reconcile_state()`
- **Empty state**: no URL param is written when filter state is empty (clean URLs)

#### Form Behavior

When `st.filter_bar` is placed inside an `st.form`, the proto's `form_id` field is set
to the form's ID. This changes frontend commit behavior:

- **Outside form** (normal): `commitState` and `debouncedCommit` both call
  `widgetMgr.setStringValue(..., {fromUi: true})` which triggers a rerun immediately.
- **Inside form**: `widgetMgr.setStringValue(..., {fromUi: true})` stores the value
  locally but does NOT trigger a rerun. The rerun fires only when the form's submit
  button is clicked. The framework handles this — no special logic in FilterBar.

User experience inside a form:
- Filter pills still appear/update in real-time as the user interacts (local state)
- The downstream DataFrame does NOT update until form submission
- This enables "batch filter" patterns where users configure multiple filters and apply
  them all at once (reducing expensive reruns for slow data pipelines)

The frontend checks `formId` before deciding whether to call `commitState`:
```typescript
const shouldCommitImmediately = !element.formId
```

When `formId` is set, all commit paths (immediate and debounced) still update local
React state (so the UI is responsive) but the `widgetMgr` call is made with awareness
that it won't trigger a rerun until form submission.

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

### Performance Architecture

#### Backend Hot Path (per rerun)

Each script rerun executes the following for `st.filter_bar`:

| Step | Cost | Bounded by |
|------|------|-----------|
| `convert_anything_to_pandas_df(data)` | O(rows) for non-pandas; O(1) for pandas | Input size (cache with `@st.cache_data`) |
| `determine_dataframe_schema(df, arrow_schema)` | O(1) per typed column; O(rows) for `object`-dtype fallback | Column count × dtype quality |
| `_compute_filter_bar_signature(schema)` | O(columns) — string concat + hash | Column count (negligible) |
| `column.nunique()` + `unique()` for multiselect | O(rows) per low-cardinality string column; cached after first run | Signature-keyed cache; `nunique()` gate skips `unique()` for high-cardinality |
| `_reconcile_state(state, valid_columns)` | O(active_filters) — dict comprehension | Active filter count (negligible) |
| `_apply_filters(df, state)` | O(filters × rows) — vectorized boolean masks | Active filters × row count |
| `convert_pandas_df_to_data_format(filtered, format)` | O(filtered_rows) for non-pandas output | Output size |

**Key insight**: Benchmarking at 1M rows shows `_determine_filter_columns()` (dominated
by `unique()` calls) takes ~95ms and `_apply_filters()` takes ~70ms — together ~165ms
per rerun. Two optimizations ship in V1 to keep this under 200ms:

1. **`nunique()` gate** (Option A): Before calling `unique()` on a string column, call
   the cheaper `nunique()`. If cardinality > threshold (100), the column becomes a text
   filter and `unique()` is skipped entirely. This saves ~17ms per high-cardinality
   column at 1M rows.

2. **Signature-keyed cache** (Option D): `_determine_filter_columns()` results are
   cached keyed by the schema signature (`_compute_filter_bar_signature`). On subsequent
   reruns with unchanged schema, the entire unique()/min()/max() computation is skipped.
   Schema changes (column add/remove/type change) invalidate automatically.

After both optimizations: first render costs ~50-70ms (only low-cardinality columns run
`unique()`); subsequent reruns cost ~0ms for column detection + ~70ms for filter
application. Total per-interaction cost at 1M rows: ~70ms (well within the 200ms UX
threshold).

**Memory**: `df[boolean_mask]` creates a new DataFrame (not a view) — so peak memory is
~2× the filtered output size. For Polars inputs, there's an additional pandas
intermediary during filtering (~2× input size during the operation, released after).

#### Frontend Hot Path (per render)

| Pattern | Why | Impact |
|---------|-----|--------|
| `React.memo()` on FilterBar | Proto unchanged → skip re-render entirely | Eliminates renders from unrelated widget interactions |
| `React.memo()` on each filter component | Only re-renders when that filter's state changes | N filters don't re-render when 1 changes |
| `useMemo` for `filteredOptions` | Recomputes only when search query or options change | Avoids O(n) filter on every render |
| `useMemo` for `selectedSet` | `new Set(values)` recomputed only on value change | Checkbox `checked` lookups are O(1) not O(n) |
| `Set` for membership in `isSelected` | `selectedSet.has(v)` vs `values.includes(v)` | O(1) vs O(n) per checkbox — critical for 100 options |
| Stable callback refs via `useCallback` | Prevents child re-renders from ref identity changes | Pills don't re-render when unrelated state changes |
| 150ms debounce on text/range | Batches keystrokes into single commit | 10 keystrokes = 1 rerun, not 10 |

**Render frequency**: In the worst case (user typing in text filter), the FilterBar
component re-renders on every keystroke (local state update). But:
- Only `TextFilter` re-renders (others memoized)
- No `setStringValue` call until debounce fires (no rerun)
- The 150ms window means max ~7 reruns/second during typing

**Pill re-render isolation**: Each `FilterPill` receives `memo()`-friendly props
(primitives + stable refs). When one filter changes, only its pill re-renders. The
remaining pills compare equal and skip. This matters when 10+ pills are visible.

#### Wire Overhead

| Scenario | Bytes over WebSocket | Notes |
|----------|---------------------|-------|
| Initial render (10 multiselect columns × 50 options each) | ~5-10 KB | One-time; cached by forward_msg_cache after first send |
| Subsequent rerun (no schema change) | ~100 bytes (ref_hash only) | Proto unchanged → dedup kicks in |
| Filter state change (user adds filter) | ~200 bytes (WidgetState delta) | Only the JSON string_value travels in BackMsg |
| Schema change (column added) | ~5-10 KB (full proto re-sent) | Rare; only on DataFrame structural change |

The widget is wire-lightweight by design — filtering happens server-side, so no
DataFrame data ever crosses the WebSocket. Only column metadata (names, types, options,
bounds) and filter state (compact JSON) are exchanged.

#### Scalability Envelope

| Dimension | Tested limit | Bottleneck | Mitigation |
|-----------|-------------|-----------|-----------|
| Row count | 1M+ rows | `_apply_filters` (vectorized, <100ms at 1M) | `@st.fragment` scopes reruns; `@st.cache_data` for input |
| Column count | 50+ filterable columns | `unique()` per string column on first render | Signature-keyed cache skips on subsequent reruns; `nunique()` gate skips high-cardinality columns |
| Active filters | 20+ simultaneous | Mask composition O(N) merges (negligible) | No practical limit |
| Multiselect options | 100 per column (threshold) | DOM rendering (100 checkboxes) | Modern browsers handle without jank; virtualization deferred |
| URL binding | ~1,500 char JSON | Browser URL length limits | Falls back to session-only and warns if exceeded |
| Pill count (UI) | 20+ visible pills | Pill row wrap + roving tabindex | CSS flexbox wrap is performant; no virtualization needed |

**Where it gets slow**: The main risk is wide DataFrames with many `object`-dtype
columns (forces `infer_dtype()` per column — O(rows) each). Mitigation: users should
use typed DataFrames (Arrow-backed dtypes, explicit categories). The schema detection
cost disappears for well-typed data.

### State Flow Diagram

```
[User adds/edits filter in browser]
  → setFilterState(newState)
  → commitState(newState) or debouncedCommit(newState)
  → widgetMgr.setStringValue({id, formId}, JSON.stringify(state), {fromUi: true})
  → BackMsg(rerun_script with WidgetStates)
  → Backend: FilterBarSerde.deserialize(json_string)
  → _reconcile_state(state, valid_columns) → prune stale entries
  → _apply_filters(df, reconciled_state) → filtered DataFrame
  → Build FilterBar proto (all column metadata included)
  → Forward message cache deduplication
  → Frontend: React.memo skips re-render if props unchanged
  → Return filtered DataFrame to user's script
```

For AND/OR toggle:
```
[User clicks AND/OR toggle]
  → handleLogicToggle()
  → setFilterState({...state, _groups: [{logic: "or", columns: [...]}]})
  → commitState(newState) [immediate, not debounced]
  → Backend reads _groups[0].logic → applies OR mask composition
  → Returns DataFrame filtered with OR logic
```

## Behavior Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Eager vs lazy metadata | Eager (all columns at once) | Simpler; acceptable perf for multiselect ≤100 threshold |
| State on schema change | Drop stale filters individually, preserve `_` metadata | Valid filters preserved; only orphaned column filters removed |
| Widget state wire format | JSON string via `string_value` | Matches `st.data_editor` pattern; flexible during iteration |
| Multiselect wire format | Simple include-only `values` array | Sufficient for ≤100 cardinality; include/exclude deferred |
| AND/OR state model | Groups-ready (`_groups: [{logic, columns}]`) | V1 ships flat toggle; extends to multi-group in V2 without migration |
| Expanded/collapsed state | Frontend-only, not in widget value | UI chrome; doesn't affect filtering logic or trigger `on_change` |
| Element ID source | Schema signature (names + types) | Data changes don't reset state; only structural changes do |
| Debounce strategy | 150ms frontend-side (text/range only) | Batches rapid typing; toggles and dates commit immediately |
| Enter-to-close popover | `onKeyDown` on `StyledPopoverContainer`, guarded by `!e.defaultPrevented` | Keyboard "done" action; child inputs that handle Enter call `preventDefault()` so popover stays open |
| Pill summary (multiselect) | 1 → name, 2 → "A, B", 3+ → "N selected" | Count badge is clearer than truncated list for BI dashboards; matches Notion/Attio pattern |
| Empty state guidance | Rendered inside `StyledPillRow` when `activeCount === 0 && !disabled` | Uses `StyledEmptyMessage`; message references the placeholder text |
| Validation (impossible range) | No blocking validation; impossible constraints produce empty result set | Consistent with Streamlit's non-blocking philosophy; empty results are the feedback |
| Column ordering | Follows `columns` param order (Sequence) or dict insertion order (Mapping); auto-detect uses DataFrame column order | Pill order = user's addition order within the available set |
| Per-column disabled | `disabled` field on `FilterColumnMeta` proto | Simpler than separate `repeated string disabled_columns` on parent |
| Typed state object | `FilterBarState(ReadOnlyAttributeDictionary)` | Matches `DataframeState` pattern; prevents accidental mutation; provides `.active_filters` and `.logic` helpers |
| URL binding format | JSON-in-single-URL-param | Industry standard (Superset, nuqs); reuses existing `bind` infrastructure without modification; perfect round-trip fidelity |
| Default param | `default: FilterState \| None` serialized to proto `default` field | Standard Streamlit pattern; serde falls back to default when no UI value present |
| Multiselect search threshold | Show search when options > 5 | Appears for columns with 6+ options; balances discoverability with avoiding clutter for small lists |
| Null operator UI | Hide value inputs when `isNullOperator(op)` returns true | Consistent across all filter types; "is null" is the complete filter, no value needed |
| Keyboard navigation | Roving tabindex (`tabIndex=0` on focused pill, `-1` on others) | Follows WAI-ARIA toolbar pattern; Arrow keys move between pills, Tab exits toolbar |
| Form behavior | `widgetMgr.setStringValue` doesn't rerun; state commits on form submit | Pills update locally (responsive UI) but DataFrame doesn't change until submit |
| Relative dates | Stored as operator name, resolved server-side on each rerun | Produces correct results on different days; no stale date ranges in state |
| format_func transport | Eagerly computed to `display_options` during proto build | Index-aligned with `options`; frontend renders labels but sends raw values |
| Per-column disabled | `FilterColumnMeta.disabled` set from `disabled: Sequence[str]` | Non-interactive pills (no edit, no ×) and grayed in column picker |

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

**2. Lazy options vs eager options** ✅ Eager + cached (CHOSEN for V1)

- Chosen: All column metadata (including options for multiselect columns) computed
  eagerly and shipped in the proto, with results cached by schema signature.
- Rationale: With the 100-unique-value threshold, multiselect option lists are always
  small. The `nunique()` gate skips `unique()` for high-cardinality columns (>100),
  and the signature-keyed cache eliminates recomputation on subsequent reruns when the
  schema hasn't changed. First render at 1M rows: ~50-70ms; subsequent reruns: ~0ms.
- Trade-off: Cache invalidates on any schema change (column add/remove/type change),
  forcing a full recomputation. This is correct behavior — schema changes should
  re-evaluate filter types. Lazy loading deferred to V2 for the `server_search` path.

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

**5. Always-include vs include/exclude wire format** ✅ Always-include (CHOSEN for V1)

- Chosen: Simple `values` array (include-only) for V1
- Rationale: The 100-value cardinality threshold for multiselect means lists are never
  large enough for include/exclude to matter. Simplicity wins.
- Deferred: include/exclude optimization can be added later if/when we support
  multiselect for higher-cardinality columns (e.g., forced via FilterConfig)

**6. Switch statement vs filter type registry map** ✅ Switch (CHOSEN for V1)

- Chosen: `renderPopoverContent()` uses a switch statement on `filterValue.type` to
  render the appropriate filter component
- Rationale: V1 has 6 filter types — a switch is clear and grep-friendly. A registry
  map (`Map<string, FilterComponent>`) adds indirection without benefit at this scale.
- Deferred: If custom filter types (#14 in gap analysis) are added in V2, a registry
  pattern would be the natural evolution. The switch is easily replaced at that point.
- Reference: `st.data_editor` uses a `ColumnTypes` registry because it has 15+ column
  types and supports user-defined columns. filter_bar has a smaller, fixed set.

## Known Performance Limitations (V2)

These are non-blocking for V1 (the widget is responsive with typical usage) but worth
addressing if user feedback surfaces performance issues:

| # | Issue | Impact | Mitigation |
|---|-------|--------|-----------|
| P2 | No option list virtualization | All 100 multiselect options render as DOM nodes | Bounded by cardinality threshold; 100 checkboxes render without jank on modern browsers. Add `react-window` if >100 threshold is raised. |
| P3 | `getPillRef(index)` creates new closure per render | Defeats `React.memo` on `FilterPill` — triggers re-render of all pills on any state change | Impact minimal for typical pill counts (<20). Can switch to a ref Map with stable callbacks for V2. |
| P4 | Initial `commitState` on mount | First render commits state immediately, potentially triggering an extra script rerun | Could skip if state matches proto `default`. Currently acceptable — the extra rerun is indistinguishable from initial load. |

None of these affect perceived performance for typical usage (≤20 filters, ≤100 options
per multiselect). They become relevant if: (a) the cardinality threshold is raised
significantly, (b) users add 50+ simultaneous filters, or (c) apps run on extremely
constrained devices.
