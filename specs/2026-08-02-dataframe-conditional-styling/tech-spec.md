---
author: lukasmasuch
created: 2026-08-02
---

# Conditional cell color — technical design

## Summary

Implement the minimal `color` parameter for continuous `column_config` column types (see
`product-spec.md`). A single new shared `ColumnConfig` field — `color` — carries a compact
declarative spec (a **rule list** or a **gradient**) that is serialized as part of the
existing `columns` JSON and evaluated in the frontend when each `GridCell` is built, setting
`themeOverride.bgCell` plus a readable text color. Rules are evaluated **per-row against the
cell's own value**; the gradient interpolates the cell's value across the column's *explicit*
`min_value`/`max_value`. Neither reads other rows, so there is no column scan and no
data-derived domain state. No proto changes and no per-cell backend computation are required.

## Problem

Per-cell colors today come only from `pandas.Styler`: the backend computes CSS per cell
(`marshall_styler` in `lib/streamlit/elements/lib/pandas_styler_utils.py`) and the frontend
regex-parses it into a glide-data-grid `themeOverride` (`applyPandasStylerCss` in
`frontend/lib/src/components/widgets/DataFrame/arrowUtils.ts`), applied only to non-editable
cells. We want the same visual result (a per-cell `themeOverride.bgCell`) driven by a
compact, value-based rule spec on `column_config`, computed in the browser, and applied to
editable cells too.

## Background: how a cell gets built

- Backend serializes `column_config` to JSON into `DataframeProto.columns`
  (`marshall_column_config` → `_convert_column_config_to_json` in
  `lib/streamlit/elements/lib/column_config_utils.py`).
- Frontend parses it into `Map<string, ColumnConfigProps>` (`getColumnConfig` in
  `hooks/useColumnLoader.ts`), merges the entry onto `BaseColumnProps`, and instantiates a
  `BaseColumn`.
- Per visible cell, `getCellFromArrow(column, arrowCell, styledCell, cssStyles)`
  (`arrowUtils.ts`) calls `column.getCell(value)` and then applies Styler styling.
- glide-data-grid renders each `GridCell` on a canvas; `cell.themeOverride`
  (`Partial<GlideTheme>`) sets `bgCell`, `textDark`, etc.

The color spec plugs in at the same seam as Styler: after `column.getCell(value)`, compute
a `themeOverride` from the value and the rules.

## Proposal

### 1. Backend: config shape and serialization

Add one field to the shared `ColumnConfig` TypedDict (`column_types.py`), alongside
`alignment`:

```python
class ColumnConfig(TypedDict, total=False):
    ...
    alignment: ContentAlignment | None
    color: CellColorSpec | None
    type_config: ...
```

Where `CellColorSpec` is the serializable union:

```python
class ColorRuleSpec(TypedDict):
    # Emitted by st.column_config.ColorRule(...)
    operator: Literal[
        "always", "equal", "not_equal",
        "less_than", "less_than_or_equal",
        "greater_than", "greater_than_or_equal",
        "between", "in", "not_in", "is_null", "is_not_null",
    ]
    color: str
    target: Literal["background", "text"]   # what the color fills (default "background")
    value: NotRequired[float | str | list[float | str] | None]

class ColorScaleSpec(TypedDict):
    # A gradient interpolated across an explicit domain. Exactly one of colors/palette.
    type: Literal["scale"]
    domain: tuple[float, float]    # from the column's min_value / max_value (numeric or epoch)
    colors: NotRequired[list[str]]                          # explicit stops (from list[str])
    palette: NotRequired[Literal["sequential", "diverging"]]  # theme palette, resolved on frontend

class AutoColorSpec(TypedDict):
    # Sign-based green/red. With a domain, a magnitude-scaled diverging gradient (neutral at 0).
    type: Literal["auto"]
    inverse: bool                              # "auto-inverse" flips green/red
    domain: NotRequired[tuple[float, float] | None]  # min/max; present → gradient, absent → binary

CellColorSpec: TypeAlias = (
    str                     # static color
    | list[ColorRuleSpec]   # ordered rule list, first match wins
    | ColorScaleSpec        # gradient over an explicit domain
    | AutoColorSpec         # sign-based / diverging
)
```

The serialized forms are unambiguous on the frontend: a **string** is a static color, an
**array** is a rule list, and an **object** is a gradient (`type: "scale"`) or sign-based color
(`type: "auto"`).

