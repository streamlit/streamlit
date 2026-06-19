"""Repro app mapping when Altair/Vega-Lite charts overflow in narrow columns.

Run with:  make debug work-tmp/debug/test_chart_overflow_repro.py

Each section is labeled so a single full-page screenshot at a given viewport
width can be visually scanned for horizontal overflow (chart wider than its
column/card, or a horizontal scrollbar appearing inside a column).
"""

from __future__ import annotations

import altair as alt
import numpy as np
import pandas as pd

import streamlit as st

st.set_page_config(layout="wide", page_title="Chart overflow repro")

RNG = np.random.default_rng(42)


def make_data(n_points: int = 30, n_series: int = 1) -> pd.DataFrame:
    """Deterministic long-form data so every chart is identical across reruns."""
    frames = []
    for s in range(n_series):
        y = np.cumsum(RNG.standard_normal(n_points)) + 10 * s
        frames.append(
            pd.DataFrame(
                {
                    "x": np.arange(n_points),
                    "y": y,
                    "series": f"series {s}",
                }
            )
        )
    return pd.concat(frames, ignore_index=True)


def altair_chart(mark: str, n_series: int = 1) -> alt.Chart:
    """Build an Altair chart with the requested mark type."""
    data = make_data(n_series=n_series)
    base = alt.Chart(data).encode(
        x=alt.X("x:Q", title="x axis label"),
        y=alt.Y("y:Q", title="y axis label"),
        color=alt.Color("series:N") if n_series > 1 else alt.value("#1f77b4"),
    )
    if mark == "line":
        return base.mark_line()
    if mark == "area":
        return base.mark_area(opacity=0.6)
    if mark == "bar":
        return base.mark_bar()
    raise ValueError(mark)


def chart_in(target, mark: str, *, use_container_width: bool, key: str) -> None:
    """Render an Altair chart into `target` (a column/container)."""
    target.altair_chart(
        altair_chart(mark),
        use_container_width=use_container_width,
        key=key,
    )


# ---------------------------------------------------------------------------
st.title("Altair / Vega-Lite chart overflow repro")
st.caption(
    "Resize the browser (or use the screenshot script) to NORMAL / NARROW / "
    "VERY NARROW widths and look for charts that spill past their column or "
    "card boundary."
)

# ===========================================================================
st.header("A. Baseline — full-width charts (no columns)")
st.write(
    "Sanity check: a chart spanning the whole page should never overflow."
)
for mark in ("line", "area", "bar"):
    st.subheader(f"A · mark = {mark}")
    chart_in(st, mark, use_container_width=True, key=f"a_{mark}")

# ===========================================================================
st.header("B. N columns · altair · use_container_width=True")
st.write("Most common layout. Tests how charts shrink as columns get narrower.")
for n in (2, 3, 4, 5):
    st.subheader(f"B · {n} columns · use_container_width=True")
    cols = st.columns(n)
    for i, col in enumerate(cols):
        chart_in(col, "line", use_container_width=True, key=f"b_{n}_{i}")

# ===========================================================================
st.header("C. N columns · altair · use_container_width=False")
st.write(
    "Vega-Lite default width when use_container_width=False. The intrinsic "
    "chart width can exceed a narrow column."
)
for n in (2, 3, 4, 5):
    st.subheader(f"C · {n} columns · use_container_width=False")
    cols = st.columns(n)
    for i, col in enumerate(cols):
        chart_in(col, "line", use_container_width=False, key=f"c_{n}_{i}")

# ===========================================================================
st.header("D. st.metric + chart in the SAME card (border container)")
st.write(
    "Primary scenario of interest: a metric stacked above a chart inside a "
    "bordered container, repeated across N columns."
)
for n in (2, 3, 4, 5):
    st.subheader(f"D · {n} columns · metric + chart card · ucw=True")
    cols = st.columns(n)
    for i, col in enumerate(cols):
        card = col.container(border=True)
        card.metric(label=f"Metric {i}", value=f"{1234 * (i + 1):,}", delta=f"{i + 1}%")
        chart_in(card, "area", use_container_width=True, key=f"d_{n}_{i}")

# ===========================================================================
st.header("E. st.metric + chart card · use_container_width=False")
st.write("Same as D but charts use their intrinsic width inside the card.")
for n in (2, 3, 4):
    st.subheader(f"E · {n} columns · metric + chart card · ucw=False")
    cols = st.columns(n)
    for i, col in enumerate(cols):
        card = col.container(border=True)
        card.metric(label=f"Metric {i}", value=f"{1234 * (i + 1):,}", delta=f"{i + 1}%")
        chart_in(card, "area", use_container_width=False, key=f"e_{n}_{i}")

