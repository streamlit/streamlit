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
- No mechanism for server-side option search on high-cardinality columns without
  triggering a full script rerun (solved: `BackendOperationRequest` integration)
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
  bool disabled = 5;
  repeated FilterColumnMeta columns = 6;
  bool set_value = 7;
  string value = 8;
  string default = 9;
  LabelVisibility label_visibility = 10;
  optional uint32 width = 11;
}

message FilterColumnMeta {
  string name = 1;
  FilterType filter_type = 2;
  string column_data_kind = 3;
  repeated string options = 4;
  optional double min_value = 5;
  optional double max_value = 6;
  bool server_search = 7;
  optional uint32 total_options = 8;     // full distinct count when server_search
  optional string custom_label = 9;
  optional string help = 10;             // from ColumnConfig.help
  repeated string operators = 11;
  bool disabled = 12;
  repeated string display_options = 13;  // format_func-generated labels
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

Notes on the shape:
- Per-column `disabled` lives on `FilterColumnMeta` rather than a separate
  `repeated string disabled_columns` on the parent message
- `set_value` / `value` / `default` pattern matches standard widget proto (like
  `st.text_input`) rather than a custom `default_state` field
- `bind` and `persist_state` use the framework's existing infrastructure (not in proto —
  handled at `register_widget` level)
- No `placeholder` or `expanded` fields — neither parameter exists (product spec, decision 5
  and Out of Scope)
- `total_options` carries the full distinct count so the frontend can render
  "Showing 100 of 3,412 — type to search"; `help` carries `ColumnConfig.help` for per-pill
  tooltips
