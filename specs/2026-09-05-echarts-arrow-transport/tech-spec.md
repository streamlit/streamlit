---
author: lukasmasuch
created: 2026-09-05
---

# Arrow transport for `st.echarts_chart` datasets

## Summary

Ship dataframe-like `dataset.source` values as Apache Arrow IPC beside the JSON spec, not
inside it. Python replaces each dataframe with `{"name": <content-hash>}`; those bytes
travel on `EChartsChart.datasets` as `ArrowNamedDataSet` (the same message Vega uses). The
frontend hydrates each name into ECharts `source` rows before `setOption`.

That reuse is a good fit: we need named Arrow blobs referenced from a JSON spec, which is
exactly `ArrowNamedDataSet`. What we do *not* copy is Vega's consumption path — there is
no `view.insert`, and we do not call Vega's `getDataArray`. Parsing still goes through
`Quiver`, the same as `st.dataframe` / `st.table` / Vega. Per-cell values follow the
dataframe/table type helpers (not Vega's passthrough).

The public API does not change. Users still pass a dataframe at `dataset.source`; Streamlit
still fills `dataset.dimensions` when the user omitted it. What changes is the wire format
that today inlines every row as a JSON object.

This is the transport follow-up from the internal charting-libraries audit (Arrow is
the only Vega-exclusive advantage that ECharts still lacks on the wire) and a pure
*how* change on top of the [`st.echarts_chart` product spec](../2026-07-06-echarts-chart/product-spec.md).

## Problem

`st.echarts_chart` is the only general-purpose chart command that still inlines dataframe
rows as JSON records inside `proto.spec`. The Python path is:

1. `DataFrame.to_json(orient="records")`
2. `json.loads` back into Python dicts
3. `json.dumps` of the whole option into `EChartsChart.spec`

That triple conversion is the measured bottleneck: at 100k rows, `st.echarts_chart` is the
most expensive chart command on the server (~85 ms median payload build, vs Arrow-backed
Vega in the same benchmark). The payload is also the most verbose of the three engines —
one key per cell per row — so the browser then pays `JSON.parse` on that string.

Vega already solved this in-tree. Altair's transformer replaces each dataframe with
`{"name": <content-hash>}`, stores Arrow IPC on `VegaLiteChart.datasets`, and the frontend
injects rows with `view.insert(name, ...)`. A 50k-row Altair chart is a ~250-byte spec plus
~800 KB of Arrow.

ECharts needs the same *split* (small spec + named Arrow blobs). It does not need Vega's
*view* API: `dataset.source` is always inline data, so the frontend's job is to put the
rows back into `source` before `setOption`. `st.echarts_chart` already accepts dataframes
at `dataset.source` and already walks timeline / media variants to find them.

ECharts itself is not the constraint. The canvas renderer, `large`, `progressive`, and
`sampling: "lttb"` all work; `appendData` streaming is a different, imperative API and is
out of scope. The gap is transport.

Inline JSON `series.data` / `xAxis.data` and already-JSON `dataset.source` lists are *not*
the problem this spec solves. Those stay in the spec string, as they do today.

## Proposal

Reuse Vega's named Arrow datasets. Hydrate them the ECharts way.

```text
Python                          Wire                         Browser
──────                          ────                         ───────
dataframe-like source    →      EChartsChart.spec            JSON.parse(spec)
  → Arrow IPC + name            (source: {name})             → replace {name} with rows
  → dimensions in spec          EChartsChart.datasets[]      → applyStreamlitOptionDefaults
                                (ArrowNamedDataSet)          → setOption
```

Non-dataframe sources (list of records, 2D arrays, keyed columns) stay inline JSON. JSON
string and `pyecharts` inputs are unchanged: they never carry a Python dataframe.

### Public API

No new parameters, no new input sites, no change to the "dataframes only at
`dataset.source`" rule. `series.data` dataframes still raise
`echarts-spec-not-json-serializable` and point the user at `dataset.source`.

The product spec's sentence that Streamlit "converts each to JSON-compatible rows" is
amended to: Streamlit converts each dataframe-like `source` to Arrow, and the frontend
materializes it as ECharts `source` rows. Call sites do not change:

```python
st.echarts_chart(
    {
        "dataset": {"source": df},
        "xAxis": {"type": "category"},
        "yAxis": {},
        "series": [{"type": "bar"}, {"type": "bar"}],
    }
)
```

### Proto

`ArrowNamedDataSet` is the repo's type for "a named Arrow table next to a spec." That is
this feature. The unused bits (`has_name`, `ArrowData.styler`) do not serialize when we
set `has_name = true` and leave `styler` unset. A one-off `{id, bytes}` message would be
the same join with new names.

`EChartsChart` currently reserves fields 4 and 5 for the `on_select` follow-up; the next
id is 7.

```protobuf
import "streamlit/proto/ArrowNamedDataSet.proto";

message EChartsChart {
  string spec = 1;
  string theme = 2;
  string id = 3;
  reserved 4, 5;
  Renderer renderer = 6;

  // Arrow IPC for dataframe-like dataset.source values, keyed by the
  // content-hash left in spec as {"name": "<hash>"}. Identical frames share
  // one entry.
  repeated ArrowNamedDataSet datasets = 7;

  // Next ID: 8
}
```

Do **not** add Vega's top-level `ArrowData data` field. `st.echarts_chart` has no separate
`data=` argument; every extracted table is a named `dataset.source`.

Always set `has_name = true` and `name = calc_hash(ipc_bytes)`. Leave `data.styler` unset.

The join key is the hash, and it lives in the spec on purpose: `preparedOption` is memoized
on `element.spec`, so a data-only change must change the spec string. A positional index
(`datasets[0]`) would leave `spec` byte-identical across data updates and skip `setOption`
— see [alternatives](#alternatives-considered).

### Python: extract, hash, marshal

`_convert_single_dataset` keeps the same trigger (`is_dataframe_like(source)`) and the
same `dimensions` / duplicate-label behavior. It stops calling `_dataframe_to_records`.

```python
def _to_arrow_dataset(data: Any, datasets: dict[str, bytes]) -> dict[str, str]:
    data_bytes = _serialize_echarts_arrow(data)
    name = calc_hash(data_bytes)  # hash the bytes, not str(bytes)
    datasets[name] = data_bytes
    return {"name": name}
```

Walk the same option variants as today (`dataset` object or list, plus `baseOption`,
timeline `options`, and `media[*].option`). For each dataframe-like `source`:

1. Stringify column labels and reject duplicates (`echarts-dataset-duplicate-columns`).
2. Serialize to Arrow IPC (see [Index and conversion path](#index-and-conversion-path)).
3. Name the blob with `calc_hash(data_bytes)` — content-addressed, so identical frames
   share one proto entry. Hash the bytes directly (BidiComponent does this; Vega's
   `calc_hash(str(data_bytes))` is an accidental `bytes`→`str` conversion we should not
   copy).
4. Replace `source` with `{"name": <hash>}`.
5. If the user did not set `dimensions`, set it to the stringified column labels.

Then `json.dumps` the option as today (`allow_nan=False`, no `default=`). The spec is now
small and JSON-only; the Arrow bytes live on `proto.datasets`.

`_copy_option_for_normalization` already avoids deepcopying dataframe sources. Keep that:
the copy still holds the original frame until extraction replaces it with the name ref.

A failed Arrow conversion raises a `StreamlitAPIException` with a dataset-specific
`error_id` (replace `echarts-dataset-not-json-serializable`, whose `to_json` framing no
longer applies). The message still names `dataset.source` and tells the user to convert or
drop the offending columns.

#### Index and conversion path

Today `DataFrame.to_json(orient="records")` **drops the pandas index**. Arrow default
(`preserve_index=None`) would *add* a non-RangeIndex as a column, which would be a
behavior change.

- Pandas / pandas-converted inputs: `convert_pandas_df_to_arrow_table(df, preserve_index=False)`.
- Polars / `pyarrow.Table`: existing `convert_anything_to_arrow_bytes` fast path. Those
  objects have no pandas index.
- Unevaluated frames (Polars LazyFrame, etc.): keep the existing 10k-row truncation and
  caption from `dataframe_util`.

Do not send pandas Styler CSS; only the underlying data. Type-incompatible pandas columns
are already stringified by `convert_pandas_df_to_arrow_table` /
`fix_arrow_incompatible_column_types` (geometry, some period freqs, mixed objects, …) —
the same Python path as `st.dataframe` / `st.table`.

#### Placeholder shape

`{"name": "<hash>"}` — the same join Vega puts in its spec, mapped to
`ArrowNamedDataSet.name`. ECharts does not treat that as a dataset reference; if it leaked
into `setOption` it would become a one-row object. The frontend **must** replace it before
`setOption`. Replacement is gated:

> `source` is a dict with exactly one key, `name`, whose value is a string that matches a
> `proto.datasets[].name`.

A user-authored one-row `{"name": "Matcha"}` is left alone: it does not match a content
hash. Hashes are hex digests. That gate is what makes `{name}` safe even though a `name`
column is a realistic ECharts row.

### Frontend: hydrate, then `setOption`

Reuse the dataframe Arrow stack for parse **and** per-type conversion. Do not call Vega's
`getDataArray` (wrong index/datetime policy) and do not build glide `GridCell`s.

Policy, matching how the three surfaces already treat Arrow:

- **Parse + classify** like all three: `Quiver` + `arrowTypeUtils` (`isStringType`,
  `isEmptyType`, `isBooleanType`, `isFloatType`, `isIntegerType` /
  `isUnsignedIntegerType`, `isDecimalType`, `isCategoricalType`, `isDatetimeType`,
  `isDateType`, `isTimeType`, `isDurationType`, `isPeriodType`, `isIntervalType`,
  `isListType`, `isObjectType`, `isBytesType`). `isIntegerType` already excludes
  period; `isNumericType` does not include duration.
- **Plottable values** like dataframe cells, not table display strings: finite numbers,
  bools, decoded categoricals, UTC epoch ms for datetime/date/time (the same math as
  `getCellFromArrow`: `convertTimeToDate` for `isTimeType`, `moment.utc(Number)` /
  `valueOf()` for datetime and date). Timezone metadata is display-only in
  `DateTimeColumn`; the cell value is still a UTC instant.
- **Non-plottable values** like `st.table` / dataframe `ObjectColumn`: `format()` from
  `arrowFormatUtils` (period, interval, struct/map/object, bytes). Table always runs
  `format` on every cell; we must not do that for floats and datetimes or axes break.
- **Duration** is the one chart-specific numeric mapping: table/`formatDuration` shows
  `"a few seconds"`; Vega passes the raw unit; we keep `formatDuration`'s unit math
  (`convertTimestampToSeconds`, default `TimeUnit.NANOSECOND`) and emit **milliseconds**
  so a value axis can plot it. Same idea as datetime: numeric instant, not the table
  string.
- **Do not copy Vega `getDataArray`**, dataframe `toSafeArray` (JSON-stringifies lists
  for the grid editor), or `DateTimeColumn`'s display timezone offset.

`convertTimestampToSeconds` is file-private in `arrowFormatUtils.ts` today
(`convertTimeToDate` and `formatDuration` both call it). Export it, or add a thin
exported `convertDurationToMilliseconds` next to `convertTimeToDate`. Do not copy the
unit table.

| Reuse | Do not reuse |
|---|---|
| `Quiver` / `parseArrowIpcBytes` — IPC parse, pandas schema, index vs data split, categoricals, column names | `getDataArray` — injects `(index)`, keeps only one index level, shifts naive datetimes into the local zone (a Vega JS assumption) |
| `arrowTypeUtils` classifiers (the full set `getColumnTypeFromArrow` uses, plus duration/period/interval which that function leaves as `ObjectColumn`) | DataFrame `getColumnTypeFromArrow` / `GridCell` mapping |
| `Quiver.getCell` — the decoded Arrow JS cell | DataFrame `toSafeArray` |
| `convertTimeToDate`, `convertTimestampToSeconds` (from `arrowFormatUtils`) — same unit math as dataframe time cells and table duration formatting | Vega's naive-datetime `getTimezoneOffset` hack |
| `format` (`arrowFormatUtils`) — **only** for types that are not plottable numbers/dates (period, interval, object, bytes). Same strings `st.table` / `st.dataframe` show | `format` for floats/dates (those must stay numeric for axes) |

Wrap each `ArrowNamedDataSet` in `Quiver` the same way Vega's `wrapDatasets` does. Then a
small ECharts helper (for example `arrowDataset.ts`) walks **data columns only**
(`colPos = numIndexColumns + colIndex`). That matches today's `to_json(orient="records")`,
which drops the pandas index. `preserve_index=False` on the Python side means a default
RangeIndex is metadata only; `Quiver` then reports `numIndexColumns === 0` for typical
frames.

Row keys are `contentType.arrowField.name`. Those strings are what Python used for
`dataset.dimensions` (`str(column)`), so `encode` / auto-assigned series keep working.
Do not use `columnNames[0][colPos]` (Vega): that is only the first header level and
breaks MultiIndex columns.

Walk option variants with the same shape as Python `_iter_option_variants` (the PNG-export
background check already mirrors this). Hydrate each matching `dataset.source` in place on
a copy of the parsed option. Missing bytes or a failed IPC parse surface as the existing
in-chart error overlay, not a thrown render.

Every `setOption` value must be JSON-like (`null` / `boolean` / `number` / `string` /
plain arrays of those). Arrow leftovers (`bigint`, `Uint32Array` decimals, `StructRow`,
`Vector`, `Date`) must not leak — they are what crash or silently blank an ECharts series.

#### Type conversion (`cellToEChartsValue`)

Input is `Quiver.getCell(row, colPos)` — `{ content, contentType, field }`, the same
decode `st.dataframe`, `st.table`, and Vega start from. Classify with `arrowTypeUtils`
before `typeof`: period is an int, time/duration are bigints, decimal is a
`Uint32Array`, interval is a struct. Check period/duration/time **before** the generic
`bigint` → `Number` fallback. Nullish `content` (`null` / `undefined`) is always `null`.

| Type (`arrowTypeUtils`) | `getCell().content` (today) | `st.dataframe` / `st.table` | Vega `getDataArray` | ECharts `source` value |
|---|---|---|---|---|
| missing / `isEmptyType` | `null` | empty / text cell | omitted/null | `null` (`pd.NA` / `NaT` / Arrow null decode as nullish content) |
| `isBooleanType` | `boolean` | checkbox | passthrough | `boolean` |
| `isStringType` | `string` | text | passthrough | `string` |
| `isCategoricalType` | decoded dict value (`string` / number) | selectbox label | passthrough | decoded value (`string`, or `Number` if `bigint`) |
| `isFloatType` | `number` (`NaN` / `±Infinity` possible) | number; `NaN` is missing/error | passthrough including `NaN` | `Number.isFinite` ? number : `null` (same gap as today's `to_json`) |
| `isIntegerType` / `isUnsignedIntegerType` (not period) | `number` or `bigint` | `toSafeNumber`; unsafe ints error in the grid | `Number(bigint)` | `Number(content)` (same `MAX_SAFE_INTEGER` caveat as Vega) |
| `isDecimalType` | `Uint32Array` (Arrow JS cannot decode scale) | `format` → decimal string → number cell | **passthrough `Uint32Array` (broken for Vega)** | `Number(format(content, type))` — DataFrame's decimal workaround, then a plottable number; non-finite → `null` |
| `isDatetimeType` | epoch `number` or `Date` (already ms, regardless of unit) | `getCellFromArrow` → `moment.utc(Number)`; tz only affects `DateTimeColumn` display | naive: add `getTimezoneOffset` so Vega JS treats UTC wall time as local; tz-aware: passthrough ms | **UTC epoch ms** (`Date` → `valueOf()`, number as-is). No Vega offset. Matches dataframe's cell value and ECharts `type: "time"` |
| `isDateType` | epoch `number` or `Date` (already ms) | `moment.utc` → `YYYY-MM-DD` display | same local-offset hack as naive datetime | UTC epoch ms (midnight UTC of that date), same as dataframe's `moment.utc` |
| `isTimeType` | raw `bigint`/`number` **in the field's unit** (s/ms/us/ns) | `convertTimeToDate` then `HH:mm:ss` | `Number(bigint)` **without unit conversion (wrong for ns)** | `convertTimeToDate(content, field).valueOf()` — DataFrame unit math (default unit **seconds**, pandas time), as epoch ms on 1970-01-01 UTC |
| `isDurationType` / timedelta | `bigint`/`number` in the field's unit (pandas default ns) | `ObjectColumn` + `formatDuration` → `"a few seconds"` (not plottable) | passthrough raw | `convertTimestampToSeconds(content, field.unit ?? NANOSECOND) * 1000` — **same default unit as `formatDuration`**, as **milliseconds** so a value axis can plot it |
| `isPeriodType` | `bigint` ordinal, not a timestamp | `ObjectColumn` + `formatPeriod` → `"2020-01"` | `Number(bigint)` (meaningless ordinal) | `format(content, type)` string — category label, same as the table |
| `isIntervalType` | `StructRow` (also `isObjectType`) | `formatInterval` → `"(0, 1]"` | passthrough struct | `format(content, type)` string |
| `isListType` | Arrow `Vector` | `ListColumn` via `toSafeArray` (stringifies for the editor) | passthrough `Vector` | JS array: `vector.toArray()`, then map each child with this same function using the list child field. Do **not** call `toSafeArray`. If `toArray` fails, `format` string (table `formatObject`) |
| `isObjectType` / struct / map | `StructRow` / object | `formatObject` JSON string | passthrough | `format(content, type)` string |
| `isBytesType` | `Uint8Array` | object column, formatted | passthrough | `format(content, type)` string |
| anything else | unknown | `String(x)` fallback in `format` | passthrough | `format(content, type)` string |

Python-side, `fix_arrow_incompatible_column_types` already stringifies geometry, mixed
objects, dicts, and a few period frequencies before IPC. Those columns arrive as strings
and take the `isStringType` row. Do not re-implement that list on the frontend.

Helper sketch (normative):

```ts
function cellToEChartsValue(
  content: DataType,
  type: ArrowType,
  field?: Field
): unknown {
  if (content == null || isEmptyType(type)) return null
  if (isFloatType(type) && typeof content === "number" && !Number.isFinite(content)) {
    return null
  }
  if (isDecimalType(type)) {
    const n = Number(format(content, type))
    return Number.isFinite(n) ? n : null
  }
  if (isTimeType(type) && (typeof content === "number" || typeof content === "bigint")) {
    return convertTimeToDate(content, field).valueOf()
  }
  if (isDatetimeType(type) || isDateType(type)) {
    const n = content instanceof Date ? content.valueOf() : Number(content)
    return Number.isFinite(n) ? n : null
  }
  if (isDurationType(type) && (typeof content === "number" || typeof content === "bigint")) {
    // Default unit matches formatDuration (pandas timedelta is ns).
    const unit = field?.type?.unit ?? TimeUnit.NANOSECOND
    return convertTimestampToSeconds(content, unit) * 1000
  }
  if (isListType(type)) {
    const vector = content as { toArray?: () => unknown[] }
    if (typeof vector.toArray === "function") {
      const childField =
        field?.type instanceof List || field?.type instanceof FixedSizeList
          ? field.type.children[0]
          : undefined
      const childType = childField
        ? { ...type, arrowField: childField, pandasType: undefined }
        : type
      return vector
        .toArray()
        .map(value => cellToEChartsValue(value as DataType, childType, childField))
    }
    return format(content, type)
  }
  if (
    isPeriodType(type) ||
    isIntervalType(type) ||
    isObjectType(type) ||
    isBytesType(type)
  ) {
    return format(content, type)
  }
  if (typeof content === "bigint") return Number(content)
  if (typeof content === "number" && !Number.isFinite(content)) return null
  return content
}
```

The `format` fallback is last so an unexpected Arrow object cannot reach `setOption`.
After conversion, assert JSON-like values only.

#### Why not copy Vega's datetime offset

Vega-Lite's default time parsing treats a JS `Date` / epoch as **local**. Naive pandas
timestamps are stored as UTC in Arrow, so Vega adds `getTimezoneOffset` to make the
calendar date look right on a Vega axis. ECharts `xAxis.type: "time"` treats numbers as
**UTC epoch ms**, and `st.dataframe` / `st.table` also format those values with
`moment.utc`. Using UTC epoch (no offset) is therefore what our table stack already
does, and what ECharts' time axis expects. Timezone-aware columns are already absolute
instants in Arrow; both Vega and the table leave them as ms — we do too.

Inline JSON timestamps in a user spec are unchanged (still whatever the user wrote).

Order of operations, inserted into the current `preparedOption` memo:

1. `JSON.parse(element.spec)`
2. Hydrate `{name}` → row arrays via `cellToEChartsValue`
3. `applyStreamlitOptionDefaults` / `withDefaultSeriesCursor` (these shallow-copy; they
   must not `JSON.stringify` the hydrated option, and today they do not)

`setOption` still receives a fully materialized option. ECharts never sees a `{name}`
placeholder.

#### `setOption` skip must stay valid

Unrelated reruns skip `setOption` when `preparedOption` identity is unchanged. That is
what preserves `dataZoom` / legend / toolbox / timeline state. Hydration must not produce a
new array identity on every render.

Memoize hydration on `element.spec` only. The placeholder names *are* content hashes, so
an unchanged spec implies unchanged data. `element.datasets` is a new protobuf object every
rerun even when the bytes are equal; putting it in the dep list would re-hydrate, rebuild
`preparedOption`, and reset interaction state. When `element.spec` *does* change, read
`element.datasets` from that render and hydrate.

### Identity (display-only today, widgets later)

Display-only unkeyed charts still skip `id`. The frontend's `preparedOption` memo is the
identity that matters, and it is already covered above.

When `on_select` lands, widget identity without a `key` must include the data, or a data
change would keep a stale selection. Follow Vega:

```python
named_datasets = [dataset.name for dataset in proto.datasets]
```

The names are content hashes, so listing names is enough. This spec does not implement
selections; it only requires that extraction leave names a later PR can hash.

### Docs / product-spec wording

On implementation, update:

- The `st.echarts_chart` docstring ("converts it to JSON records") to say Streamlit ships
  the dataframe as Arrow and injects it as `dataset.source` in the browser. Users do not
  need to know the placeholder.
- [`specs/2026-07-06-echarts-chart/product-spec.md`](../2026-07-06-echarts-chart/product-spec.md)
  "DataFrames in `dataset.source`" — same amendment. The public examples stay identical.

## Out of Scope (Future Work)

- **`series.data` / `xAxis.data` / `radar.indicator` dataframes.** Still rejected. Expanding
  conversion sites is a product change, not a transport change.
- **Columnar / TypedArray `source`.** ECharts accepts `{col: Float64Array, ...}` and that
  would avoid allocating one object per row. The measured problem is Python CPU and wire
  size; records hydration preserves encode/transform parity. Revisit if client cost shows
  up in profiling.
- **`appendData` streaming** and **`setOption` merge / `universalTransition`.** Independent
  follow-ups in the product spec and the charting reference.
- **Plotly / pydeck Arrow.** Same class of problem, different engines. Not this spec.
- **Fixing Vega's `calc_hash(str(data_bytes))`.** Tempting while we are here; it is a
  behavior-adjacent change on a shipped command. Leave it.

## Testing

Python (`echarts_chart_test.py`):

- A dataframe `dataset.source` leaves `{"name": <hash>}` in the spec, one `datasets` entry
  whose Arrow bytes round-trip to the same columns/values (index not present), and
  `dimensions` equal to the column labels.
- User-provided `dimensions` are not overwritten.
- Duplicate stringified column labels still raise `echarts-dataset-duplicate-columns`.
- List of datasets, `baseOption`, timeline `options`, and `media[*].option` each extract.
- Two identical frames share one proto entry (same name, one blob).
- An already-JSON `source` (list of records / 2D array) does not populate `datasets`.
- A dataframe in `series.data` still raises and mentions `dataset.source`.
- Arrow conversion failure uses the new dataset `error_id`.
- JSON string / pyecharts inputs with no dataframe: `datasets` empty, spec unchanged.
- Mixed dtypes round-trip through Arrow (not JSON records): datetime64, timezone-aware
  datetime, date, timedelta, nullable Int64/Float64, bool, categorical, decimal. The spec
  JSON contains `{"name": <hash>}` rather than ISO timestamp strings (today's
  `test_dataset_source_datetime_and_nan_normalized` moves to the frontend).
- `fix_arrow_incompatible_column_types` still stringifies geometry / mixed object /
  unsupported period frequencies before IPC, same as `st.dataframe`.

Frontend (`EChartsChart.test.tsx` + `arrowDataset` unit tests):

- `setOption` receives row objects, never `{name: hash}`.
- Unrelated rerun with the same spec does not call `setOption` again (dataZoom regression).
- Spec change with a new hash re-hydrates and calls `setOption` once.
- Missing blob / corrupt IPC → in-chart error overlay.
- Timeline and media variants hydrate.
- Pandas index is omitted from rows (including a RangeIndex).
- Row keys equal `arrowField.name` / Python `dimensions` (including integer column labels
  like `2015` and a MultiIndex column).
- Type fixtures — reuse `frontend/lib/src/mocks/arrow/types/` (same IPC Vega and
  `arrowFormatUtils` already test) and construct apache-arrow tables for types those
  mocks do not cover (time, bool, list, tz-aware datetime):

  | Fixture / dtype | Expected ECharts cell | Must match |
  |---|---|---|
  | `FLOAT64` | numbers; `NaN` / `±Inf` → `null` | today's `to_json`; not Vega (`NaN` passthrough) |
  | `INT64` / `UINT64` | `number` (not `bigint`) | Vega `Number(bigint)` |
  | `UNICODE` | strings | all three |
  | `CATEGORICAL` / dictionary | decoded labels | Quiver / SelectboxColumn |
  | `DATETIME` / `DATE` | UTC epoch ms, **no** Vega local offset | dataframe `getCellFromArrow` + `moment.utc` |
  | `DATETIMETZ` | UTC epoch ms (absolute instant) | dataframe/table; Vega also leaves tz-aware as ms |
  | time (`isTimeType`) | `convertTimeToDate(...).valueOf()` | dataframe TimeColumn unit math |
  | decimal | finite `number` (not `Uint32Array`) | dataframe decimal workaround |
  | timedelta / duration | milliseconds `number` (ns → `/ 1e6`) | `formatDuration` units, not its display string |
  | period | `formatPeriod` string (e.g. `"2020-01"`) | table / ObjectColumn |
  | interval | `formatInterval` string (e.g. `"(0, 1]"`) | table |
  | bool | `boolean` | all three |
  | list | JS array of primitives (recurse; no `toSafeArray`) | chart-usable lists; table would stringify |
  | bytes / struct | `format` string | table / ObjectColumn |

  Assert every value is `null`, `boolean`, `number`, `string`, or a plain array of those
  — never `bigint`, `Date`, `Uint8Array`, `Uint32Array`, `Vector`, or `StructRow`.

Keep an e2e that renders `dataset.source = df` (numeric + datetime columns) and snapshots
the chart so a missed hydrate or a leaked Arrow object cannot ship as an empty plot.

## Alternatives Considered

**Option 1: `ArrowNamedDataSet` + `{name}` placeholder, records hydration ✅ PREFERRED**

- Pros: We need named Arrow blobs referenced from a JSON spec — that *is* this message.
  One type in the repo; `has_name` / `styler` cost nothing on the wire (true / unset).
  Content-addressed dedup; a data change changes the spec string, so the existing
  `preparedOption` memo still skips no-op `setOption`. Records match today's ECharts
  `source` shape, so encode/transform/auto-series do not need a new contract.
- Cons: ECharts does not understand `{name}`; hydration is mandatory. A 1-row
  `{"name": "Matcha"}` is a plausible user source, so the hydrate gate must require a
  matching proto name (a hex hash). Records still allocate one object per row in the
  browser (the Python/wire cost is the one we measured).

**Option 2: Slim `{id, bytes}` message + `{arrow: id}` placeholder** ❌

- Pros: No `has_name`, no nested styler, `{arrow}` is a less plausible 1-row source.
- Cons: A second type for the same join. The unused `ArrowNamedDataSet` fields do not
  serialize in our usage. Not worth the extra proto surface.

**Option 3: `map<string, bytes>`** ❌

- Pros: No extra message; lookup is the map.
- Cons: Proto3 maps are unordered. Throws away the named-dataset type we already have.

**Option 4: Positional `repeated bytes` and `{"name": 0}` / `{"arrow": 0}`** ❌

- Pros: No hash step; slightly smaller spec.
- Cons: `element.spec` would not change when only the rows change, so the `preparedOption`
  memo would skip `setOption` and show stale data. Python and the frontend would also have
  to agree on walk order across timeline/media variants. Dedup needs a second layer.

**Option 5: Empty `source` + join on ECharts `dataset.id`** ❌

- Pros: No placeholder object; uses an option key ECharts already has.
- Cons: Overwrites a user-set `dataset.id`; timeline ticks can share structure without
  sharing ids; a missed hydrate is an empty chart, which is harder to debug than a one-row
  oddity.

**Option 6: Keep inlining JSON records** ❌

- Pros: Zero proto/FE work; tests already cover it.
- Cons: Leaves `st.echarts_chart` as the most expensive command at 100k rows; fights the
  whole point of accepting dataframes at `dataset.source`.

**Option 7: `MixedData` (BidiComponent `json` + `arrow_blobs` map)** ❌

- Pros: Generic JSON-with-holes; already implemented for custom components.
- Cons: Built for *arbitrary* first-level dict values, not a known `dataset.source` slot.
  Nesting `MixedData` inside `EChartsChart` (or replacing `spec` with a oneof) is a larger
  proto break for a narrower problem.

**Option 8: Call Vega `getDataArray` as-is** ❌

- Pros: Zero new conversion code.
- Cons: Injects `(index)`; uses only the first MultiIndex header level as the field name;
  applies a local-timezone offset that ECharts time axes do not want; passes through
  `bigint` times without unit conversion, `Uint32Array` decimals, duration raw units,
  period ordinals, and Arrow `Vector`/`StructRow`. The ECharts helper shares `Quiver` +
  `arrowTypeUtils` with Vega and the table, but must use the dataframe unit/decimal/format
  helpers for the types Vega leaves raw.

**Option 9: Columnar TypedArray `source` in v1** ❌ (defer)

- Pros: Best large-data form ECharts documents; keeps data columnar end to end.
- Cons: Nullable ints cannot live in a TypedArray (need JS arrays with `null`); untested
  against `dataset.transform` and object-style `encode` in our suite. Easy to add later
  behind the same proto — only the FE converter changes.

**Datetime as ISO strings** ❌

- Pros: Byte-for-byte match with today's `to_json(date_format="iso")` tests.
- Cons: Extra FE work to format values Arrow already gives as times; worse for
  `type: "time"` axes; diverges from dataframe/table UTC epoch. Command is unreleased
  enough that this is an acceptable mapping change, scoped to Arrow-backed dataframe
  columns only. Inline JSON timestamps in a user spec are unchanged.
