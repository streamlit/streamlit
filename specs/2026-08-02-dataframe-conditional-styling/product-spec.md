---
author: lukasmasuch
created: 2026-08-02
---

# Conditional cell color for numeric and temporal columns

## Summary

Add a single `color` parameter to the **continuous** `column_config` column types —
`NumberColumn`, `DateColumn`, `TimeColumn`, and `DatetimeColumn` — that colors each cell from
its value (the **background** by default, or the **text** via `ColorRule(target="text")`),
evaluated **client-side**. It supports two forms:

- **Rules** — a short list of declarative conditions (`value > 10 → green`, `value == 0 →
  gray`, …), each evaluated per-row against the cell's own value.
- **Gradient** — a list of colors interpolated across the column's existing
  `min_value`/`max_value` (a color scale / heatmap).

Both stay correct in `st.data_editor` and with lazy loading: rules are purely per-row, and the
gradient's domain is the **explicit, user-set** `min_value`/`max_value` — never derived from a
column scan, so it never goes stale as data is edited or streamed in. Anything more advanced
(categorical text, per-row highlighting, arbitrary Python logic) stays available through
`pandas.Styler`.

## Problem

Coloring a cell by its value is an important gap for building dashboards with
Streamlit tables. Today `column_config` supports value-based coloring only for a few
chart-style columns via `color="auto"`/`"auto-inverse"` (e.g. `LineChartColumn`,
`ProgressColumn`), and even there the logic is fixed (increasing/decreasing, above/below
half). For a plain data column (number, date, time) `color` is at most a **static** color,
so there is no way to express "red if negative, green if positive," a health score that
shifts color at thresholds, or a bad-value highlight.

The only existing option is `pandas.Styler`, and it has real limitations for this use case:

