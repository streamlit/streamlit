# Chart overflow in narrow columns — repro findings

Repro app: `work-tmp/debug/test_chart_overflow_repro.py`
Capture script: `work-tmp/debug/capture_chart_overflow.py` (writes `overflow_summary.json` + screenshots)
Run: `make debug work-tmp/debug/test_chart_overflow_repro.py`, then run the capture script.

Measured on `develop` (worktree `cursor/chart-overflow-repro-app-local`). "Overflow" =
the chart's right edge extends past its parent column/card by >1px (measured via
`getBoundingClientRect`), or the chart has internal horizontal scroll.

Viewports tested: **normal 1440px**, **narrow 900px**, **very narrow 600px** (all with
`layout="wide"`).

## TL;DR

- **`st.metric` + chart cards are NOT a cause.** A metric stacked above a chart in a
  bordered container never overflows on its own (section D is clean at every width).
- There are exactly **two triggers** for chart overflow in columns:
  1. **`use_container_width=False` / `width="content"` on a simple chart** whose intrinsic
     default width (≈400px) is wider than the column. (Working-as-intended: the user opted
     out of responsive sizing.)
  2. **Compound / multi-view charts** (`facet`, `hconcat`, `repeat`, nested composition).
     These overflow **by default** and — critically — **even with `use_container_width=True`
     / `width="stretch"`**. This is the high-impact case.
- Simple charts with the **default** sizing (`width="stretch"`) never overflow, in any
  column count, with or without metrics/cards/text/nesting.

## Scenario matrix

| Section | Scenario | Sizing | Overflows? |
|---|---|---|---|
| A | Full-width single chart (line/area/bar) | default stretch | No |
| B | 2–5 columns, simple line chart | `use_container_width=True` | No |
| C | 2–5 columns, simple line chart | `use_container_width=False` | **Yes** (side-by-side cols) |
| D | 2–5 columns, **metric + chart card** | `use_container_width=True` | No |
| E | 2–4 columns, **metric + chart card** | `use_container_width=False` | **Yes** (side-by-side cols) |
| F | 3–4 columns, nested containers | `use_container_width=True` | No |
| G | 5 columns, mixed marks (line/area/bar) | `use_container_width=True` | No |
| H | 3–5 columns, text above chart | `use_container_width=True` | No |
| I | 3–5 columns, built-in `st.line_chart` | default | No |
| J | 2–4 columns, **compound charts in cards** | **DEFAULT** (nothing set) | **Yes (severe)** |
| K | 2–4 columns, **compound charts + metric cards** | **`use_container_width=True`** | **Yes (severe)** |

### Overflow magnitude (max px past the column edge)

| Section | normal 1440 | narrow 900 | very narrow 600 |
|---|---|---|---|
| C (simple, ucw=False) | up to 157 | up to 265 | 0 (columns stack) |
| E (metric card, ucw=False) | up to 108 | up to 243 | 0 (columns stack) |
| J (compound, default) | 689–1013 | 959–1148 | ~753 |
| K (compound, ucw=True) | 689–1019 | 959–1154 | ~753 |

## Strong patterns

1. **`use_container_width=True` (the default for simple charts) is the cure for the simple
   case.** Every simple-chart section that uses stretch is clean; the only simple-chart
   overflow is when the user explicitly passes `use_container_width=False`.

2. **More columns / narrower viewport → larger overflow for the `ucw=False` simple case**,
   because the column shrinks while the chart stays at its ≈400px default. This vanishes at
   the **very narrow (600px)** viewport: Streamlit drops side-by-side columns into a single
   stacked full-width column (>400px), so the 400px chart fits again.

3. **Compound charts overflow at every viewport width, including the stacked single-column
   layout.** A two-panel `hconcat` is ≈800px of intrinsic content, which exceeds even a
   full-width stacked column on a 600px screen (still ~753px overflow). `use_container_width=True`
   does **not** help — sections J and K overflow by nearly identical amounts.

## Root cause (from code reading, no fix attempted)

`lib/streamlit/elements/vega_charts.py`:

- When neither `width` nor `use_container_width` is passed, simple charts default to
  `width="stretch"`, but `facet` / `hconcat` / `repeat` / nested-composition charts are
  forced to `width="content"`:

```2300:2325:lib/streamlit/elements/vega_charts.py
        # Set the default value for width. Altair and Vega charts have different defaults depending on the chart type,
        # so they don't default the value in the function signature and width could be None here.
        if use_container_width is None and width is None:
            ...
            width = (
                "stretch"
                if not (
                    is_facet_chart
                    or "hconcat" in spec
                    or "repeat" in spec
                    or has_nested_comp
                )
                else "content"
            )
```

- Even when stretch *is* requested, `_prepare_vega_lite_spec` falls back to `autosize: pad`
  (natural/content size) for facet/nested charts, and the code documents this as an accepted
  Vega-Lite limitation where the SVG (axes/labels/legends/padding) exceeds the container:

```314:333:lib/streamlit/elements/vega_charts.py
            # Known limitation: Nested compositions may overflow the container because
            # Vega-Lite's width property only controls the plotting area (data marks),
            # not the total SVG width which includes axes, labels, legends, and padding.
            ...
        elif is_facet_chart or (has_nested_comp and not use_container_width):
            # Facet charts and nested compositions without stretching use pad
            # (no automatic sizing, uses natural/content size)
            spec["autosize"] = {"type": "pad", "contains": "padding"}
```

So the compound-chart overflow is a **known, currently-accepted trade-off** in the backend
spec preparation, not a layout bug in columns/cards.

## Evidence

- `overflow_normal_1440px.png`, `overflow_narrow_900px.png`, `overflow_very_narrow_600px.png`
  — full-page screenshots per viewport.
- `overflow_compound_focus_900px.png` — focused shot of section J showing the `hconcat`
  chart clearly spilling past its bordered card.
- `overflow_summary.json` — per-section overflow counts and max-overflow-px per viewport.

## Open questions / suggested follow-ups before a fix

1. **Which case does the original report concern?** If users see overflow without setting
   `use_container_width=False`, the culprit is almost certainly **compound charts** (J/K),
   not metric cards. Worth confirming against the original repro.
2. **Can compound charts be made to respect `width="stretch"`?** The current `pad`/`content`
   behavior was chosen to avoid "Infinite extent" errors (issues #9091, #13410). A real fix
   likely needs frontend-side clamping (e.g. constrain the rendered SVG to the container and
   allow internal scroll, or scale down) rather than changing the autosize type.
3. **Test `width=<int>` (fixed pixels)** and `st.bar_chart`/`st.area_chart` compound-style
   usage — not covered here.
4. Consider whether columns should clip/scroll overflowing children as a safety net
   independent of chart type.
