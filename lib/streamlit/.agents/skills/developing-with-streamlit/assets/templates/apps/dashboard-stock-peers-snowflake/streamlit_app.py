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

"""
Stock Peer Analysis Dashboard (Snowflake Edition)

A stock comparison dashboard demonstrating:
- Snowflake connection via st.connection("snowflake")
- Generating synthetic stock data in Snowflake
- Normalized price comparison charts
- Individual stock vs peer average analysis

This template uses synthetic stock data generated in Snowflake.
Replace the synthetic query with your actual stock data table.
"""

import altair as alt
import pandas as pd

import streamlit as st

st.set_page_config(
    page_title="Stock peer analysis dashboard",
    page_icon=":chart_with_upwards_trend:",
    layout="wide",
)

"""
# :material/query_stats: Stock peer analysis

Easily compare stocks against others in their peer group.
"""

""  # Add some space.


# =============================================================================
# Snowflake Connection
# =============================================================================


def get_snowflake_connection():
    """Get Snowflake connection via st.connection.

    Displays an error and stops the app if the connection fails.
    """
    try:
        return st.connection("snowflake")
    except Exception as e:
        st.error(f"Failed to connect to Snowflake: {e}")
        st.info(
            "Make sure you have configured your Snowflake connection in "
            "`.streamlit/secrets.toml` or via environment variables."
        )
        st.stop()


# =============================================================================
# Constants and Configuration
# =============================================================================

STOCKS = [
    "AAPL", "ABBV", "ACN", "ADBE", "ADP", "AMD", "AMGN", "AMT", "AMZN", "APD",
    "AVGO", "AXP", "BA", "BK", "BKNG", "BMY", "BSX", "C", "CAT", "CI",
    "CL", "CMCSA", "COST", "CRM", "CSCO", "CVX", "DE", "DHR", "DIS", "DUK",
    "ELV", "EOG", "EQR", "FDX", "GD", "GE", "GILD", "GOOG", "GOOGL", "HD",
    "HON", "HUM", "IBM", "ICE", "INTC", "ISRG", "JNJ", "JPM", "KO", "LIN",
    "LLY", "LMT", "LOW", "MA", "MCD", "MDLZ", "META", "MMC", "MO", "MRK",
    "MSFT", "NEE", "NFLX", "NKE", "NOW", "NVDA", "ORCL", "PEP", "PFE", "PG",
    "PLD", "PM", "PSA", "REGN", "RTX", "SBUX", "SCHW", "SLB", "SO", "SPGI",
    "T", "TJX", "TMO", "TSLA", "TXN", "UNH", "UNP", "UPS", "V", "VZ",
    "WFC", "WM", "WMT", "XOM",
]

# Base prices for synthetic data (approximate real values for realism)
STOCK_BASE_PRICES = {
    "AAPL": 175, "MSFT": 380, "GOOGL": 140, "AMZN": 180, "NVDA": 500,
    "META": 350, "TSLA": 250, "JPM": 170, "V": 280, "UNH": 520,
    "HD": 350, "PG": 160, "MA": 450, "COST": 580, "ABBV": 170,
    "MRK": 120, "AVGO": 900, "PEP": 180, "KO": 60, "TMO": 550,
    "ADBE": 550, "CRM": 280, "CSCO": 50, "ACN": 340, "NKE": 100,
}

DEFAULT_STOCKS = ["AAPL", "MSFT", "GOOGL", "NVDA", "AMZN", "TSLA", "META"]

# Time horizon mapping
HORIZON_MAP = {
    "1 Month": 30,
    "3 Months": 90,
    "6 Months": 180,
    "1 Year": 365,
    "2 Years": 730,
}


def stocks_to_str(stocks):
    return ",".join(stocks)


# =============================================================================
# Data Loading
# =============================================================================