- **Computed on the backend.** Styles are calculated per cell in Python and serialized to
  the frontend as a CSS blob on every rerun — slow and heavy for large tables
  ([#10952](https://github.com/streamlit/streamlit/issues/10952)).
- **`st.dataframe` only, read-only.** In `st.data_editor` it applies only to non-editable
  columns ([#10953](https://github.com/streamlit/streamlit/issues/10953)).
- **Doesn't compose with `column_config`** and supports only a subset of CSS
  ([#10768](https://github.com/streamlit/streamlit/issues/10768)).

**Requests:**
[#11014](https://github.com/streamlit/streamlit/issues/11014),
[#10953](https://github.com/streamlit/streamlit/issues/10953),
[#10952](https://github.com/streamlit/streamlit/issues/10952),
[#10768](https://github.com/streamlit/streamlit/issues/10768),
[#6340](https://github.com/streamlit/streamlit/issues/6340).

Most of these requests are numeric (deltas, KPIs, thresholds). Covering **continuous**
columns first with a small rule model solves the majority of the demand, and leaves the long
tail to `pandas.Styler`.

## Proposal

Add one keyword-only parameter to the continuous column types:

```python
st.column_config.NumberColumn(
    label: str | None = None,
    *,
    # ... existing parameters unchanged ...
    color: ColorSpec | None = None,
)
```

where `ColorSpec` enumerates every accepted form:

```python
# A single paint color: a named theme color ("red", "primary"), a hex code,
# or an rgb()/rgba() string.
PaintColor = str

ColorSpec = (
    PaintColor  # one static fill color for every cell
    | Literal["auto", "auto-inverse"]  # sign-based numeric shortcut
    | Literal["sequential", "diverging"]  # theme color scale
    | list[PaintColor]  # a custom gradient (2+ colors)
    | ColorRule  # one value rule
    | list[ColorRule]  # a set of value rules
)
```

By default `color` sets the **cell background**, computed in the browser from the cell's raw
value. The same parameter is added to `DateColumn`, `TimeColumn`, and `DatetimeColumn`. It
accepts:

| Form | Type | Meaning |
|------|------|---------|
| Rules | `ColorRule` or `list[ColorRule]` | One or more value conditions → color, on background or text (the general form). |
| Gradient | `list[str]` (2+ colors) | Custom color scale interpolated across the column's `min_value`→`max_value` (both required). |
| Theme scale | `"sequential"` / `"diverging"` | Curated theme heatmap (`chartSequentialColors` / `chartDivergingColors`) across `min_value`→`max_value` (both required). |
| Sign-based | `"auto"` / `"auto-inverse"` | Numeric shortcut. Green when ≥ 0, red when < 0 (`"auto-inverse"` flips). With `min_value`/`max_value` set, becomes a magnitude-scaled diverging fill (neutral at 0). |
| Static | `str` | One color on every cell — highlight the whole column (shortcut for `ColorRule("always", color=...)`). |
| None (default) | `None` | No background (theme default). |

A `list[str]` is a **gradient**; a `list[ColorRule]` is a **rule set** — the element type
disambiguates them.

Colors accept the usual Streamlit values: the named theme palette (`red`, `orange`,
`yellow`, `green`, `blue`, `violet`, `gray`/`grey`, `primary`), hex codes, and `rgb()` /
`rgba()` strings — theme-aware. Streamlit picks a readable text color for the resolved
background so cells stay legible (see Behavior).

Why `color` (not `background`)? It matches the existing `color` parameter on
`LineChartColumn`, `BarChartColumn`, and `ProgressColumn`, where `color` is "the color that
represents this value." For a plain value cell, that representation is the cell fill. (See
[Alternatives](#alternatives-considered) for the `background` naming option.)

### Sign-based `"auto"`

`"auto"` colors by sign — green for non-negative, red for negative (`"auto-inverse"` flips) —
the one-liner for red/green deltas. If the column also sets `min_value`/`max_value`, it
upgrades to a **magnitude-scaled diverging gradient**: the fill intensity grows with the
value's distance from 0 (toward `max_value` on the green side, `min_value` on the red side)
and fades to nothing at 0. So `color="auto"` alone is a crisp two-color split; `color="auto"`
plus bounds is a smooth red↔green heatmap centered at 0 that still degrades sensibly when the
range doesn't straddle 0 (all-positive → white→green, all-negative → white→red).

Because `min_value`/`max_value` double as `st.data_editor` input bounds, adding them for
validation also switches on this gradient. That's usually a welcome upgrade; if you want the
plain two-color split *and* validation bounds, that combination isn't expressible in v1 (see
[Alternatives](#alternatives-considered)).

`"auto"` is **numeric-only** — it's inherently sign/zero-based, and date/time/datetime columns
have no natural zero (the epoch pivot is meaningless, and times are always non-negative), so
`"auto"` on a temporal column raises a clear error. For the temporal equivalents, use an
explicit rule with a cutoff you compute in Python — e.g. `cutoff = datetime.now()` evaluated
once per run, then `ColorRule("less_than", cutoff, "red")` for "overdue". That cutoff is fixed
for the rerun (stable and reproducible), unlike a client-side "now" pivot that would drift as
the clock ticks. Or use a gradient/theme scale across the date `min_value`/`max_value` for a
recency heatmap.

### The `ColorRule` helper

```python
st.column_config.ColorRule(
    operator: Literal[
        "always",
        "equal", "not_equal",
        "less_than", "less_than_or_equal",
        "greater_than", "greater_than_or_equal",
        "between",              # inclusive on both ends
        "in", "not_in",
        "is_null", "is_not_null",
    ] = "always",
    value: Scalar | Sequence[Scalar] | None = None,
    color: PaintColor | None = None,  # paint color applied when the rule matches (required at runtime)
    target: Literal["background", "text"] = "background",  # what the color fills
)
```

- `value` is a scalar for comparisons, a two-item `(low, high)` for `"between"`, and a
  sequence for `"in"` / `"not_in"`. It is omitted for `"always"`, `"is_null"`, and
  `"is_not_null"`.
- `color` is required (a required argument can't precede the defaulted `operator`/`value`, so
  it's typed as optional with a `None` default and enforced at runtime — omitting it raises a
  clear `StreamlitAPIException`).
- Comparisons use the cell's **raw** value (before `format`), so a `format="%+.1f%%"` delta
  still compares against `-2.5`, not `"-2.5%"`.
- `target` chooses whether `color` fills the **background** (default) or the **text**. This is
  how you get red/green *text* deltas instead of fills. Background and text are resolved
  independently: within a `list`, the first matching `target="background"` rule sets the fill
  and the first matching `target="text"` rule sets the text color, so one list can drive both.
- Rules are evaluated in order; the **first matching** rule (per target) wins. Cells matching
  no rule are left as-is. Place the most specific rules first and put a general fallback (e.g.
  `"always"`) last.
- `ColorRule` follows the standard conditional-formatting rule model, so it stays extensible to
  future cell styles (e.g. bold or borders) without changing this operator set.

This is the standard "conditional formatting rules" model (Excel / Google Sheets / Power BI
/ AG Grid `cellClassRules`) rather than a string expression language (`"{x} > 10"`), which we
avoid because of its parsing, quoting, weak-typing, and security-surface costs (see
[Alternatives](#alternatives-considered)).

### Gradient (color scale)

Passing a **list of 2+ colors** produces a continuous color scale interpolated across the
column's `min_value`→`max_value`:

```python
st.column_config.NumberColumn(
    "Score",
    min_value=0,
    max_value=100,
    color=["#fee0d2", "#de2d26"],  # light → dark red across 0–100
)
```

- The colors are placed at even stops (`colors[0]` at `min_value`, `colors[-1]` at
  `max_value`, the rest spread evenly between) and interpolated per cell.
- **Domain is the explicit `min_value`/`max_value`.** We reuse the parameters the continuous
  columns already have, so there is nothing new to learn and — critically — the scale never
  depends on the data. That's what makes it safe in `st.data_editor` (editing a cell just
  re-interpolates against the fixed range) and lazy loading (no need to scan the column). It
  also means the scale is *stable and comparable* across reruns, unlike a data-derived one
  that would shift whenever the min/max row changes.
- Values outside `[min_value, max_value]` **clamp** to the end colors; missing values are
  left uncolored.
- Both `min_value` and `max_value` must be set; otherwise Streamlit raises a clear error (a
  gradient with no bounds is undefined). A *data-scaled* gradient (auto min/max) stays out of
  scope — see [Alternatives](#alternatives-considered).
- **Note on reuse.** In `st.data_editor`, `min_value`/`max_value` also bound what can be
  *entered*, so a gradient reuses that same range. This is usually what you want (the valid
  range is the color range). If the two ever need to differ, a dedicated color-scale domain
  can be added later without breaking this shorthand.

Instead of a custom list, `color="sequential"` or `color="diverging"` uses the app theme's
built-in chart palettes (`theme.colors.chartSequentialColors` / `chartDivergingColors`),
spread linearly across the same `min_value`→`max_value` range:

```python
st.column_config.NumberColumn("Score", min_value=0, max_value=100, color="sequential")
```

These stay consistent with Streamlit charts and honor custom theming automatically. (Note the
default `diverging` palette is red↔blue, distinct from the green/red of `"auto"` — see
[Sign-based `"auto"`](#sign-based-auto) for that opinionated delta coloring.)

### Examples

**Red/green deltas (the #1 request):**

```python
import pandas as pd
import streamlit as st

df = pd.DataFrame(
    {"metric": ["Revenue", "Costs", "Margin"], "delta": [12000, -3400, 8600]}
)

st.dataframe(
    df,
    column_config={
        "delta": st.column_config.NumberColumn(
            "Δ vs. last month", format="$%d", color="auto"
        ),
    },
    hide_index=True,
)
```

**Red/green delta as colored text instead of a fill:**

```python
st.column_config.NumberColumn(
    "Δ vs. last month",
    format="$%d",
    color=[
        st.column_config.ColorRule("less_than", 0, "red", target="text"),
        st.column_config.ColorRule("greater_than_or_equal", 0, "green", target="text"),
    ],
)
```

**Health-score bands (a "color scale" built from rules):**

```python
st.dataframe(
    df,
    column_config={
        "health": st.column_config.NumberColumn(
            "Health score",
            color=[
                st.column_config.ColorRule("less_than", 50, "red"),
                st.column_config.ColorRule(
                    "less_than", 80, "orange"
                ),  # 50–79 (first match wins)
                st.column_config.ColorRule("always", color="green"),  # ≥ 80
            ],
        ),
    },
)
```

**Arbitrary, non-contiguous conditions:**

```python
st.column_config.NumberColumn(
    "Score",
    color=[
        st.column_config.ColorRule("greater_than", 10, "green"),
        st.column_config.ColorRule("equal", 0, "gray"),
        st.column_config.ColorRule("between", (-50, -10), "red"),
        # values in 0–10 or below −50 stay uncolored
    ],
)
```

**Highlight missing / overdue dates:**

```python
st.column_config.DatetimeColumn(
    "Due",
    color=[
        st.column_config.ColorRule("is_null", color="gray"),
        st.column_config.ColorRule("less_than", datetime(2026, 1, 1), "red"),
    ],
)
```

**Recency heatmap (temporal gradient over an explicit range):**

```python
st.column_config.DatetimeColumn(
    "Last seen",
    min_value=datetime(2026, 1, 1),
    max_value=datetime(2026, 8, 1),
    color=["#deebf7", "#3182bd"],  # older → more recent
)
```

**In `st.data_editor`, on an editable numeric column:**

```python
st.data_editor(
    df,
    column_config={
        "priority": st.column_config.NumberColumn(
            "Priority",
            color=[
                st.column_config.ColorRule("greater_than", 4, "red"),
                st.column_config.ColorRule("greater_than", 2, "orange"),
                st.column_config.ColorRule("always", color="green"),
            ],
        ),
    },
)
```

Editing a cell re-evaluates only that cell's rules against its new value — the color updates
live, without a domain to recompute, and never changes the returned value or CSV export.

### Behavior

- **Background vs. text.** By default `color` fills the cell background and Streamlit picks a
  dark/light text color with enough contrast to stay legible. A `ColorRule` with
  `target="text"` instead colors the text and leaves the background untouched (no auto-contrast
  — you chose the text color). When a rule sets the background and another sets the text, both
  apply; a `target="text"` color always wins over auto-contrast.
- **`"auto"` + bounds.** Setting `min_value`/`max_value` upgrades `color="auto"` from a binary
  green/red split to a magnitude-scaled diverging gradient (see [Sign-based
  `"auto"`](#sign-based-auto)), so adding bounds purely for input validation also changes the
  coloring.
- **No column scan.** Rules depend only on the cell's own value; gradients depend only on the
  cell's value plus the *explicit* `min_value`/`max_value`. Neither reads other rows, so both
  stay correct in `st.data_editor` (live edits, added rows) and lazy dataframes.
- **Missing values (`None`/`NaN`)** match only `"is_null"` (and `"always"`); they are
  otherwise left uncolored.
- **Precedence.** `column_config` color takes precedence over any `pandas.Styler` coloring,
  matching how `column_config` formatting already overrides Styler formatting.
- **Sorting / selection** are unaffected — the color follows the cell value, not the row
  position.
- **Rendering.** Colors are drawn on the grid canvas (the same per-cell mechanism used for
  Styler today), not injected as DOM CSS.

### Validation (fail fast, fail helpfully)

- `color` is only accepted on numeric and temporal columns; setting it elsewhere raises a
  clear `StreamlitAPIException` pointing users to `pandas.Styler` for other cases.
- `"auto"` / `"auto-inverse"` are numeric-only.
- A **gradient** (`list[str]`) or **theme scale** (`"sequential"` / `"diverging"`) requires
  both `min_value` and `max_value` set with `min_value < max_value` (and, for a list, ≥ 2 valid
  colors); otherwise a clear `StreamlitAPIException` explains that a color scale needs explicit
  bounds. An empty list (`color=[]`) is rejected, and a single-color list (`color=["red"]`) is
  rejected with a hint to use the scalar static form (`color="red"`) instead.
- Each `ColorRule` validates that `value` matches its operator (scalar / 2-tuple / sequence /
  omitted), that `color` is set and is a valid concrete `PaintColor` — a single named theme
  color, hex, or `rgb()`/`rgba()` string — explicitly rejecting the column-level tokens
  (`"auto"`, `"auto-inverse"`, `"sequential"`, `"diverging"`) and gradient lists, and that
  `target` is `"background"` or `"text"`. Ordering operators (`less_than`, `between`, …) require
  values comparable to the column type.

## Relationship to `pandas.Styler`

The two are complementary. Use native `color` for the common, performant, editable path;
reach for `Styler` when you need something this first step intentionally omits.

| Need | Use |
|------|-----|
| Value-rule background **or text** on a number/date/time column | **Native `color`** (client-side, works in `st.data_editor`) |
| Gradient / heatmap over a **known** range | **Native `color`** (`list[str]` or `"sequential"`/`"diverging"` + `min_value`/`max_value`) |
| Gradient auto-scaled to the **data's** min/max | `pandas.Styler` (`background_gradient`) |
| Bold / font weight, categorical text/status colors | `pandas.Styler` (read-only, `st.dataframe`) |
| Per-row highlighting, cross-column rules, arbitrary Python logic | `pandas.Styler` |
| Large tables / lazy loading / editable cells | **Native `color`** |

## Alternatives considered

### A. Name the parameter `background` instead of `color`

- **Pros:** Unambiguous about filling the background.
- **Cons:** Diverges from the existing `color` parameter on chart/progress columns, and no
  longer fits now that a `ColorRule` can target **text** as well — `color` is the correct
  umbrella (it's "the color(s) applied to the cell," background by default).
- **Decision:** **`color`.** The `target` parameter makes the background-only name wrong.

### B. Data-scaled gradient (auto min/max derived from the column)

Instead of the explicit `min_value`/`max_value` domain, derive the gradient range from the
data (à la `df.style.background_gradient`).

- **Cons:** Needs the column min/max. Computing it on the backend is stale after edits/new
  rows in `st.data_editor`; computing it in the frontend requires a full-column scan and
  breaks under lazy loading; and it makes the scale shift unpredictably across reruns.
- **Decision:** **Deferred.** The explicit-domain gradient (this spec) covers the common
  "heatmap over a known range" case without any of those problems. Auto-scaled gradients can
  use `pandas.Styler` for now, and a native version can revisit the domain problem later
  (e.g. an opt-in `min_value="auto"`).

### C. Expression builder (`(cell > 10, "green")`)

Overloaded-operator predicates like polars/pandas/SQLAlchemy.

- **Pros:** Reads closest to `value > 10 → green`.
- **Cons:** More machinery (a `cell` sentinel, guarded `__bool__`), and a new pattern in the
  `column_config` namespace. **Rejected** for v1 in favor of the explicit typed `ColorRule`,
  which is simpler to implement and keeps a clear, typed rule model. (`ColorRule` objects
  could gain an expression-style constructor later without breaking.)

### D. String expression language (`{"> 10": "green"}` / `filter_query`)

- **Cons:** Needs a parser, has quoting/i18n/typing issues, larger security surface; Dash's
  `filter_query` uses this and is being deprecated toward AG Grid. **Rejected.**

### E. A per-cell Python callable (`color=lambda v: ...`)

- **Cons:** Can't run in the browser; evaluating on the server recreates the `Styler`
  roundtrip. **Rejected** — for arbitrary Python logic, use `pandas.Styler`.

### F. Keep `"auto"` strictly binary (explicit token for the gradient)

Rather than upgrading `"auto"` when `min_value`/`max_value` are present, keep it two-color
always and add a separate value (e.g. `"auto-gradient"`) for the diverging heatmap.

- **Pros:** No implicit coupling — setting bounds for validation never changes the visual, and
  the binary-split-plus-bounds combination stays expressible.
- **Cons:** Another token to learn; the implicit upgrade is usually what people want.
- **Decision:** Proposed as the implicit upgrade for a smaller surface; revisit if the coupling
  proves surprising in practice.

## Out of scope (future work)

Each of these can be handled with `pandas.Styler` in the meantime:

- **Data-scaled gradients** (auto min/max derived from the data; see Alternative B). Gradients
  over an *explicit* `min_value`/`max_value` range are in scope.
- **`font_weight`/bold and other text styling** beyond color ([#10953](https://github.com/streamlit/streamlit/issues/10953)). Text *color* is in
  scope via `ColorRule(target="text")`.
- **Categorical / status coloring** and support for `TextColumn`, `SelectboxColumn`,
  `CheckboxColumn`, `LinkColumn`, etc.
- **Per-row highlighting and cross-column rules.**
- **Data bars** overlaid on numbers ([#10768](https://github.com/streamlit/streamlit/issues/10768)).
- **Header / index cell coloring.**

## Checklist

| Item | ✅ or comment |
|------|---------------|
| Works on SiS, Cloud, etc? | ✅ Pure frontend rendering + JSON config; no backend/runtime dependency. |
| No breaking API changes | ✅ Additive keyword param; default `None` preserves current behavior. |
| No new dependencies | ✅ Reuses existing canvas theme-override + color-resolution utilities. |
| Metrics collected | ✅ Existing `gather_metrics` on `column_config.*`; also count `ColorRule` usage. |
| Any security/legal impact? | ✅ Colors validated (`is_css_color_like`) and drawn to canvas (`fillStyle`), not DOM — no XSS surface. No user expressions evaluated. |
| Any docs changes needed? | ✅ Document `color` + `ColorRule` on the continuous column types; add examples; note Styler precedence and when to use Styler instead. |
