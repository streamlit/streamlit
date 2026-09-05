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
dataframe/table type helpers (not Vega's passthrough), except datetime/date which stay
ISO-8601 strings so ECharts category axes and default `useUTC: false` keep today's
wall-clock labels. Duration is milliseconds.

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
materializes it as ECharts `source` rows (datetime/date as ISO-8601 strings, duration as
milliseconds). Call sites do not change:

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
this feature. `ArrowNamedDataSet` already carries the required name-presence flag; set
`has_name = true`. Leave `data.styler` unset, so no styler payload is serialized. A
one-off `{id, bytes}` message would be the same join with new names.

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

Walk `_iter_option_variants` (the option itself, `baseOption`, timeline `options`, and
`media[*].option`). For each dataframe-like `source`:

1. Serialize to an Arrow table with no pandas-index fields (see
   [Index and conversion path](#index-and-conversion-path)).
2. Stringify that table's **data** field names and reject duplicates
   (`echarts-dataset-duplicate-columns`). Those strings are the frontend row keys
   (`contentType.arrowField.name`) and the `dataset.dimensions` labels.
3. Name the blob with `calc_hash(data_bytes)` — content-addressed, so identical frames
   share one proto entry. Hash the bytes directly (custom components v2 already hash
   Arrow IPC bytes; Vega's `calc_hash(str(data_bytes))` is an accidental `bytes`→`str`
   conversion we should not copy).
4. Replace `source` with `{"name": <hash>}`.
5. If the user did not set `dimensions`, set it to those stringified field names.

Then `json.dumps` the option as today (`allow_nan=False`, no `default=`). The spec is now
small and JSON-only; the Arrow bytes live on `proto.datasets`.

`_copy_option_for_normalization` already avoids deepcopying dataframe sources. Keep that:
the copy still holds the original frame until extraction replaces it with the name ref.

A failed Arrow conversion raises a `StreamlitAPIException` with a dataset-specific
`error_id` (replace `echarts-dataset-not-json-serializable`, whose `to_json` framing no
longer applies). The message still names `dataset.source` and tells the user to convert or
drop the offending columns.

#### Index and conversion path

Today `DataFrame.to_json(orient="records")` **drops the pandas index**. The Arrow helpers
do not guarantee that by themselves:

- `convert_anything_to_arrow_bytes` only fast-paths `pyarrow.Table` and Polars. Everything
  else falls through to `convert_pandas_df_to_arrow_bytes`, which uses `preserve_index=None`
  and **adds** a non-`RangeIndex` as a data column — a silent row-shape change vs today.
- A `pyarrow.Table` from `pa.Table.from_pandas(df)` can already contain a materialized
  index field plus pandas metadata. Hashing that table as-is would put the index on the
  wire; if `dimensions` came from schema field names, those labels would include it even
  if hydration later skipped the column.

Do not call `convert_anything_to_arrow_bytes`. Route so the pandas index never becomes a
data column:

- **Polars DataFrame / Series:** `to_arrow()` (no pandas index). Data field names are the
  `dimensions` labels and the frontend row keys.
- **Polars LazyFrame and other unevaluated frames:** keep the existing 10k-row truncation
  and caption from `dataframe_util`, then the Polars `to_arrow()` path (or the pandas path
  below if the object is not Polars).
- **`pyarrow.Table`:** if `schema.pandas_metadata` is present, `table.to_pandas()` then
  `convert_pandas_df_to_arrow_table(df, preserve_index=False)`. Do **not** drop physical
  index fields while leaving `pandas_metadata["index_columns"]` pointing at them —
  `table.select` / `drop` keep the pandas schema, and Quiver throws
  `Index field … not found in arrow schema` during parse. Going through pandas restores
  the index and then omits it, so leftover metadata cannot name a missing field.
  Tables with no pandas metadata (Polars / raw Arrow) serialize with
  `convert_arrow_table_to_arrow_bytes` as-is. `dimensions` and the duplicate check use
  the remaining data field names.
- **Everything else** (pandas, Snowpark, numpy, …): `convert_anything_to_pandas_df` then
  `convert_pandas_df_to_arrow_table(df, preserve_index=False)`. `False` **omits** the
  index entirely (`None` would store a RangeIndex as pandas metadata and a non-RangeIndex
  as a real column). `dimensions` are `str(column)` of the pandas columns, which match
  the Arrow data field names the frontend uses as row keys.

Do not send pandas Styler CSS; only the underlying data. Type-incompatible pandas columns
are already stringified by `convert_pandas_df_to_arrow_table` /
`fix_arrow_incompatible_column_types` (geometry, some period freqs, mixed objects, …) —
the same Python path as `st.dataframe` / `st.table`.

#### Placeholder shape

`{"name": "<hash>"}` — the same join Vega puts in its spec, mapped to
`ArrowNamedDataSet.name`. ECharts does not treat that as a dataset reference; if it leaked
into `setOption` it would become a one-row object. The frontend **must** replace it before
`setOption`.

Hydrate **iff** `source` is a dict with exactly one key, `name`, whose value is a string
that equals some `proto.datasets[].name` (hashes are hex digests):

- **No matching proto name** → user-authored source (for example `{"name": "Matcha"}`).
  Leave it inline. Do **not** show the error overlay.
- **Name matches** an `ArrowNamedDataSet` whose `data.data` bytes are absent or fail to
  parse → existing in-chart error overlay. Do **not** call `setOption` with the
  placeholder (a dropped blob must not silently render as a one-row chart).

That gate is what makes `{name}` safe even though a `name` column is a realistic ECharts
row. The overlay is only for a hash we emitted whose bytes did not arrive.

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
  bools, decoded categoricals. Datetime/date are the exception to "numeric like the
  dataframe cell": they become ISO-8601 strings so ECharts' default `useUTC: false` and
  `type: "category"` axes keep today's wall-clock labels (see
  [Datetime/date display contract](#datetimedate-display-contract)). Time-of-day still
  uses `convertTimeToDate` (epoch ms on 1970-01-01 UTC). Timezone metadata is display-only
  in `DateTimeColumn`; it only affects whether we append `Z` on tz-aware timestamps.
- **Non-plottable values** like `st.table` / dataframe `ObjectColumn`: `format()` from
  `arrowFormatUtils` (period, interval, struct/map/object, bytes). Table always runs
  `format` on every cell; we must not do that for floats or we break value axes.
- **Duration** is the one chart-specific numeric mapping: table/`formatDuration` shows
  `"a few seconds"`; Vega passes the raw unit; we emit **milliseconds** with bigint
  arithmetic at millisecond precision (do not reuse `convertTimestampToSeconds * 1000`,
  which truncates unsafe nanosecond bigints to whole seconds). Same idea as a value-axis
  number, not the table string.
- **Do not copy Vega `getDataArray`**, dataframe `toSafeArray` (JSON-stringifies lists
  for the grid editor), or Vega's naive-datetime `getTimezoneOffset` hack. Datetime/date
  use ISO strings instead of offset epoch ms.

`convertTimeToDate` is already exported from `arrowFormatUtils.ts`. Add a thin exported
`convertDurationToMilliseconds` next to it (pandas timedelta default unit **nanoseconds**).
Convert to milliseconds in bigint *before* `Number()` so timedeltas whose nanosecond count
exceeds `MAX_SAFE_INTEGER` (≳104 days) still keep whole-millisecond precision. Do not
implement duration as `convertTimestampToSeconds(...) * 1000` — that helper truncates
unsafe bigints to whole seconds, then multiplying by 1000 cannot recover the lost
fractional second. Do not copy the unit table into ECharts code.

| Reuse | Do not reuse |
|---|---|
| `Quiver` / `parseArrowIpcBytes` — IPC parse, pandas schema, index vs data split, categoricals, column names | `getDataArray` — injects `(index)`, keeps only one index level, shifts naive datetimes into the local zone (a Vega JS assumption) |
| `arrowTypeUtils` classifiers (the full set `getColumnTypeFromArrow` uses, plus duration/period/interval which that function leaves as `ObjectColumn`) plus `getTimezone` | DataFrame `getColumnTypeFromArrow` / `GridCell` mapping |
| `Quiver.getCell` — the decoded Arrow JS cell | DataFrame `toSafeArray` |
| `convertTimeToDate`, new `convertDurationToMilliseconds` (from `arrowFormatUtils`) — same unit math as dataframe time cells; duration at millisecond precision | Vega's naive-datetime `getTimezoneOffset` hack; `convertTimestampToSeconds * 1000` for duration |
| `format` (`arrowFormatUtils`) — **only** for types that are not plottable numbers/dates (period, interval, object, bytes). Same strings `st.table` / `st.dataframe` show | `format` for floats (those must stay numeric for axes). Datetime/date use a dedicated ISO conversion, not table `format` |

Wrap each `ArrowNamedDataSet` in `Quiver` the same way Vega's `wrapDatasets` does. Then a
small ECharts helper (for example `arrowDataset.ts`) walks **data columns only**
(`colPos = numIndexColumns + colIndex`) and never emits index fields. That matches today's
`to_json(orient="records")`, which drops the pandas index. Python uses
`preserve_index=False` on every pandas path, so a typical frame has no index fields on the
wire — but do **not** assert `numIndexColumns === 0`. `False` omits the index; `None`
would report `numIndexColumns === 1` for a default RangeIndex. The walk is the frontend
invariant even if a `pyarrow.Table` still carries leftover pandas index metadata.

Row keys are `contentType.arrowField.name`. Those strings are what Python used for
`dataset.dimensions` (`str(column)`), so `encode` / auto-assigned series keep working.
Do not use `columnNames[0][colPos]` (Vega): that is only the first header level and
breaks MultiIndex columns.

Walk option variants with the same shape as Python `_iter_option_variants` (the PNG-export
background check already mirrors this). Hydrate each matching `dataset.source` in place on
a copy of the parsed option, following the [placeholder gate](#placeholder-shape): only a
name that matches `proto.datasets[].name` is replaced; missing or unparseable bytes for a
matched name use the in-chart error overlay, not a thrown render or a leaked placeholder.

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
| `isDatetimeType` | epoch `number` or `Date` (already ms, regardless of unit) | `getCellFromArrow` → `moment.utc(Number)`; tz only affects `DateTimeColumn` display | naive: add `getTimezoneOffset` so Vega JS treats UTC wall time as local; tz-aware: passthrough ms | **ISO-8601 string**. Naive: timezone-less `YYYY-MM-DDTHH:mm:ss.SSS` (matches `to_json(date_format="iso")`). Tz-aware (`getTimezone(type)` set): same with a trailing `Z`. Not epoch ms — see [Datetime/date display contract](#datetimedate-display-contract) |
| `isDateType` | epoch `number` or `Date` (already ms) | `moment.utc` → `YYYY-MM-DD` display | same local-offset hack as naive datetime | Same timezone-less ISO as naive datetime (`YYYY-MM-DDTHH:mm:ss.SSS` at midnight), matching pandas `to_json` for `datetime.date` |
| `isTimeType` | raw `bigint`/`number` **in the field's unit** (s/ms/us/ns) | `convertTimeToDate` then `HH:mm:ss` | `Number(bigint)` **without unit conversion (wrong for ns)** | `convertTimeToDate(content, field).valueOf()` — DataFrame unit math (default unit **seconds**, pandas time), as epoch ms on 1970-01-01 UTC |
| `isDurationType` / timedelta | `bigint`/`number` in the field's unit (pandas default ns) | `ObjectColumn` + `formatDuration` → `"a few seconds"` (not plottable) | passthrough raw | `convertDurationToMilliseconds(content, field.unit ?? NANOSECOND)` — **milliseconds**, bigint÷ms *before* `Number()` so values ≳104 days keep whole-ms precision |
| `isPeriodType` | `bigint` ordinal, not a timestamp | `ObjectColumn` + `formatPeriod` → `"2020-01"` | `Number(bigint)` (meaningless ordinal) | `format(content, type)` string — category label, same as the table |
| `isIntervalType` | `StructRow` (also `isObjectType`) | `formatInterval` → `"(0, 1]"` | passthrough struct | `format(content, type)` string |
| `isListType` | Arrow `Vector` | `ListColumn` via `toSafeArray` (stringifies for the editor) | passthrough `Vector` | Plain JS array built with `vector.get(i)` (null slots stay `null`). Do **not** use `vector.toArray()`: for primitive children it returns the values buffer as a typed array and ignores the validity bitmap, so nulls become `0` before `Array.from`. Do **not** call `toSafeArray`. If the value is not a Vector with `get`/`length`, `format` string (table `formatObject`) |
| `isObjectType` / struct / map | `StructRow` / object | `formatObject` JSON string | passthrough | `format(content, type)` string |
| `isBytesType` | `Uint8Array` | object column, formatted | passthrough | `format(content, type)` string |
| anything else | unknown | `String(x)` fallback in `format` | passthrough | `format(content, type)` string |

Python-side, `fix_arrow_incompatible_column_types` already stringifies geometry, mixed
objects, dicts, and a few period frequencies before IPC. Those columns arrive as strings
and take the `isStringType` row. Do not re-implement that list on the frontend.

Helper sketch (normative):

```ts
function convertDurationToMilliseconds(
  timestamp: number | bigint,
  unit: TimeUnit
): number {
  // Convert to milliseconds in bigint before Number() so nanosecond values
  // above MAX_SAFE_INTEGER (timedeltas ≳104 days) keep whole-ms precision.
  if (unit === TimeUnit.NANOSECOND) {
    return typeof timestamp === "bigint"
      ? Number(timestamp / 1_000_000n)
      : Number(timestamp) / 1e6
  }
  if (unit === TimeUnit.MICROSECOND) {
    return typeof timestamp === "bigint"
      ? Number(timestamp / 1_000n)
      : Number(timestamp) / 1e3
  }
  if (unit === TimeUnit.MILLISECOND) {
    return Number(timestamp)
  }
  return Number(timestamp) * 1000 // seconds
}

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
    if (!Number.isFinite(n)) return null
    const iso = moment.utc(n).format("YYYY-MM-DDTHH:mm:ss.SSS")
    return getTimezone(type) ? `${iso}Z` : iso
  }
  if (isDurationType(type) && (typeof content === "number" || typeof content === "bigint")) {
    const unit = field?.type?.unit ?? TimeUnit.NANOSECOND
    return convertDurationToMilliseconds(content, unit)
  }
  if (isListType(type)) {
    const vector = content as {
      length?: number
      get?: (index: number) => unknown
    }
    if (typeof vector.length === "number" && typeof vector.get === "function") {
      const childField =
        field?.type instanceof List || field?.type instanceof FixedSizeList
          ? field.type.children[0]
          : undefined
      const childType = childField
        ? { ...type, arrowField: childField, pandasType: undefined }
        : type
      // vector.get(i) returns null for invalid slots. Do not use toArray():
      // primitive lists ignore the validity bitmap and fill nulls with 0.
      return Array.from({ length: vector.length }, (_, i) =>
        cellToEChartsValue(vector.get(i) as DataType, childType, childField)
      )
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
Do **not** scan every hydrated cell in production for JSON-likeness — on a 100k-row frame
that is another pass over the hot path this spec is trying to speed up. Assert JSON-like
values in `arrowDataset` unit tests (the type fixtures already required).

#### Datetime/date display contract

ECharts formats time-axis numbers in the **browser local zone** unless `useUTC` is true.
Streamlit never sets `useUTC` today, and must not start setting it as a default: that
would re-parse user-authored timezone-less ISO timestamps already in the spec JSON as UTC.

UTC epoch ms is therefore the wrong *display* form for naive datetime/date, even though it
is the dataframe cell's storage form:

1. **Naive timestamps would shift.** Today `pd.Timestamp("2020-01-01")` is
   `"2020-01-01T00:00:00.000"` (no `Z`); ECharts parses timezone-less ISO as local, so the
   label stays `2020-01-01`. Epoch `1577836800000` (Arrow UTC midnight) renders as
   `2019-12-31 19:00` for a `UTC-5` viewer — the class of bug Vega's `getTimezoneOffset`
   exists to avoid — and would disagree with `st.line_chart` / Altair for the same frame.
2. **Category axes would lose readable labels.** The product-spec examples use
   `xAxis: {"type": "category"}`. Category axes stringify the raw cell; ISO dates would
   become `"1577836800000"`.

**Normative mapping:** emit ISO-8601 strings (not epoch numbers):

- Naive datetime / date: timezone-less `YYYY-MM-DDTHH:mm:ss.SSS`, matching
  `DataFrame.to_json(date_format="iso")`. ECharts local-parse keeps the wall-clock
  calendar date; category axes show the ISO string.
- Timezone-aware datetime (`getTimezone(type)` is set): the same string with a trailing
  `Z`. ECharts treats `Z` as a UTC instant and displays it in the browser zone — correct
  for an absolute instant, and the same policy Vega uses for tz-aware columns.

Do **not** apply Vega's `getTimezoneOffset` to epoch ms: that would fix wall-clock on
`type: "time"` but still print epoch numbers on category axes. Timezone-aware columns stay
absolute instants (ISO-with-`Z` rather than Vega's raw ms). Inline JSON timestamps in a
user spec are unchanged (still whatever the user wrote). `isTimeType` is unchanged:
`convertTimeToDate(content, field).valueOf()` (dummy 1970-01-01 UTC, dataframe TimeColumn
unit math).

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

- The `st.echarts_chart` docstring: Streamlit accepts dataframe-like values in
  `dataset.source` and preserves column order through `dataset.dimensions` when it is not
  provided. Do not explain Arrow transport or browser injection in the public docstring.
  Document user-visible dtype mapping (datetime ISO strings, duration as milliseconds)
  separately on the implementation PR.
- [`specs/2026-07-06-echarts-chart/product-spec.md`](../2026-07-06-echarts-chart/product-spec.md)
  "DataFrames in `dataset.source`" — amend "converts each to JSON-compatible rows" to
  match the transport. The public examples stay identical.

## Out of Scope (Future Work)

- **`series.data` / `xAxis.data` / `radar.indicator` dataframes.** Still rejected. Expanding
  conversion sites is a product change, not a transport change.
- **Columnar / TypedArray `source`.** ECharts accepts `{col: Float64Array, ...}` and that
  would avoid allocating one object per row. The measured problem is Python CPU and wire
  size; records hydration preserves encode/transform parity. Revisit if a repeatable
  implementation-time check of backend payload build, transferred size, and browser
  hydration for a representative large frame (100k rows × 5 numeric columns, first render)
  shows client cost dominating. That check is required on the implementation PR; it is
  not a merge blocker for this spec.
- **`appendData` streaming** and **`setOption` merge / `universalTransition`.** Independent
  follow-ups in the product spec and the charting reference.
- **Plotly / pydeck Arrow.** Same class of problem, different engines. Not this spec.
- **Fixing Vega's `calc_hash(str(data_bytes))`.** Tempting while we are here; it is a
  behavior-adjacent change on a shipped command. Leave it.

## Testing

Python (`echarts_chart_test.py`):

- A dataframe `dataset.source` leaves `{"name": <hash>}` in the spec, one `datasets` entry
  whose Arrow bytes round-trip to the same columns/values (index not present), and
  `dimensions` equal to the data-column field names.
- A pandas frame with a **named** (non-Range) index does not put that index on the wire
  or in `dimensions` — guards against an accidental `preserve_index=None` fallback.
- A `pyarrow.Table` from `pa.Table.from_pandas` with a materialized pandas index does not
  put that index on the wire or in `dimensions`, and the serialized pandas metadata does
  not name a missing index field (Quiver would throw `Index field … not found in arrow
  schema`).
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
- A user-authored `{"name": "Matcha"}` source is **not** replaced (hydrate gate).
- Unrelated rerun with the same spec does not call `setOption` again (dataZoom regression).
- Spec change with a new hash re-hydrates and calls `setOption` once.
- Missing blob / corrupt IPC **for a name that matches** `proto.datasets[].name` →
  in-chart error overlay. A non-matching name does not overlay.
- Timeline and media variants hydrate.
- Pandas index is omitted from rows (RangeIndex **and** a named index).
- Row keys equal `arrowField.name` / Python `dimensions` (including integer column labels
  like `2015` and a MultiIndex column).
- Naive datetime/date axis labels under a **non-UTC** timezone match today's wall-clock
  calendar date (ISO without `Z`); a `type: "category"` axis shows the ISO string, not an
  epoch number.
- Type fixtures — reuse `frontend/lib/src/mocks/arrow/types/` (same IPC Vega and
  `arrowFormatUtils` already test) and construct apache-arrow tables for types those
  mocks do not cover (time, bool, list, tz-aware datetime, duration > `MAX_SAFE_INTEGER`
  nanoseconds):

  | Fixture / dtype | Expected ECharts cell | Must match |
  |---|---|---|
  | `FLOAT64` | numbers; `NaN` / `±Inf` → `null` | today's `to_json`; not Vega (`NaN` passthrough) |
  | `INT64` / `UINT64` | `number` (not `bigint`) | Vega `Number(bigint)` |
  | `UNICODE` | strings | all three |
  | `CATEGORICAL` / dictionary | decoded labels | Quiver / SelectboxColumn |
  | `DATETIME` / `DATE` | timezone-less ISO `YYYY-MM-DDTHH:mm:ss.SSS` | today's `to_json`; wall-clock under `useUTC: false` |
  | `DATETIMETZ` | ISO with trailing `Z` (UTC instant) | absolute instant, local display |
  | time (`isTimeType`) | `convertTimeToDate(...).valueOf()` | dataframe TimeColumn unit math |
  | decimal | finite `number` (not `Uint32Array`) | dataframe decimal workaround |
  | timedelta / duration | milliseconds `number` | `convertDurationToMilliseconds`; not `formatDuration`'s string |
  | duration `bigint` ns > `MAX_SAFE_INTEGER` (≳104 days + a fractional second) | milliseconds with whole-ms precision | not `convertTimestampToSeconds * 1000` |
  | period | `formatPeriod` string (e.g. `"2020-01"`) | table / ObjectColumn |
  | interval | `formatInterval` string (e.g. `"(0, 1]"`) | table |
  | bool | `boolean` | all three |
  | list (float, int64, nullable, nested) | plain `Array` (`Array.isArray`; not a typed array); null children stay `null` (`vector.get(i)`, not `toArray()`) | chart-usable lists; table would stringify |
  | bytes / struct | `format` string | table / ObjectColumn |

  Assert every value is `null`, `boolean`, `number`, `string`, or a plain array of those
  — never `bigint`, `Date`, `Uint8Array`, `Uint32Array`, typed arrays, `Vector`, or
  `StructRow`. This assertion lives in unit tests, not as a production full-table scan.

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
  applies a local-timezone offset that we do not want as epoch ms (category axes would
  still show numbers); passes through `bigint` times without unit conversion,
  `Uint32Array` decimals, duration raw units, period ordinals, and Arrow
  `Vector`/`StructRow`. The ECharts helper shares `Quiver` + `arrowTypeUtils` with Vega
  and the table, but must use the dataframe unit/decimal/format helpers for the types
  Vega leaves raw.

**Option 9: Columnar TypedArray `source` in v1** ❌ (defer)

- Pros: Best large-data form ECharts documents; keeps data columnar end to end.
- Cons: Nullable ints cannot live in a TypedArray (need JS arrays with `null`); untested
  against `dataset.transform` and object-style `encode` in our suite. Easy to add later
  behind the same proto — only the FE converter changes. Trigger: the implementation-time
  100k × 5 hydration check in Out of Scope.

**Datetime/date as ISO-8601 strings** ✅ PREFERRED (datetime/date only)

- Pros: Matches today's `to_json(date_format="iso")` display: naive timestamps stay
  wall-clock under ECharts' default `useUTC: false`; category axes show ISO labels, not
  epoch numbers. Time axes still parse ISO. No Streamlit `useUTC` default, so
  user-authored timezone-less ISO already in the spec JSON is unchanged.
- Cons: Extra FE formatting vs passing Arrow's epoch through; diverges from the
  dataframe/table *cell* (UTC epoch ms). Acceptable: ECharts `useUTC: false` means that
  cell value is not the displayed value.

**UTC epoch ms for datetime/date (no offset, no `useUTC`)** ❌

- Pros: Matches dataframe `getCellFromArrow` storage; cheapest conversion; good *storage*
  form for `type: "time"`.
- Cons: Naive `pd.Timestamp("2020-01-01")` shifts in non-UTC browsers (UTC-5 →
  `2019-12-31 19:00`); category axes stringify `"1577836800000"`. Disagrees with
  `st.line_chart` / Altair for the same frame.

**UTC epoch ms plus Streamlit `useUTC: true` default** ❌

- Pros: Time-axis ticks would show UTC wall-clock for naive timestamps.
- Cons: Re-parses user-authored timezone-less ISO in the spec JSON as UTC (behavior
  change for inline timestamps). Category axes still show epoch numbers.

**Vega-style `getTimezoneOffset` on naive datetime/date epoch ms** ❌

- Pros: Preserves wall-clock on `type: "time"` under `useUTC: false`; matches Altair.
- Cons: Category axes still stringify epoch numbers. Copies a Vega JS assumption this
  spec otherwise refuses.