# ===========================================================================
st.header("F. Nested containers inside columns")
st.write(
    "Card → inner bordered container → chart, to see whether nesting changes "
    "the available width calculation."
)
for n in (3, 4):
    st.subheader(f"F · {n} columns · nested containers · ucw=True")
    cols = st.columns(n)
    for i, col in enumerate(cols):
        outer = col.container(border=True)
        outer.markdown(f"**Card {i}**")
        inner = outer.container(border=True)
        inner.metric(label="KPI", value=f"{99 * (i + 1)}")
        chart_in(inner, "bar", use_container_width=True, key=f"f_{n}_{i}")

# ===========================================================================
st.header("G. Different marks in very narrow (5) columns · ucw=True")
st.write("Does the mark type (line / area / bar) change overflow behavior?")
marks = ("line", "area", "bar", "line", "area")
cols = st.columns(5)
for i, (col, mark) in enumerate(zip(cols, marks)):
    card = col.container(border=True)
    card.markdown(f"**{mark}**")
    chart_in(card, mark, use_container_width=True, key=f"g_{i}")

# ===========================================================================
st.header("H. Text/markdown above chart in columns")
st.write(
    "Long text above the chart can force a column wider via word-wrap; check "
    "whether the chart then matches the (possibly stretched) column."
)
for n in (3, 4, 5):
    st.subheader(f"H · {n} columns · text + chart")
    cols = st.columns(n)
    for i, col in enumerate(cols):
        col.markdown(
            f"#### Panel {i}\nSome descriptive copy that explains the metric "
            "shown in the chart below and may wrap onto multiple lines."
        )
        chart_in(col, "line", use_container_width=True, key=f"h_{n}_{i}")

# ===========================================================================
st.header("I. Built-in st.line_chart / st.bar_chart / st.area_chart in columns")
st.write("Cross-check the convenience charts (also Vega-Lite under the hood).")
builtin_data = make_data(n_series=3).pivot(index="x", columns="series", values="y")
for n in (3, 4, 5):
    st.subheader(f"I · {n} columns · st.line_chart")
    cols = st.columns(n)
    for i, col in enumerate(cols):
        col.line_chart(builtin_data, height=180)


# ===========================================================================
# Compound / multi-view charts (facet, hconcat, repeat, nested composition)
# default to width="content" even when neither `width` nor `use_container_width`
# is passed (see _vega_lite_chart in vega_charts.py). These are the charts that
# overflow narrow columns WITHOUT the user opting out of stretch — likely the
# real-world culprit, unlike the explicit use_container_width=False cases above.
def facet_chart() -> alt.Chart:
    data = make_data(n_points=20, n_series=3)
    return (
        alt.Chart(data)
        .mark_line()
        .encode(x="x:Q", y="y:Q", facet=alt.Facet("series:N", columns=3))
    )


def hconcat_chart() -> alt.HConcatChart:
    data = make_data(n_points=20)
    left = alt.Chart(data).mark_line().encode(x="x:Q", y="y:Q")
    right = alt.Chart(data).mark_bar().encode(x="x:Q", y="y:Q")
    return left | right


def repeat_chart() -> alt.Chart:
    data = make_data(n_points=20)
    data = data.assign(y2=data["y"] * -1)
    return (
        alt.Chart(data)
        .mark_line()
        .encode(x="x:Q", y=alt.Y(alt.repeat("column"), type="quantitative"))
        .repeat(column=["y", "y2"])
    )


st.header("J. Compound charts at DEFAULT width (no width/use_container_width)")
st.write(
    "Facet / hconcat / repeat charts default to width='content', so they may "
    "overflow narrow columns even though nothing was set explicitly."
)
compound = [
    ("facet", facet_chart),
    ("hconcat", hconcat_chart),
    ("repeat", repeat_chart),
]
for n in (2, 3, 4):
    st.subheader(f"J · {n} columns · compound charts · DEFAULT width")
    cols = st.columns(n)
    for i, col in enumerate(cols):
        name, builder = compound[i % len(compound)]
        card = col.container(border=True)
        card.markdown(f"**{name} (default)**")
        card.altair_chart(builder(), key=f"j_{n}_{i}")

st.header("K. Compound charts inside metric cards · width='stretch'")
st.write("Same compound charts but explicitly stretched — should NOT overflow.")
for n in (2, 3, 4):
    st.subheader(f"K · {n} columns · compound charts · width=stretch")
    cols = st.columns(n)
    for i, col in enumerate(cols):
        name, builder = compound[i % len(compound)]
        card = col.container(border=True)
        card.metric(label=name, value=f"{42 * (i + 1)}")
        card.altair_chart(builder(), use_container_width=True, key=f"k_{n}_{i}")
