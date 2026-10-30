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

"""Stock peer analysis dashboard for comparing a set of tickers over time."""

from collections.abc import Iterable
from typing import Any

import pandas as pd
import yfinance as yf

import streamlit as st

st.set_page_config(
    page_title="Stock peer analysis dashboard",
    page_icon=":material/query_stats:",
    layout="wide",
)

"""
# :material/query_stats: Stock peer analysis

Easily compare stocks against others in their peer group.
"""

st.space("small")
cols = st.columns([1, 3])
# Will declare right cell later to avoid showing it when no data.

STOCKS = [
    "AAPL",
    "ABBV",
    "ACN",
    "ADBE",
    "ADP",
    "AMD",
    "AMGN",
    "AMT",
    "AMZN",
    "APD",
    "AVGO",
    "AXP",
    "BA",
    "BK",
    "BKNG",
    "BMY",
    "BRK.B",
    "BSX",
    "C",
    "CAT",
    "CI",
    "CL",
    "CMCSA",
    "COST",
    "CRM",
    "CSCO",
    "CVX",
    "DE",
    "DHR",
    "DIS",
    "DUK",
    "ELV",
    "EOG",
    "EQR",
    "FDX",
    "GD",
    "GE",
    "GILD",
    "GOOG",
    "GOOGL",
    "HD",
    "HON",
    "HUM",
    "IBM",
    "ICE",
    "INTC",
    "ISRG",
    "JNJ",
    "JPM",
    "KO",
    "LIN",
    "LLY",
    "LMT",
    "LOW",
    "MA",
    "MCD",
    "MDLZ",
    "META",
    "MMC",
    "MO",
    "MRK",
    "MSFT",
    "NEE",
    "NFLX",
    "NKE",
    "NOW",
    "NVDA",
    "ORCL",
    "PEP",
    "PFE",
    "PG",
    "PLD",
    "PM",
    "PSA",
    "REGN",
    "RTX",
    "SBUX",
    "SCHW",
    "SLB",
    "SO",
    "SPGI",
    "T",
    "TJX",
    "TMO",
    "TSLA",
    "TXN",
    "UNH",
    "UNP",
    "UPS",
    "V",
    "VZ",
    "WFC",
    "WM",
    "WMT",
    "XOM",
]

DEFAULT_STOCKS = ["AAPL", "MSFT", "GOOGL", "NVDA", "AMZN", "TSLA", "META"]


top_left_cell = cols[0].container(
    border=True, height="stretch", vertical_alignment="center"
)

with top_left_cell:
    # Multiselect for stock tickers. bind="query-params" keeps the selection in
    # the URL so the dashboard is shareable — no manual st.query_params plumbing.
    tickers = st.multiselect(
        "Stock tickers",
        options=STOCKS,
        default=DEFAULT_STOCKS,
        key="stocks",  # repeated params: ?stocks=AAPL&stocks=MSFT
        bind="query-params",
        placeholder="Choose stocks to compare. Example: NVDA",
        accept_new_options=True,
    )

# Time horizon selector
horizon_map = {
    "1 Month": "1mo",
    "3 Months": "3mo",
    "6 Months": "6mo",
    "1 Year": "1y",
    "5 Years": "5y",
    "10 Years": "10y",
    "20 Years": "20y",
}

with top_left_cell:
    # Buttons for picking time horizon
    horizon = st.pills(
        "Time horizon",
        options=list(horizon_map.keys()),
        default="6 Months",
    )

# `st.pills` returns None if the user deselects the active pill. Stop early
# so we don't hit a KeyError when looking up `horizon_map[horizon]` below.
if horizon is None:
    top_left_cell.info("Pick a time horizon", icon=":material/info:")
    st.stop()

tickers = [t.upper() for t in tickers]

if not tickers:
    top_left_cell.info("Pick some stocks to compare", icon=":material/info:")
    st.stop()


right_cell = cols[1].container(
    border=True, height="stretch", vertical_alignment="center"
)


@st.cache_data(ttl="6h", show_spinner="Loading stock price data...")
def load_data(tickers: Iterable[str], period: str) -> pd.DataFrame:
    tickers_obj = yf.Tickers(list(tickers))
    data = tickers_obj.history(period=period)
    if data is None:
        raise RuntimeError("YFinance returned no data.")
    close_prices: pd.DataFrame = data["Close"]
    return close_prices


# Load the data
try:
    data = load_data(tickers, horizon_map[horizon])
except yf.exceptions.YFRateLimitError:
    st.warning("YFinance is rate-limiting us :(\nTry again later.")
    st.stop()
    raise  # Unreachable — st.stop() halts execution, but helps type checker.

empty_columns = data.columns[data.isna().all()].tolist()