- Renumbering fields is safe here: `FilterBar.proto` has not shipped, so no wire
  compatibility is owed

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
`FilterConfig` is exported as `st.column_config.FilterConfig` rather than at the top level
(see [Column Config Derivation](#column-config-derivation)).

**State shape:**

```json
{
  "status": {"type": "multiselect", "operator": "is", "values": ["active"]},
  "price": {"type": "range", "operator": "between", "min": 10, "max": 500}
}
```

| Key pattern | Purpose |
|-------------|---------|
| Column names | Per-filter state: `{type, operator, ...type-specific values}` |
| `_*` (any `_`-prefix) | Reserved for future metadata, preserved through state reconciliation |

V1 writes no `_`-prefixed keys. The prefix is reserved so later additions need no migration —
cross-field OR would add `_groups: [{logic, columns}]`, and a reader that finds no recorded
logic treats it as AND. Keeping V1 state minimal also helps `bind="query-params"`, which falls
back to session-only past 1,500 characters.

There is no `.logic` property in V1, since it could only ever return `"and"`; it arrives with
cross-field OR.

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
    ColumnDataKind.STRING: FilterType.MULTISELECT,  # TEXT only if the column reads as prose
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

#### String Columns: Categorical or Prose

A string column becomes a value picker unless it reads as prose. Cardinality alone cannot
distinguish the two — 10,000 customer names are a set of values, 10,000 comments are not — so
two sampled signals decide it:

```python
_PROSE_UNIQUENESS_RATIO: Final = 0.9  # nearly every row distinct
_PROSE_MEAN_LENGTH: Final = 60        # characters

def _reads_as_prose(col: pd.Series, distinct: int, sample: int = 1_000) -> bool:
    values = col.dropna()
    if values.empty:
        return False
    if values.head(sample).str.len().mean() > _PROSE_MEAN_LENGTH:
        return True
    return distinct / len(values) > _PROSE_UNIQUENESS_RATIO
```

Mean length is computed on a bounded sample; `distinct` is the `nunique()` result already
needed for option loading, so this adds no extra pass over the data. Both inferences are
overridable — `TextColumn` forces prose, `SelectboxColumn` forces a picker — which is what
makes a heuristic acceptable here: a misfire costs one line of config, not a dead end.

#### Option Loading Strategy

One constant governs option delivery:

```python
_OPTION_RENDER_CAP: Final = 100  # provisional — see V1 Must-Fix: popover render cost
```

One constant is enough because a categorical column gets a value picker at every cardinality —
so the only question is how many options ship and render at once, not what kind of filter the
column gets:

| Condition | Proto payload | Where options come from |
|---|---|---|
| `nunique` ≤ cap | All unique values in `options` | Eager, inline with the element |
| `nunique` > cap | No options; `server_search = true`, `total_options = nunique` | Fetched on first popover open, then searched — both via `BackendOperationRequest` |
| Prose column | No options; `filter_type = TEXT` | n/a |

`nunique()` runs eagerly for every string column — it is the cheap gate that decides the tier
and populates `total_options`. The expensive `unique()` call is deferred for above-cap columns
until the user actually opens that popover, which also removes the cold-start cost for columns
nobody touches. Below-cap columns ship inline so their popovers open with no round trip.

This makes [lazy option loading](#lazy-option-loading) load-bearing for above-cap columns
rather than an optional optimization, and it is the reason `unique()` is no longer skipped
outright for high-cardinality categorical columns: the full distinct set is needed once, then
cached, to answer server-side searches.

#### Filter Execution

```python
def _apply_filters(data_df: pd.DataFrame, filter_state: FilterBarState) -> pd.DataFrame:
    if not filter_state:
        return data_df

    combined_mask = pd.Series(True, index=data_df.index)

    for col_name, filter_config in filter_state.items():
        if col_name.startswith("_"):  # Skip reserved metadata keys
            continue
        if col_name not in data_df.columns:
            continue
        combined_mask &= _apply_single_filter(data_df, col_name, filter_config)

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

**AND-only composition**: every per-column mask is combined with `&=`. There is no OR path
and no logic key in state (product spec, decision 2).

**Unconfigured filters**: a filter whose value is not yet set — an empty multiselect, an empty
text query — returns an all-`True` mask, which reads correctly as "no constraint" under AND.
This is also why cross-field OR is not a trivial addition later: an all-`True` mask inside an
OR union makes every row match, so OR first requires defining "unconfigured" for each filter
type and excluding those filters from composition entirely.

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

#### Column Config Derivation

`columns` accepts `Sequence[str] | Mapping[str, ColumnConfig | str | None] | None`. Mapping
values reuse the `st.column_config.*` factories, whose return type is the `ColumnConfig`
TypedDict (`elements/lib/column_types.py`), so derivation reads `type_config` to recover the
declared column type:

```python
_COLUMN_TYPE_TO_FILTER_TYPE: Final[dict[str, FilterType]] = {
    "selectbox": FilterType.MULTISELECT,
    "text": FilterType.TEXT,
    "link": FilterType.TEXT,
    "markdown": FilterType.TEXT,
    "number": FilterType.RANGE,
    "progress": FilterType.RANGE,
    "checkbox": FilterType.TOGGLE,
    "date": FilterType.DATE_RANGE,
    "datetime": FilterType.DATETIME_RANGE,
    "time": FilterType.TIME_RANGE,
}

_UNFILTERABLE_COLUMN_TYPES: Final = frozenset({
    "multiselect", "list", "json", "image", "audio", "video",
    "line_chart", "bar_chart", "area_chart", "button",
})
```

A column type in `_UNFILTERABLE_COLUMN_TYPES` raises `StreamlitAPIException` naming both the
type and the column; an unrecognized type falls back to dtype inference. `multiselect` and
`list` hold several values per cell and need "has any of" mask semantics, so they are excluded
until the list/tags filter ships.

Fields consumed per column config:

| `ColumnConfig` field | Use |
|---|---|
| `label` | `FilterColumnMeta.custom_label` |
| `help` | `FilterColumnMeta.help` |
| `type_config` | Filter type, plus `options` / `format_func` / `min_value` / `max_value` |
| `filter` | `bool` or `FilterConfig` (below) |
| `width`, `pinned`, `alignment`, `required`, `disabled`, `hidden`, `default` | Ignored |

`disabled` and `hidden` are ignored deliberately, so each concept has exactly one mechanism:
widget-level `disabled` locks filters, and a `None` mapping value (or `filter=False`) excludes a
column. There is precedent for a shared config type meaning less in one element than in
another — `st.dataframe` already ignores `required` and `disabled`.

**`ColumnConfig.filter`** is a new optional field on a shared public type:

```python
class ColumnConfig(TypedDict, total=False):
    ...
    filter: bool | FilterConfig | None

class FilterConfig(TypedDict, total=False):
    type: FilterTypeLiteral | None      # override the type implied by the column class
    operators: Sequence[str] | None     # restrict the operator list
```

`ColumnConfig` is a `TypedDict` with `total=False`, so this is purely additive. The field is
expressible in `st.dataframe`/`st.data_editor` calls and inert there until the table
integration ships — the same status `required` has in `st.dataframe` today. **This change needs
review from the owners of `column_config`, not only this spec's reviewers.**

#### `format_func` → `display_options` Computation

When a column is configured with `SelectboxColumn(format_func=...)`, the backend eagerly
computes display labels during proto construction and ships them in
`FilterColumnMeta.display_options`:

```python
if format_func is not None:
    meta.display_options[:] = [str(format_func(v)) for v in meta.options]
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

**Stale filter reconciliation**: a `useEffect` on `validColumnNames` prunes entries for
columns no longer in the proto, preserving `_`-prefixed metadata keys.

#### Commit Timing Architecture

Filter changes use two commit paths based on interaction type:

| Commit path | Used by | Trigger |
|-------------|---------|---------|
| `commitState` (immediate) | Toggle, date picker, operator change, filter add/remove, clear all | Single-shot selection that produces a meaningful state transition |
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
`Click "Add filter" to get started`. This provides discoverability for first-time users
without adding visual weight once filters are active. The text is not customizable in V1.

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

#### Popover and Filter Accessibility

Each filter popover uses specific ARIA patterns depending on filter type:

**Multiselect (checkbox list)**:
- Option list has `role="listbox"` with `aria-multiselectable="true"`
- Each option has `role="option"` with `aria-selected` reflecting checked state
- The search input has `aria-controls` pointing to the listbox
- "Select all" / "Clear all" actions are standard buttons outside the listbox

**Operator selector**:
- Trigger button has `aria-haspopup="listbox"` and `aria-expanded`
- Menu uses `role="listbox"` with `aria-activedescendant` for keyboard highlighting
- Arrow keys navigate options; Enter/Space selects; Escape closes

**Popover container**:
- Has `role="dialog"` with `aria-labelledby` pointing to the filter column name
- Escape closes the popover and returns focus to the triggering pill
- Focus is trapped inside the popover while open (Tab cycles within)

**Live region for filter count**:
- A visually-hidden `aria-live="polite"` region announces filter count changes
  (e.g., "3 active filters" after adding/removing a filter)
- Announcements are debounced (same 150ms as the commit debounce) to avoid
  rapid-fire announcements during bulk operations

#### Multiselect State Format

V1 uses a simple include-only format (sufficient for the 50-value cardinality limit):

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

Options render as a plain DOM scrollable checkbox list with a search input. At most
`_OPTION_RENDER_CAP` rows are drawn at once, regardless of the column's cardinality:

| Cardinality | Rendering |
|-------------|-----------|
| ≤ cap | All values as checkboxes; search filters client-side |
| > cap | First *cap* values fetched on popover open; search filters server-side; header reads "Showing 100 of 3,412 — type to search" |
| Prose column | No checkbox list — free-text input with operators |

Virtualization is unnecessary because the rendered row count is bounded by the cap rather than
by cardinality. Tableau takes the same approach, capping its browser-based search dropdown at
100 displayed results.

**V1 must-fix: popover render cost.** Measurement showed ~294ms to open a popover containing
100 checkbox rows — roughly 3ms per row, which is pathological for plain DOM checkboxes and
points at unmemoized rows or Floating UI re-positioning per item. The cap is provisionally 100
but cannot be finalized until that is diagnosed and fixed. If the per-row cost stays high the
cap has to drop toward 50, which materially worsens the default for columns in the 50–200
range (US states, countries). This is V1 scope, not a follow-up.

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

#### Fragment Interaction

When `st.filter_bar` is placed inside an `@st.fragment`-decorated function:

- **Scoped reruns**: Filter interactions trigger a rerun of only the fragment function,
  not the full script. This is the primary performance optimization for apps with
  expensive data loading above the filter bar.
- **No special handling needed**: The framework's existing fragment infrastructure handles
  scoping automatically — `widgetMgr.setStringValue` with `fragmentId` already targets
  the correct rerun scope.
- **Pattern for expensive apps**:

```python
@st.cache_data
def load_data():
    return expensive_query()  # Runs once, cached

df = load_data()

@st.fragment
def filter_section():
    filtered = st.filter_bar(df, key="filters")
    st.dataframe(filtered)

filter_section()
```

In this pattern, filter interactions only re-execute `filter_section()` (the fragment),
skipping `load_data()` and any other script-level code. The `fragmentId` is propagated
through the `commitState` call to `widgetMgr.setStringValue`:

```typescript
widgetMgr.setStringValue({ id, formId }, JSON.stringify(state), { fromUi: true }, fragmentId)
//                                                                                 ^^^^^^^^^^
//                                                         Scopes the rerun to this fragment
```

- **Interaction with `on_change`**: The callback fires within the fragment's rerun scope,
  not the full script. This is consistent with all other widgets inside fragments.
- **Multiple filter bars in one fragment**: Supported; each has its own widget ID and
  triggers the same fragment rerun. State is independent per widget key.

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
| `column.nunique()` per string column | O(rows); cached after first run | Signature-keyed cache |
| `column.unique()` for below-cap columns | O(rows) each; cached after first run | Signature-keyed cache; above-cap columns defer this to popover open |
| `_reconcile_state(state, valid_columns)` | O(active_filters) — dict comprehension | Active filter count (negligible) |
| `_apply_filters(df, state)` | O(filters × rows) — vectorized boolean masks | Active filters × row count |
| `convert_pandas_df_to_data_format(filtered, format)` | O(filtered_rows) for non-pandas output | Output size |

**Key insight**: Benchmarking at 1M rows shows `_determine_filter_columns()` (dominated
by `unique()` calls) takes ~95ms and `_apply_filters()` takes ~70ms — together ~165ms
per rerun. Two optimizations ship in V1 to keep this under 200ms:

1. **`nunique()` gate**: `nunique()` runs first on every string column. It decides the tier and
   populates `total_options`, and for above-cap columns it lets `unique()` be deferred to
   popover open — saving ~17ms per such column at 1M rows on first render, and skipping the work
   entirely for columns the user never opens.

2. **Signature-keyed cache**: `_determine_filter_columns()` results are cached keyed by the
   schema signature (`_compute_filter_bar_signature`). On subsequent reruns with unchanged
   schema, the entire unique()/min()/max() computation is skipped. Schema changes (column
   add/remove/type change) invalidate automatically.

After both: first render costs ~50-70ms (only below-cap columns run `unique()`); subsequent
reruns cost ~0ms for column detection plus ~70ms for filter application. Total per-interaction
cost at 1M rows: ~70ms, well within the 200ms UX threshold.

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
| `Set` for membership in `isSelected` | `selectedSet.has(v)` vs `values.includes(v)` | O(1) vs O(n) per checkbox — matters at the render cap |
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
| Initial render (10 below-cap multiselect columns) | ~5-10 KB | One-time; cached by forward_msg_cache after first send. Above-cap columns ship no options at all |
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
| Column count | 50+ filterable columns | `unique()` per below-cap string column on first render | Signature-keyed cache skips on subsequent reruns; above-cap columns defer `unique()` to popover open |
| Active filters | 20+ simultaneous | Mask composition O(N) merges (negligible) | No practical limit |
| Multiselect options | Unbounded source cardinality | DOM rendering + wire overhead | Both bounded by `_OPTION_RENDER_CAP`; server-side search covers the remainder |
| URL binding | ~1,500 char JSON | Browser URL length limits | Falls back to session-only and warns if exceeded |
| Pill count (UI) | 20+ visible pills | Pill row wrap + roving tabindex | CSS flexbox wrap is performant; no virtualization needed |

**Where it gets slow**: The main risk is wide DataFrames with many `object`-dtype
columns (forces `infer_dtype()` per column — O(rows) each). Mitigation: users should
use typed DataFrames (Arrow-backed dtypes, explicit categories). The schema detection
cost disappears for well-typed data.

**Large dataset guidance (validated via profiling):**

| Row count | Filter application (mixed, 5 types) | Recommendation |
|-----------|--------------------------------------|----------------|
| 100K | 12ms | No special handling needed |
| 1M | 84ms | Wrap in `@st.fragment` for best UX |
| 10M | 787ms | Requires `@st.fragment` + `@st.cache_data`; warn in docs |

The `@st.fragment` pattern is the primary performance story: filter interactions only
re-execute the fragment function, not the full script. Prototype validation confirmed
correct isolation (expensive computations above the fragment do not re-execute on filter
interaction).

#### BackendOperationRequest Integration

`st.filter_bar` leverages the existing `BackendOperationRequest` / `BackendOperationResponse`
mechanism (the same pattern used by lazy dataframe row-chunk loading and deferred file
downloads) to avoid full script reruns for two operations:

1. **Option loading** — deferring `unique()` until the user opens an above-cap column's popover
2. **Server-side search** — filtering options within an above-cap column

These are frontend→backend round-trips that bypass the rerun cycle entirely. Both are V1 and
both are load-bearing: every categorical column with more distinct values than
`_OPTION_RENDER_CAP` depends on them.

##### Lazy Option Loading (above-cap columns)

**Scope: V1, required.** `nunique()` runs eagerly for every string column — it is the cheap
gate that decides the tier — but `unique()` is deferred for above-cap columns until the user
opens that popover. First render stays independent of cardinality, and columns nobody touches
cost nothing.

**Protocol:**

1. Backend ships `FilterColumnMeta` with `server_search = true` and
   `total_options = nunique`, but no `options`.
2. On first popover open, the frontend requests the first *cap* options via
   `BackendOperationRequest`.
3. Backend computes `unique()` for that column once, caches it by schema signature, and returns
   the first *cap* values.
4. Frontend renders them under the "Showing 100 of 3,412 — type to search" header and caches
   them for subsequent opens (invalidated on schema change).

Below-cap columns skip all of this — their options ship inline with the element, so their
popovers open with no round trip.

**Cost:** one round trip on first open of an above-cap column (~13ms of `unique()` at 1M rows,
plus network latency). In exchange, first render pays only `nunique()`.

##### Server-Side Search

**Scope: V1, required.** Typing in an above-cap column's search input sends a debounced (150ms)
request; the backend filters the cached unique-value list (measured: 0.5ms at 10K values, 2ms
at 100K) and returns matches capped at `_OPTION_RENDER_CAP`. No script rerun occurs.

**Proto additions (BackMsg.proto / ForwardMsg.proto):**

```protobuf
// In BackendOperationRequest.payload oneof:
FilterOptionsRequestPayload filter_options = 7;

message FilterOptionsRequestPayload {
  string widget_id = 1;       // widget element ID
  string column_name = 2;     // column to load or search within
  optional string query = 3;  // absent on first load; search text otherwise
  uint32 limit = 4;           // max results to return (= _OPTION_RENDER_CAP)
}

// In BackendOperationResponse.payload oneof:
FilterOptionsResponsePayload filter_options = 7;

message FilterOptionsResponsePayload {
  string widget_id = 1;
  string column_name = 2;
  repeated string options = 3;   // matches, capped at limit
  uint32 total_matches = 4;      // total count (for "showing X of Y")
}
```

One payload pair covers both operations: an initial load is a request with no `query`, and a
search is the same request with one. That is simpler than separate `FilterSearch*` and
`FilterOptions*` message pairs, since the response shape is identical either way.

**When it triggers:**
- Any categorical column with more distinct values than the render cap, whether its type was
  inferred or configured — the common path, not an edge case
- Never for prose columns (no option list) or below-cap columns (options ship inline)

**Why not virtualization:** virtualizing the checkbox list (`react-window`) is unnecessary
because the rendered row count is bounded by the render cap rather than by cardinality, and the
cap bounds wire payload at the same time. If users ask to *browse* rather than search very long
lists, virtualization can be added later as a complementary optimization.

#### Known Limitations (V2 Candidates)

These are non-blocking for V1 but worth addressing if user feedback surfaces issues:

| # | Issue | Impact | Mitigation |
|---|-------|--------|-----------|
| P1 | No native Polars filtering | Polars inputs are converted to pandas for filtering, creating ~2× memory peak | Could apply filter masks directly in Polars (`.filter()`) to avoid intermediary. Deferred because the conversion path is correct and `@st.cache_data` avoids repeated cost. |
| P2 | `getPillRef(index)` creates new closure per render | Defeats `React.memo` on `FilterPill` — triggers re-render of all pills on any state change | Impact minimal for typical pill counts (<20). Can switch to a ref Map with stable callbacks. |
| P3 | Initial `commitState` on mount | First render commits state immediately, potentially triggering an extra script rerun | Could skip if state matches proto `default`. Currently acceptable — the extra rerun is indistinguishable from initial load. |

None of these affect perceived performance for typical usage (≤20 filters, ≤ cap shipped
options per column). They become relevant if: (a) users add 50+ simultaneous filters, (b) apps
run on extremely constrained devices, or (c) Polars adoption grows and memory overhead becomes
a concern.

Distinct from these, and **in V1 scope**, is the popover render cost described under
[Option Rendering](#option-rendering): ~294ms for 100 checkbox rows has to be diagnosed and
fixed, because the render cap — and therefore the quality of option-picking for columns in the
50–200 range — depends on it.

### State Flow Diagrams

**Filter interaction (triggers rerun):**

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
```

**Option load and search (no rerun):**

```
[User opens popover for an above-cap column, or types in its search input]
  → debounce 150ms (search only)
  → BackMsg(BackendOperationRequest { FilterOptionsRequestPayload { widget_id, column, query? } })
  → Backend: unique() once per column (cached), then filter by query (< 2ms)
  → ForwardMsg(BackendOperationResponse { FilterOptionsResponsePayload { options, total } })
  → Frontend: populate or replace option list in popover (no rerun, no state change)
```

## Behavior Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Per-column configuration | Reuse `st.column_config.*`; filter-only knobs in a new `ColumnConfig.filter` field | One vocabulary for the same domain facts; invalid combinations become unrepresentable; the mapping moves to `column_config=` unchanged when the table integration ships |
| Option delivery | Inline for ≤ cap; fetch-on-open plus server-side search above cap | Cardinality changes only where options come from, never the filter type |
| Categorical vs prose | Sampled uniqueness ratio and mean string length | Cardinality alone cannot separate 10K customer names from 10K comments; both inferences are overridable via `SelectboxColumn` / `TextColumn` |
| Render cap | One constant bounding both rendered rows and the fetch boundary | Two thresholds (text fallback at 50, server search at 1,000) collapse into one number that is no longer API-visible |
| State on schema change | Drop stale filters individually, preserve `_` metadata | Valid filters preserved; only orphaned column filters removed |
| Widget state wire format | JSON string via `string_value` | Matches `st.data_editor` pattern; flexible during iteration |
| Multiselect wire format | Simple include-only `values` array | Adequate at any cardinality since selections are typically few; include/exclude deferred |
| Filter logic | AND only; no logic key written to state | No comparable ships a global AND/OR toggle; adding one later needs no proto change or migration |
| Element ID source | Schema signature (names + types) | Data changes don't reset state; only structural changes do |
| Debounce strategy | 150ms frontend-side (text/range only) | Batches rapid typing; toggles and dates commit immediately |
| Enter-to-close popover | `onKeyDown` on `StyledPopoverContainer`, guarded by `!e.defaultPrevented` | Keyboard "done" action; child inputs that handle Enter call `preventDefault()` so popover stays open |
| Pill summary (multiselect) | 1 → name, 2 → "A, B", 3+ → "N selected" | Count badge is clearer than truncated list for BI dashboards; matches Notion/Attio pattern |
| Empty state guidance | Rendered inside `StyledPillRow` when `activeCount === 0 && !disabled` | Uses `StyledEmptyMessage`; fixed text, not customizable in V1 |
| Validation (impossible range) | No blocking validation; impossible constraints produce empty result set | Consistent with Streamlit's non-blocking philosophy; empty results are the feedback |
| Column ordering | Follows `columns` param order (Sequence) or dict insertion order (Mapping); auto-detect uses DataFrame column order | Pill order = user's addition order within the available set |
| Per-column disabled | `disabled` field on `FilterColumnMeta` proto | Simpler than separate `repeated string disabled_columns` on parent |
| Typed state object | `FilterBarState(ReadOnlyAttributeDictionary)` | Matches `DataframeState` pattern; prevents accidental mutation; provides the `.active_filters` helper |
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
- Option delivery: ≤ cap ships options inline; above cap sets `server_search=true` and
  `total_options` with no options
- Categorical vs prose: labels stay pickers at high cardinality; long-text and
  near-all-distinct columns become text filters; `SelectboxColumn` / `TextColumn` override both
- Column config derivation: each filterable column type maps to the right filter type;
  unfilterable types raise; `filter=False` and `None` both exclude; ignored fields stay ignored
- `default` validation: unknown column name raises, unlike stale restored state
- Edge cases: empty DataFrame, all-null column, single-value column

**Frontend unit tests** (`FilterBar.test.tsx`, hook tests):
- Debounce behavior: rapid state changes produce one `setStringValue` call
- Option rendering: at most cap rows drawn; client-side search below cap, request dispatched
  above cap
- Chip rendering: correct label, operator, value display
- Keyboard navigation: Tab/Enter/Escape/Delete behaviors
- React.memo: no re-render when props unchanged

**E2E tests** (`e2e_playwright/st_filter_bar_test.py`):
- Add/edit/remove filter flow (multiselect, range, date, text, toggle)
- Multiple filters with AND logic
- Wide DataFrame (20+ columns) — column picker works
- Above-cap column — fetch-on-open then server-side search, with no script rerun in either
- Configuration via `st.column_config.*`, including `filter=` overrides
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

**2. Option delivery: inline below the cap, fetch-on-open above it** ✅ Hybrid (CHOSEN for V1)

- Chosen: `nunique()` eagerly for every string column; options shipped inline when the count is
  at or below `_OPTION_RENDER_CAP`; above the cap, options are fetched when the popover opens
  and searched server-side, both through `BackendOperationRequest`. Results cached by schema
  signature.
- Rejected — ship everything eagerly: at high cardinality this is wasteful on the wire and
  useless in the DOM, since only *cap* rows can be rendered anyway.
- Rejected — a low cardinality threshold with a text-filter fallback: it makes an
  implementation constant decide the *kind* of filter a column gets, so a `country` column
  becomes a text box. No comparable tool does this (Metabase switches a dropdown to a search
  box above 1,000 distinct values; Tableau caps displayed results at 100 and keeps a picker).
- Trade-off: one round trip on first open of an above-cap column, and `unique()` must be
  computed in full for those columns to answer searches. The cache invalidates on any schema
  change — correct, since schema changes should re-evaluate filter types.

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
- Rationale: users select a handful of values in practice, so an include list stays small even
  on high-cardinality columns. Simplicity wins.
- Deferred: an include/exclude representation would only pay off for "select all except two of
  3,000", which the UI does not currently make easy anyway

**6. Switch statement vs filter type registry map** ✅ Switch (CHOSEN for V1)

- Chosen: `renderPopoverContent()` uses a switch statement on `filterValue.type` to
  render the appropriate filter component
- Rationale: V1 has 6 filter types — a switch is clear and grep-friendly. A registry
  map (`Map<string, FilterComponent>`) adds indirection without benefit at this scale.
- Deferred: If custom filter types (#14 in gap analysis) are added in V2, a registry
  pattern would be the natural evolution. The switch is easily replaced at that point.
- Reference: `st.data_editor` uses a `ColumnTypes` registry because it has 15+ column
  types and supports user-defined columns. filter_bar has a smaller, fixed set.

**7. Configuration vocabulary: `column_config` vs a dedicated `FilterConfig`** ✅ `column_config` (CHOSEN)

- Chosen: per-column configuration reuses `st.column_config.*`, with filter-only knobs in a new
  additive `ColumnConfig.filter` field. See [Column Config Derivation](#column-config-derivation).
- Rejected — a standalone top-level `FilterConfig(type=..., options=..., min_value=...)`: it
  restates domain facts `column_config` already expresses (`options` on `SelectboxColumn`,
  `min_value`/`max_value` on `NumberColumn`, `format_func` on `SelectboxColumn`, `label` and
  `help` on every column config), which would leave two vocabularies for the same thing and,
  once the table integration ships, force users to declare each fact twice.
- Rejected — a class family (`st.filter_config.Multiselect`, `.Range`, …): this is what
  `st.column_config` already is. Building a parallel family would duplicate 10+ public classes.
- Trade-off accepted: `filter_bar` accepts a config type carrying table-only fields it ignores,
  and must raise on column types with no filter meaning. Precedent exists — `st.dataframe`
  already ignores `required` and `disabled`.
- Cost: `ColumnConfig` is a shared public type, so this needs sign-off from its owners.