# -----------------------------------------------------------------------------
# PRODUCTION PATTERN: Use parameterized queries for real stock data
# -----------------------------------------------------------------------------
# For production use with actual stock tables, use parameterized queries:
#
#     STOCK_QUERY = """
#         SELECT trade_date AS date, ticker, close_price
#         FROM stock_prices
#         WHERE ticker = ANY(:tickers)
#           AND trade_date >= DATEADD(day, -:days, CURRENT_DATE())
#         ORDER BY trade_date, ticker
#     """
#
#     def load_stock_data(tickers: list[str], days: int) -> pd.DataFrame:
#         conn = get_snowflake_connection()
#         df = conn.query(
#             STOCK_QUERY,
#             params={"tickers": tickers, "days": days}
#         )
#         return df
#
# The synthetic data generation below uses f-strings for the VALUES clause
# which cannot be parameterized. This is acceptable for demo/synthetic data
# but should NOT be used with user input in production.
# -----------------------------------------------------------------------------


def generate_stock_data_query(tickers: list[str], days: int) -> str:
    """Generate SQL query that creates synthetic stock price data.

    NOTE: This uses f-strings for VALUES clause construction which is acceptable
    for synthetic data generation with controlled inputs. For production apps
    with real tables, always use parameterized queries as shown above.
    """
    # Build ticker values and base prices (controlled data, not user input)
    ticker_values = []
    for ticker in tickers:
        base_price = STOCK_BASE_PRICES.get(ticker, 100 + hash(ticker) % 400)
        growth_rate = 0.0003 + (hash(ticker) % 10) * 0.00005
        volatility = 0.02 + (hash(ticker) % 5) * 0.005
        ticker_values.append(f"('{ticker}', {base_price}, {growth_rate}, {volatility})")

    tickers_cte = ", ".join(ticker_values)

    return f"""
    WITH tickers AS (
        SELECT column1 AS ticker, column2 AS base_price, column3 AS growth_rate, column4 AS volatility
        FROM VALUES {tickers_cte}
    ),
    date_series AS (
        SELECT DATEADD(day, -seq4(), CURRENT_DATE() - 1) AS trade_date
        FROM TABLE(GENERATOR(ROWCOUNT => {days}))
    ),
    raw_prices AS (
        SELECT
            d.trade_date,
            t.ticker,
            t.base_price * POWER(1 + t.growth_rate, DATEDIFF(day, DATEADD(day, -{days}, CURRENT_DATE()), d.trade_date))
                * (1 + (RANDOM() / 10000000000000000000.0 - 0.5) * t.volatility * 2) AS close_price
        FROM date_series d
        CROSS JOIN tickers t
        WHERE DAYOFWEEK(d.trade_date) NOT IN (0, 6)  -- Exclude weekends
    )
    SELECT
        trade_date AS date,
        ticker,
        ROUND(close_price, 2) AS close_price
    FROM raw_prices
    ORDER BY trade_date, ticker
    """


@st.cache_data(ttl=3600, show_spinner="Loading stock data from Snowflake...")
def load_stock_data(tickers: list[str], days: int) -> pd.DataFrame:
    """Load stock price data from Snowflake."""
    conn = get_snowflake_connection()
    query = generate_stock_data_query(tickers, days)
    df = conn.query(query)
    df.columns = df.columns.str.lower()

    # Pivot to get tickers as columns
    pivoted = df.pivot(index="date", columns="ticker", values="close_price")
    pivoted.index = pd.to_datetime(pivoted.index)
    return pivoted


# =============================================================================
# Session State and Query Params
# =============================================================================

if "tickers_input" not in st.session_state:
    st.session_state.tickers_input = st.query_params.get(
        "stocks", stocks_to_str(DEFAULT_STOCKS)
    ).split(",")


# =============================================================================
# Page Layout
# =============================================================================

# Check Snowflake connection
get_snowflake_connection()

cols = st.columns([1, 3])

top_left_cell = cols[0].container(
    border=True, height="stretch", vertical_alignment="center"
)

