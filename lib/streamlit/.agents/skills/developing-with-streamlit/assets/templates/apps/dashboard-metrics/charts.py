# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Time filtering, alt text, and Apache ECharts options for the metrics dashboard.

Every option puts its dataframe in ``dataset.source``, so Streamlit sends it as
Arrow and shows it under **Show data** in the chart toolbar. Series colors come
from the app theme's ``chartCategoricalColors``.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import TYPE_CHECKING, Any

import pandas as pd

if TYPE_CHECKING:
    from collections.abc import Callable

# Tooltip number format, using the same format strings as ``st.metric``.
VALUE_FORMAT = "%,.0f"


def filter_by_time_range(df: pd.DataFrame, x_col: str, time_range: str) -> pd.DataFrame:
    """Keep rows inside ``time_range`` (``1M``, ``6M``, ``1Y``, ``QTD``, ``YTD``, or ``All``).

    Any other label returns ``df`` unchanged.
    """
    if time_range == "All" or df.empty:
        return df

    df = df.copy()
    df[x_col] = pd.to_datetime(df[x_col])
    max_date = df[x_col].max()

    if time_range == "1M":
        min_date = max_date - timedelta(days=30)
    elif time_range == "6M":
        min_date = max_date - timedelta(days=180)
    elif time_range == "1Y":
        min_date = max_date - timedelta(days=365)
    elif time_range == "QTD":
        quarter_month = ((max_date.month - 1) // 3) * 3 + 1
        min_date = pd.Timestamp(date(max_date.year, quarter_month, 1))
    elif time_range == "YTD":
        min_date = pd.Timestamp(date(max_date.year, 1, 1))
    else:
        return df

    filtered: pd.DataFrame = df[df[x_col] >= min_date]
    return filtered


def _span(title: str, series: str, source: pd.DataFrame, x_col: str) -> str:
    """Shared alt-text prefix: title, series, and the plotted date range."""
    return (
        f"{title}, {series} from {source[x_col].iloc[0]:%Y-%m-%d} to "
        f"{source[x_col].iloc[-1]:%Y-%m-%d}"
    )


def describe_trend(
    title: str, source: pd.DataFrame, x_col: str, y_col: str, series: str
) -> str:
    """Summarize one plotted series for the chart's ``alt`` text.

    ``source`` is the chart's ``dataset.source``, so the summary uses the drawn
    values, such as the weekly means of the bar chart.
    """
    values = source[y_col]
    if values.empty:
        return f"{title}, {series}: no data"
    span = _span(title, series, source, x_col)
    start = values.iloc[0]
    if pd.isna(start) or start == 0:
        # A missing or zero starting value has no percent change.
        return f"{span}: latest {values.iloc[-1]:,.0f}"
    return f"{span}: {values.iloc[-1] / start - 1:+.1%}"


def describe_breakdown(
    title: str, source: pd.DataFrame, x_col: str, series: str, *, shares: bool
) -> str:
    """Summarize a breakdown chart's ``dataset.source`` for its ``alt`` text.

    Shares always stack to 100%, so they report the leader's latest share.
    """
    values = source.drop(columns=x_col)
    if values.empty:
        return f"{title}, {series}: no data"
    latest = values.iloc[-1]
    span = _span(title, series, source, x_col)
    if shares:
        return f"{span}: {latest.idxmax()} largest at {latest.max():.0%}"
    totals = values.sum(axis=1)
    if not totals.iloc[0]:
        return f"{span}: latest total {totals.iloc[-1]:,.0f}"
    return f"{span}: total {totals.iloc[-1] / totals.iloc[0] - 1:+.1%}, {latest.idxmax()} highest"


def _time_series_option(
    source: pd.DataFrame,
    series: list[dict[str, Any]],
    *,
    y_from_zero: bool = False,
    show_percent: bool = False,
) -> dict[str, Any]:
    """Build an ECharts option for series that share a time x-axis.

    Each series picks its columns of ``source`` with ``encode``.
    """
    # Without ``scale``, the axis always starts at zero.
    y_axis: dict[str, Any] = {"type": "value", "scale": not y_from_zero}
    if show_percent:
        # Shares are 0-1, and "percent" shows them as 0% to 100%.
        y_axis |= {"max": 1, "axisLabel": {"formatter": "percent"}}
    return {
        "dataset": {"source": source},
        "legend": {},
        "tooltip": {
            "trigger": "axis",
            "valueFormatter": "percent" if show_percent else VALUE_FORMAT,
        },
        "xAxis": {"type": "time"},
        "yAxis": y_axis,
        "dataZoom": [{"type": "inside"}, {"type": "slider"}],
        "series": series,
    }


def _line_series(x_col: str, y_col: str, label: str) -> dict[str, Any]:
    """A line series without point markers, dashed for the "7-day MA" label."""
    return {
        "type": "line",
        "name": label,
        "encode": {"x": x_col, "y": y_col},
        "showSymbol": False,
        "lineStyle": {"type": "dashed"} if label == "7-day MA" else {},
    }


# =============================================================================
# Metric cards: one metric, as daily values and/or its 7-day moving average
# =============================================================================


def line_chart(
    df: pd.DataFrame, x_col: str, y_cols: list[str], labels: list[str]
) -> dict[str, Any]:
    """Build a multi-line chart."""
    series = [
        _line_series(x_col, y_col, label)
        for y_col, label in zip(y_cols, labels, strict=True)
    ]
    return _time_series_option(df[[x_col, *y_cols]], series)


def area_chart(
    df: pd.DataFrame, x_col: str, y_cols: list[str], labels: list[str]
) -> dict[str, Any]:
    """Build an area chart.

    The areas overlap instead of stacking because the daily value and its
    7-day MA measure the same quantity.
    """
    series = [
        {**_line_series(x_col, y_col, label), "areaStyle": {"opacity": 0.3}}
        for y_col, label in zip(y_cols, labels, strict=True)
    ]
    return _time_series_option(df[[x_col, *y_cols]], series)


def bar_chart(
    df: pd.DataFrame, x_col: str, y_cols: list[str], labels: list[str]
) -> dict[str, Any]:
    """Build a grouped bar chart (weekly averages for readability)."""
    df = df.copy()
    # Each bar sits at the start of its week.
    df[x_col] = pd.to_datetime(df[x_col]).dt.to_period("W").dt.start_time
    weekly = df.groupby(x_col, as_index=False)[y_cols].mean()

    series = [
        {"type": "bar", "name": label, "encode": {"x": x_col, "y": y_col}}
        for y_col, label in zip(y_cols, labels, strict=True)
    ]
    # Bars start at zero so their lengths stay comparable.
    return _time_series_option(weekly, series, y_from_zero=True)


def point_chart(
    df: pd.DataFrame, x_col: str, y_cols: list[str], labels: list[str]
) -> dict[str, Any]:
    """Build a scatter chart of daily values with a dashed 7-day MA trend line."""
    series = [
        _line_series(x_col, y_col, label)
        if label == "7-day MA"
        else {
            "type": "scatter",
            "name": label,
            "encode": {"x": x_col, "y": y_col},
            "symbolSize": 4,
            "itemStyle": {"opacity": 0.5},
        }
        for y_col, label in zip(y_cols, labels, strict=True)
    ]
    return _time_series_option(df[[x_col, *y_cols]], series)


METRIC_CHARTS: dict[str, Callable[..., dict[str, Any]]] = {
    "line": line_chart,
    "area": area_chart,
    "bar": bar_chart,
    "point": point_chart,
}


# =============================================================================
# Breakdown cards: one series per category
# =============================================================================


def pivot_by_dimension(
    df: pd.DataFrame, x_col: str, y_col: str, dim_col: str, categories: list[str]
) -> pd.DataFrame:
    """Pivot long data to one column per category, in ``categories`` order.

    ECharts has no ``color=`` field, so each column becomes one series that
    reads it through ``encode``. A fixed column order keeps each category's
    color when the selection changes.
    """
    wide = df.pivot_table(index=x_col, columns=dim_col, values=y_col)
    wide = wide.reindex(columns=categories).rename_axis(columns=None)
    return wide.reset_index()


def breakdown_chart(
    wide: pd.DataFrame,
    x_col: str,
    categories: list[str],
    chart_type: str,
    *,
    show_percent: bool = False,
) -> dict[str, Any]:
    """Build one line per category, or stacked bars (optionally as daily shares).

    ``universalTransition`` on each series morphs the chart when the card
    switches between line and bar.
    """
    show_percent = show_percent and chart_type == "bar"
    if show_percent:
        wide = wide.copy()
        values = wide[categories]
        # A day with no sessions divides by 1, so its shares stay 0, not NaN.
        wide[categories] = values.div(values.sum(axis=1).replace(0, 1), axis=0)

    # ``chart_type`` is also the ECharts series type ("line" or "bar").
    extra: dict[str, Any] = (
        {"stack": "total"} if chart_type == "bar" else {"showSymbol": False}
    )
    series: list[dict[str, Any]] = [
        {
            "type": chart_type,
            "name": category,
            "encode": {"x": x_col, "y": category},
            "universalTransition": True,
            **extra,
        }
        for category in categories
    ]
    # Start at zero so the categories' sizes stay comparable.
    return _time_series_option(
        wide, series, y_from_zero=True, show_percent=show_percent
    )