`st.column_config.ColorRule(operator="always", value=None, color=None, target="background")` is
a thin constructor (`@gather_metrics("column_config.ColorRule")`) returning a `ColorRuleSpec`
dict. In each column constructor, `color` is normalized:

- a single `ColorRule` → a one-element list,
- a `list[ColorRule]` → passed through,
- a `list[str]` (2+ colors) → a `ColorScaleSpec` with `colors` and `domain` filled from the
  column's resolved `min_value`/`max_value` (see Gradient domain below),
- `"sequential"` / `"diverging"` → a `ColorScaleSpec` with `palette` set (colors resolved on
  the frontend from `theme.colors.chartSequentialColors` / `chartDivergingColors`) and `domain`
  from `min_value`/`max_value`,
- `"auto"` / `"auto-inverse"` → an `AutoColorSpec` (`inverse` set accordingly), with `domain`
  filled from `min_value`/`max_value` when **both** are set (enabling the diverging fill),
  else omitted (binary),
- any other `str` → a one-element `[ColorRule("always", color=str)]`.

Add the `color` keyword param to the four continuous constructors — `NumberColumn`,
`DateColumn`, `TimeColumn`, `DatetimeColumn` — each forwarding into the shared
`ColumnConfig(...)` (mirroring how `alignment` is threaded today).

**Gradient domain.** For a `list[str]`, the constructor reads the column's own
`min_value`/`max_value` (already parameters on all four types), converts them to the same
numeric/epoch representation used for values, and stores them as `domain`. This keeps the
domain **explicit and stable** — no data scan, no backend aggregate — which is what makes the
gradient correct under editing and lazy loading. If either bound is unset, raise (see
Validation).

**Value normalization.** Temporal rule values (`date`/`time`/`datetime`, or ISO strings) are
converted to the same numeric epoch representation the column already uses for the frontend,
so the browser compares numbers to numbers. Numeric values pass through.

**Validation** (raise `StreamlitAPIException` / `StreamlitValueError`, fail fast):

- `color` is only accepted where the column resolves to a numeric or temporal type, checked
  against the schema from `determine_dataframe_schema` (`column_config_utils.py`) where
  configs are applied; other types raise, pointing users to `pandas.Styler`.