with top_left_cell:
    # Selectbox for stock tickers
    tickers = st.multiselect(
        "Stock tickers",
        options=sorted(set(STOCKS) | set(st.session_state.tickers_input)),
        default=st.session_state.tickers_input,
        placeholder="Choose stocks to compare. Example: NVDA",
        accept_new_options=True,
    )

    # Time horizon selector
    horizon = st.pills(
        "Time horizon",
        options=list(HORIZON_MAP.keys()),
        default="6 Months",
    )

tickers = [t.upper() for t in tickers]

# Update query param when text input changes
if tickers:
    st.query_params["stocks"] = stocks_to_str(tickers)
else:
    st.query_params.pop("stocks", None)

if not tickers:
    top_left_cell.info("Pick some stocks to compare", icon=":material/info:")
    st.stop()

right_cell = cols[1].container(
    border=True, height="stretch", vertical_alignment="center"
)

# Load the data from Snowflake
try:
    data = load_stock_data(tickers, HORIZON_MAP[horizon])
except Exception as e:
    st.error(f"Error loading stock data: {e}")
    st.stop()

# Check for missing data
missing_tickers = [t for t in tickers if t not in data.columns]
if missing_tickers:
    st.warning(f"No data available for: {', '.join(missing_tickers)}")
    # Filter to available tickers
    tickers = [t for t in tickers if t in data.columns]
    if not tickers:
        st.stop()

# Normalize prices (start at 1)
normalized = data[tickers].div(data[tickers].iloc[0])

latest_norm_values = {normalized[ticker].iat[-1]: ticker for ticker in tickers}
max_norm_value = max(latest_norm_values.items())
min_norm_value = min(latest_norm_values.items())

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

# Plot normalized prices
with right_cell:
    st.altair_chart(
        alt.Chart(
            normalized.reset_index().melt(
                id_vars=["date"], var_name="Stock", value_name="Normalized price"
            )
        )
        .mark_line()
        .encode(
            alt.X("date:T", title="Date"),
            alt.Y("Normalized price:Q").scale(zero=False),
            alt.Color("Stock:N"),
        )
        .properties(height=400)
    )

""
""

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
    # Calculate peer average (excluding current stock)
    peers = normalized.drop(columns=[ticker])
    peer_avg = peers.mean(axis=1)

    # Create DataFrame with peer average
    plot_data = pd.DataFrame(
        {
            "Date": normalized.index,
            ticker: normalized[ticker],
            "Peer average": peer_avg,
        }
    ).melt(id_vars=["Date"], var_name="Series", value_name="Price")

    chart = (
        alt.Chart(plot_data)
        .mark_line()
        .encode(
            alt.X("Date:T"),
            alt.Y("Price:Q").scale(zero=False),
            alt.Color(
                "Series:N",
                scale=alt.Scale(domain=[ticker, "Peer average"], range=["red", "gray"]),
                legend=alt.Legend(orient="bottom"),
            ),
            alt.Tooltip(["Date", "Series", "Price"]),
        )
        .properties(title=f"{ticker} vs peer average", height=300)
    )

    cell = chart_cols[(i * 2) % NUM_COLS].container(border=True)
    cell.write("")
    cell.altair_chart(chart, use_container_width=True)

    # Create Delta chart
    plot_data = pd.DataFrame(
        {
            "Date": normalized.index,
            "Delta": normalized[ticker] - peer_avg,
        }
    )

    chart = (
        alt.Chart(plot_data)
        .mark_area()
        .encode(
            alt.X("Date:T"),
            alt.Y("Delta:Q").scale(zero=False),
        )
        .properties(title=f"{ticker} minus peer average", height=300)
    )

    cell = chart_cols[(i * 2 + 1) % NUM_COLS].container(border=True)
    cell.write("")
    cell.altair_chart(chart, use_container_width=True)

""
""

"""
## Raw data
"""

st.caption(":material/cloud: Data loaded from Snowflake (synthetic)")
data[tickers]
