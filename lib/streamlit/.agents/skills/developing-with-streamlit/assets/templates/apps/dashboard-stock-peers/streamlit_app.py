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

"""Stock peer analysis dashboard for comparing a set of tickers over time.

Uses the monthly closing prices of the Vega ``stocks`` dataset (2000-2010),
which ships inside the ``vega_datasets`` package, so the app runs offline.
Replace ``load_prices()`` with your own price source (e.g., a market data API).
"""

from typing import Any

import pandas as pd
import vega_datasets

import streamlit as st

st.set_page_config(
    page_title="Stock peer analysis dashboard",
    page_icon=":material/query_stats:",
    layout="wide",
)

# Months of history per horizon. None shows every month.
HORIZONS = {"1 Year": 12, "3 Years": 36, "5 Years": 60, "All": None}


@st.cache_data(show_spinner="Loading stock price data...")
def load_prices() -> pd.DataFrame:
    """Monthly closing prices, one column per ticker, indexed by date."""
    stocks: pd.DataFrame = vega_datasets.data.stocks()
    return stocks.pivot_table(index="date", columns="symbol", values="price")


prices = load_prices()

st.title("Stock peer analysis", icon=":material/query_stats:")
st.markdown(
    "Compare stocks against others in their peer group, using monthly closing "
    "prices from 2000 to 2010."
)

st.space("small")
cols = st.columns([1, 3])

top_left_cell = cols[0].container(
    border=True, height="stretch", vertical_alignment="center"
)

with top_left_cell:
    # bind="query-params" keeps the selection in the URL so the dashboard is
    # shareable — no manual st.query_params plumbing.
    tickers = st.multiselect(
        "Stock tickers",
        options=list(prices.columns),
        default=list(prices.columns),
        key="stocks",  # repeated params: ?stocks=AAPL&stocks=MSFT
        bind="query-params",
        placeholder="Choose stocks to compare. Example: AAPL",
    )
    # required=True keeps one horizon selected, so `horizon` is never None.
    horizon = st.pills(
        "Time horizon",
        options=list(HORIZONS),
        default="5 Years",
        required=True,
        key="horizon",
        bind="query-params",
    )

if not tickers:
    top_left_cell.info("Pick some stocks to compare", icon=":material/info:")
    st.stop()

months = HORIZONS[horizon]
data = prices[tickers]
if months is not None:
    # Slice by date, not row count, so the horizon also holds for daily prices.
    # The first row is the baseline the other prices are compared against.
    data = data[data.index >= data.index[-1] - pd.DateOffset(months=months)]

# Normalize prices (start at 1). Use the first non-null value per ticker, so
# tickers that start trading later in the horizon don't become NaN.
normalized = data.div(data.bfill().iloc[0])

# ECharts reads dataframe columns from ``dataset.source`` but not the index,
# so move the dates into a column.
chart_data = normalized.rename_axis("Date").reset_index()

# Build list of (normalized_value, ticker) tuples for safe comparison
# (using a dict with float keys could silently drop tickers with identical values).
ticker_values = [(normalized[ticker].iloc[-1], ticker) for ticker in tickers]
max_norm_value = max(ticker_values)
min_norm_value = min(ticker_values)
period = "the full period" if months is None else f"the last {months} months"

# Summary for the price chart's alt text. A single stock is both best and worst.
if len(tickers) > 1:
    price_summary = (
        f"{max_norm_value[1]} best at {max_norm_value[0] - 1:+.0%}, "
        f"{min_norm_value[1]} worst at {min_norm_value[0] - 1:+.0%}"
    )
else:
    price_summary = f"{max_norm_value[1]} at {max_norm_value[0] - 1:+.0%}"

with cols[0].container(
    border=True, height="stretch", horizontal=True, vertical_alignment="center"
):
    for label, (value, ticker) in [
        ("Best stock", max_norm_value),
        ("Worst stock", min_norm_value),
    ]:
        st.metric(
            label,
            ticker,
            delta=value - 1,
            format="percent",
            delta_description=f"over {period}",
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
with cols[1].container(border=True, height="stretch", vertical_alignment="center"):
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
        alt=f"Normalized prices over {period}: {price_summary}",
    )

st.space("medium")

# Plot individual stock vs peer average
st.header("Individual stocks vs peer average")
st.markdown(
    'For the analysis below, the "peer average" when analyzing stock X always '
    "excludes X itself."
)

if len(tickers) <= 1:
    st.warning("Pick 2 or more tickers to compare them")
    st.stop()

# Each bordered container is one grid cell, two per ticker. The grid drops
# columns on narrow screens instead of squeezing the charts.
chart_grid = st.grid(4)

for ticker in tickers:
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

    chart_grid.container(border=True).echarts_chart(
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

    chart_grid.container(border=True).echarts_chart(
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
st.header("Raw data")

st.dataframe(data, alt="Selected monthly closing prices")