- Every concrete color string via `is_css_color_like` + named-palette check (reuse
  `_validate_chart_color`'s allow-list, minus the chart-only `"auto"` handling).
- `"auto"` / `"auto-inverse"` allowed only on numeric columns.
- **Gradient** (`list[str]`) / **theme scale** (`"sequential"` / `"diverging"`): both
  `min_value` and `max_value` set with `min_value < max_value` (else raise — a scale needs
  explicit bounds); a `list[str]` additionally needs `len(colors) >= 2`.
- Per `ColorRule`: `value` shape matches the operator (scalar for comparisons; 2-tuple for
  `"between"`, `low < high`; non-empty sequence for `"in"`/`"not_in"`; omitted for
  `"always"`/`"is_null"`/`"is_not_null"`); ordering operators require values comparable to
  the resolved column type; `color` present and valid; `target` in `{"background", "text"}`.

**Serialization:** no change needed. `color` is an ordinary top-level `ColumnConfig` key, so
it flows through `_convert_column_config_to_json` unchanged (nested list/dict serialize as
JSON). **No proto edits.**

### 2. Frontend: parse and thread the spec

Extend `ColumnConfigProps` and `BaseColumnProps`:

```ts
// hooks/useColumnLoader.ts – ColumnConfigProps
color?: CellColorSpec

// columns/utils.ts – BaseColumnProps
readonly color?: CellColorSpec
```

`applyColumnConfig` (in `useColumnLoader.ts`) already merges arbitrary config keys onto
`BaseColumnProps`; add `color` to the mapped fields. Mirrored TS union:

```ts
interface ColorRuleSpec {
  operator: "always" | "equal" | "not_equal" | "less_than" | "less_than_or_equal"
    | "greater_than" | "greater_than_or_equal" | "between" | "in" | "not_in"
    | "is_null" | "is_not_null"
  color: string
  target: "background" | "text"
  value?: number | string | (number | string)[] | null
}
interface ColorScaleSpec {
  type: "scale"
  domain: [number, number]
  colors?: string[]
  palette?: "sequential" | "diverging"
}
interface AutoColorSpec { type: "auto"; inverse: boolean; domain?: [number, number] }
type CellColorSpec = string | ColorRuleSpec[] | ColorScaleSpec | AutoColorSpec
```

### 3. Frontend: resolve value → `themeOverride`

New util `frontend/lib/src/components/widgets/DataFrame/conditionalColor.ts`. Because a rule
list can set both a fill and a text color, the resolver returns both:

```ts
function resolveCellColors(
  spec: CellColorSpec,
  value: unknown,      // the cell's raw value (numeric, or epoch for temporal)
  theme: EmotionTheme,
): { background?: string; text?: string }
```

Resolution logic:

- **string spec** (static color): `{ background: resolveNamedColor(spec, theme) }` (existing
  util in `theme/getColors.ts`, theme-aware).
- **sign-based** (`{type: "auto"}`): require numeric `value`; pick `theme.colors.greenColor` /
  `redColor` by `value >= 0` (`inverse` flips). Without `domain` → that color at full strength
  (binary). With `domain` → alpha scaled by magnitude: `alpha = clamp(value / domain[1], 0, 1)`
  for `value > 0` and `clamp(value / domain[0], 0, 1)` for `value < 0` (both `domain` ends
  signed), so the fill fades to nothing at 0 and saturates toward the bound — degrading to a
  one-sided ramp when the range doesn't straddle 0. Returned as `{ background }`. Non-numeric →
  `{}`.
- **rule list** (array): make **two independent passes** — the first rule with
  `target: "background"` that matches → `background`, the first with `target: "text"` that
  matches → `text`. `"always"` always matches; `"is_null"`/`"is_not_null"` test missing;
  comparison/`between`/`in` operators compare the numeric `value` (numbers directly; temporal
  values via their epoch representation). Colors run through `resolveNamedColor`.
- **gradient** (`{type: "scale"}`): require numeric/epoch `value`; the stops are `colors` (or
  `theme.colors.chartSequentialColors` / `chartDivergingColors` when `palette` is set);
  normalize `value` into `[0, 1]` across `domain` (clamping out-of-range to the ends), then
  interpolate between the two nearest stops (reuse the chart color interpolation helper if
  available, else an sRGB lerp). Returned as `{ background }`. Missing/non-numeric → `{}`.

Rules need no domain; a gradient's domain is the **explicit** `min_value`/`max_value` carried
in the spec (or, for `palette`, still just that domain) — never a per-column data aggregate —
so every decision stays local to the cell.

Apply in `getCellFromArrow` (mirroring the Styler block, but for **all** cells — editable
included), after `column.getCell(...)`:

```ts
if (column.color) {
  const { background, text } = resolveCellColors(column.color, rawValue, theme)
  if (background || text) {
    cell.themeOverride = {
      ...(cell.themeOverride ?? {}),
      ...(background ? { bgCell: background } : {}),
      // explicit rule text wins; otherwise auto-contrast against a set background
      ...(text
        ? { textDark: text }
        : background
          ? { textDark: pickReadableTextColor(background, theme) }
          : {}),
    }
  }
}
```

- **Precedence over Styler:** apply the `column_config` color *after* `applyPandasStylerCss`
  so it wins, consistent with formatting precedence.
- **Auto-contrast:** when a background is set (and no `target="text"` rule matched),
  `pickReadableTextColor(background)` computes relative luminance (blending alpha against the
  base cell background) and returns a dark or light theme token. This generalizes the current
  one-off Styler hack (`arrowUtils.ts`: `backgroundColor === "yellow"` → dark text). A
  `target="text"` color is used verbatim and skips auto-contrast.
- **Text-only cells** leave `bgCell` untouched, so the default cell background (and its
  selection/hover states) is preserved.
- **Interaction state stays on top:** selection, hover, focus outline, and error/required
  indicators must remain visible over the custom background (tint/compose, don't replace).

### 4. Editing (`st.data_editor`)

Native color applies to editable and read-only cells alike (unlike Styler). Because each
rule — and the gradient's `domain` — depends only on the cell's own value plus fixed config
(never on other rows), committing an edit re-evaluates that one cell as part of the normal
repaint; crossing a rule boundary or shifting along the gradient recolors immediately without
a script rerun and without any column-level state to refresh. Colors never change validation,
the editor's return value, or session state.

### 5. Gradient domain from explicit min/max (no data aggregate)

A continuous gradient must normalize each value into `[0, 1]` across some domain. Rather than
derive that domain from the data (which is stale after edits/new rows in `st.data_editor` and
requires a full-column scan that breaks under lazy loading), we reuse the column's **explicit**
`min_value`/`max_value` — already parameters on all four continuous types. The backend copies
those (converted to numeric/epoch) into `ColorScaleSpec.domain` at marshal time, so the
frontend never computes an aggregate and the scale is stable across reruns. A *data-scaled*
gradient (auto min/max) stays out of scope; it could later opt in via e.g. `min_value="auto"`.

## Testing

- **Python unit** (`lib/tests/streamlit/elements/lib/column_config_test.py` + the four
  column tests): `color` stored on `NumberColumn`/`DateColumn`/`TimeColumn`/`DatetimeColumn`;
  `ColorRule` builds the right dict incl. `target` (default `"background"`); `str`/single-`ColorRule`/`list[ColorRule]`/`list[str]`/`"sequential"`/`"diverging"`
  normalization; `"auto"`→`AutoColorSpec` with `domain` only when both bounds set (else
  omitted); gradient + theme scale pull `domain` from `min_value`/`max_value` (numeric +
  temporal epoch); temporal value → epoch conversion; validation errors (bad color, `color` on
  an unsupported column type, `"auto"` on non-numeric, invalid `target`, wrong `value` shape
  per operator, `between` order, scale without both bounds / `min >= max`); JSON round-trip
  through `marshall_column_config`.
- **Frontend unit** (`conditionalColor.test.ts`): static / `"auto"` binary vs magnitude-scaled
  diverging (alpha at 0, mid, and clamped past the bounds; `inverse` flips) / each operator;
  independent background vs text first-match passes (a list setting both); `palette` scales
  resolve from theme; gradient interpolation + clamping across `domain`; temporal value
  handling; missing → only `is_null`/`always`; non-numeric → `{}`; `pickReadableTextColor`
  light vs dark + alpha blend, and skipped when a `target="text"` color is present.
- **Frontend component** (`DataFrame` tests): `themeOverride.bgCell` (fill) and `textDark`
  (both auto-contrast and explicit `target="text"`) set on the right cells; text-only rule
  leaves `bgCell` untouched; applied on editable columns; column color wins over Styler; edited
  cell recolors across a rule boundary / along the gradient without a rerun;
  selection/hover/focus stay visible.
- **E2E** (`e2e_playwright/st_dataframe_*`): visual snapshots for `"auto"`, a multi-rule band, a
  `target="text"` rule, a custom gradient, a `"diverging"` theme scale, and `is_null`
  highlighting on numeric + datetime columns, in both `st.dataframe` and `st.data_editor`
  (editable), light/dark.
- **Typing** (`lib/tests/streamlit/typing/`): `color` accepts `str`, `ColorRule`,
  `list[ColorRule]`, and `list[str]` on the four continuous column types; rejected on others.

## Alternatives considered

### Backend-precomputed per-cell color array

Evaluate colors in Python and ship a per-cell color grid.

- **Cons:** Per-cell payload on every rerun, incompatible with lazy loading, no faster than
  Styler — the exact problems this targets. **Rejected.**

### Data-derived gradient domain (auto min/max)

Compute the column `[min, max]` from the data (backend aggregate or frontend scan) instead of
requiring explicit bounds.

- **Cons:** A backend aggregate is stale after edits/added rows in `st.data_editor`; a
  frontend scan breaks under lazy loading; either way the scale shifts unpredictably across
  reruns. **Rejected** — we reuse the column's explicit `min_value`/`max_value` as the
  domain, which is stable and free. Auto-scaled gradients can revisit this later (e.g.
  `min_value="auto"`).

### Structured proto schema instead of JSON

Model the spec as a dedicated protobuf field.

- **Cons:** `column_config` already travels as JSON in `DataframeProto.columns`; keeping
  `color` there is consistent and needs no proto churn. **Rejected** — reuse the JSON
  channel.

### Resolve colors inside each `column.getCell()` instead of `getCellFromArrow`

- **Cons:** Duplicated across the four column files and easy to miss. Centralizing in
  `getCellFromArrow` (where Styler already applies) covers all four uniformly. **Rejected.**

### Column-level `themeOverride` instead of per-cell

glide-data-grid supports a column-level `themeOverride`, but conditional colors are
value-dependent, so they must live on each `GridCell`. Column-level override stays reserved
for column-wide constants (e.g. `CheckboxColumn` rounding).
