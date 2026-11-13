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

"""Synthetic data and cached loaders for the metrics dashboard.

Replace ``load_metric()`` and ``load_breakdown()`` with your own data sources
(e.g., Snowflake queries, APIs, etc.).
"""

from __future__ import annotations

import hashlib
import time
from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd

import streamlit as st

# Simulates warehouse latency on the first (uncached) load so the skeletons
# are visible. Set to 0 when you connect a real data source.
SIMULATED_LATENCY_S = 0.8

# Per-metric generation settings. Replace with the metrics you actually track.
METRIC_CONFIG: dict[str, dict[str, float]] = {
    "users": {"base_value": 5000, "growth_rate": 0.002},
    "sessions": {"base_value": 15000, "growth_rate": 0.003},
    "revenue": {"base_value": 50000, "growth_rate": 0.001},
    "conversions": {"base_value": 500, "growth_rate": 0.0015},
}

# Each breakdown: its filter label, each category's base daily value, and the
# categories and chart type its card shows by default.
BREAKDOWNS: dict[str, dict[str, Any]] = {
    "channel": {
        "label": "Channels",
        "base_values": {"Organic": 6000, "Paid": 4000, "Referral": 2500, "Email": 1500},
        "default_selection": ["Organic", "Paid", "Referral", "Email"],
        "default_chart": "bar",
    },
}


def _rng(name: str) -> np.random.Generator:
    """A random generator seeded by ``name``, so every rerun gets the same data."""
    seed = int(hashlib.sha256(name.encode()).hexdigest(), 16) % 2**32
    return np.random.default_rng(seed)


def _date_range() -> pd.DatetimeIndex:
    """The last two years of days, ending yesterday."""
    end_date = date.today() - timedelta(days=1)
    return pd.date_range(end=end_date, periods=730, freq="D")


def generate_metric_data(
    metric_name: str, base_value: float, growth_rate: float, noise_factor: float = 0.1
) -> pd.DataFrame:
    """Generate a daily metric with growth, weekly seasonality, and noise."""
    rng = _rng(metric_name)
    dates = _date_range()
    trend = base_value * (1 + growth_rate) ** np.arange(len(dates))
    # Lower on weekends.
    trend *= np.where(dates.day_of_week >= 5, 0.7, 1.0)
    values = trend * rng.normal(1, noise_factor, len(dates))

    df = pd.DataFrame({"ds": dates, "daily_value": values})
    df["value_7d_ma"] = df["daily_value"].rolling(7, min_periods=1).mean()
    return df


def generate_breakdown_data(
    dimension: str, base_values: dict[str, float]
) -> pd.DataFrame:
    """Generate daily values per category, in long format (one row per day and
    category).
    """
    rng = _rng(dimension)
    dates = _date_range()
    frames = []
    for category, base in base_values.items():
        trend = base * (1 + rng.uniform(0.0003, 0.002)) ** np.arange(len(dates))
        trend *= np.where(dates.day_of_week >= 5, 0.4, 1.0)
        daily = trend * rng.uniform(0.8, 1.2, len(dates))
        frames.append(
            pd.DataFrame({"ds": dates, dimension: category, "daily_value": daily})
        )
    df = pd.concat(frames, ignore_index=True)
    df["value_7d_ma"] = df.groupby(dimension)["daily_value"].transform(
        lambda x: x.rolling(7, min_periods=1).mean()
    )
    return df


@st.cache_data(
    ttl="1h", refresh_mode="background", show_spinner="Loading metric data..."
)
def load_metric(metric_name: str) -> pd.DataFrame:
    """Load one metric's time series.

    Each metric is cached on its own, so the cards load concurrently as
    parallel fragments. The ``ttl`` keeps the cache fresh, and
    ``refresh_mode="background"`` serves an expired entry at once while it
    recomputes off-thread. Add ``max_entries`` if the set of metric names
    can grow large. Every call runs inside a skeleton, so a slow load shows
    the spinner text on the skeleton.
    """
    time.sleep(SIMULATED_LATENCY_S)
    return generate_metric_data(metric_name, **METRIC_CONFIG[metric_name])


@st.cache_data(
    ttl="1h", refresh_mode="background", show_spinner="Loading breakdown data..."
)
def load_breakdown(dimension: str) -> pd.DataFrame:
    """Load daily values by one of the ``BREAKDOWNS``, cached per dimension."""
    time.sleep(SIMULATED_LATENCY_S)
    return generate_breakdown_data(dimension, BREAKDOWNS[dimension]["base_values"])