if empty_columns:
    st.error(f"Error loading data for the tickers: {', '.join(empty_columns)}.")
    st.stop()

# Normalize prices (start at 1). Use the first non-null value per ticker so
# tickers whose first row is NaN (e.g. newer listings over a long horizon)
# don't get normalized to NaN.
normalized = data.div(data.bfill().iloc[0])

# ECharts reads dataframe columns from ``dataset.source`` but not the index, so
# move the dates into a column. Dropping the exchange timezone keeps each point
# on its trading day instead of converting it to UTC.
chart_data = normalized.reset_index()
chart_data["Date"] = chart_data["Date"].dt.tz_localize(None)

# Build list of (normalized_value, ticker) tuples for safe comparison
# (using a dict with float keys could silently drop tickers with identical values).
ticker_values = [(normalized[ticker].iloc[-1], ticker) for ticker in tickers]
max_norm_value = max(ticker_values)
min_norm_value = min(ticker_values)

bottom_left_cell = cols[0].container(
    border=True, height="stretch", vertical_alignment="center"
)

with bottom_left_cell:
    metric_cols = st.columns(2)
    metric_cols[0].metric(
        "Best stock",
        max_norm_value[1],
        delta=f"{round((max_norm_value[0] - 1) * 100)}%",
        width="content",
    )
    metric_cols[1].metric(
        "Worst stock",
        min_norm_value[1],
        delta=f"{round((min_norm_value[0] - 1) * 100)}%",
        width="content",
    )


def line_series(column: str, **extra: Any) -> dict[str, Any]:
    """An ECharts line series that plots ``column`` of ``dataset.source``."""
    return {
        "type": "line",
        "name": column,
        "encode": {"x": "Date", "y": column},
        "showSymbol": False,
        **extra,
    }


# Plot normalized prices
with right_cell:
    st.echarts_chart(
        {
            "dataset": {"source": chart_data},
            "legend": {"type": "scroll"},
            "tooltip": {"trigger": "axis", "valueFormatter": "%.2f"},
            "xAxis": {"type": "time"},
            "yAxis": {"type": "value", "scale": True},
            "dataZoom": [{"type": "inside"}, {"type": "slider"}],
            "series": [line_series(ticker) for ticker in tickers],
        },
        height=400,
        alt=(
            f"Normalized prices over {horizon.lower()}: {max_norm_value[1]} "
            f"best at {max_norm_value[0] - 1:+.0%}, {min_norm_value[1]} worst "
            f"at {min_norm_value[0] - 1:+.0%}"
        ),
    )

st.space("medium")

# Plot individual stock vs peer average
"""
## Individual stocks vs peer average

For the analysis below, the "peer average" when analyzing stock X always
excludes X itself.
"""

if len(tickers) <= 1:
    st.warning("Pick 2 or more tickers to compare them")
    st.stop()

NUM_COLS = 4
chart_cols = st.columns(NUM_COLS)

for i, ticker in enumerate(tickers):
    # Peer average excludes the current stock.
    plot_data = pd.DataFrame(
        {
            "Date": chart_data["Date"],
            ticker: chart_data[ticker],
            "Peer average": chart_data.drop(columns=["Date", ticker]).mean(axis=1),
        }
    )
    plot_data["Delta"] = plot_data[ticker] - plot_data["Peer average"]
    latest = plot_data.iloc[-1]

    cell = chart_cols[(i * 2) % NUM_COLS].container(border=True)
    cell.echarts_chart(
        {
            "title": {"text": f"{ticker} vs peer average"},
            "dataset": {"source": plot_data},
            "legend": {},
            "tooltip": {"trigger": "axis", "valueFormatter": "%.2f"},
            "xAxis": {"type": "time"},
            "yAxis": {"type": "value", "scale": True},
            "series": [
                line_series(ticker),
                line_series("Peer average", lineStyle={"type": "dashed"}),
            ],
        },
        height=300,
        alt=(
            f"{ticker} ends at {latest[ticker]:.2f} versus a peer average of "
            f"{latest['Peer average']:.2f} (normalized)"
        ),
    )

    cell = chart_cols[(i * 2 + 1) % NUM_COLS].container(border=True)
    cell.echarts_chart(
        {
            "title": {"text": f"{ticker} minus peer average"},
            "dataset": {"source": plot_data},
            "tooltip": {"trigger": "axis", "valueFormatter": "%+.2f"},
            "xAxis": {"type": "time"},
            "yAxis": {"type": "value", "scale": True},
            "series": [line_series("Delta", areaStyle={})],
        },
        height=300,
        alt=f"{ticker} minus peer average, ending at {latest['Delta']:+.2f}",
    )

st.space("medium")

"""
## Raw data
"""

st.dataframe(data, alt="Selected stock price history")
