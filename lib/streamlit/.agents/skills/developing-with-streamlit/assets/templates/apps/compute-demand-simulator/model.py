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


"""Demand model and Monte Carlo simulation for the demand simulator.

Plain NumPy and pandas that run next to the data. To use your own data, replace
``load_history`` with a query, fit the ``Product`` parameters from it, and move
``AS_OF`` and ``PROMO_WEEKS`` to your calendar. The page only calls the cached
functions and the ``Levers`` scenario type.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date, timedelta
from typing import Any, NamedTuple

import numpy as np
import pandas as pd

import streamlit as st

AS_OF = date(2026, 11, 9)  # A Monday: the first forecast week
HORIZON = 26  # Forecast weeks
SIMULATIONS = 5_000  # Simulated seasons per scenario
QUANTILES = (10, 25, 50, 75, 90)  # Percentiles of the weekly demand bands
PROMO_WEEKS = (2, 3)  # Forecast weeks of Nov 23 and Nov 30 (Black Friday)
PRICE_RANGE = (-25, 25)  # Percent vs. list price
PROMO_RANGE = (0, 40)  # Percent off in the promo weeks
MARKETING_RANGE = (0.0, 60.0)  # $k per week
SUPPLY_RANGE = (70, 130)  # Percent of planned weekly supply


@dataclass(frozen=True)
class Product:
    """A product line and its fitted demand parameters."""

    price: float  # List price
    unit_cost: float
    base_units: float  # Off-season weekly demand at list price
    elasticity: float  # Price elasticity of demand
    peaks: tuple[tuple[int, float, float], ...]  # (ISO week, height, width)
    supply: int  # Planned weekly supply in units
    marketing: float  # Planned marketing spend, $k per week
    seed: int


PRODUCTS = {
    "Jackets": Product(
        price=229,
        unit_cost=96,
        base_units=880,
        elasticity=-1.7,
        peaks=((48, 2.4, 1.6), (51, 1.5, 1.8), (2, 0.7, 2.5)),
        supply=3_500,
        marketing=25.0,
        seed=11,
    ),
    "Boots": Product(
        price=179,
        unit_cost=71,
        base_units=640,
        elasticity=-1.6,
        peaks=((48, 1.4, 1.8), (16, 1.0, 4), (51, 0.8, 1.5)),
        supply=1_700,
        marketing=15.0,
        seed=23,
    ),
    "Tents": Product(
        price=349,
        unit_cost=138,
        base_units=240,
        elasticity=-1.9,
        peaks=((21, 2.6, 5), (48, 1.1, 1.5), (13, 0.9, 3)),
        supply=850,
        marketing=10.0,
        seed=37,
    ),
}


@dataclass(frozen=True)
class Levers:
    """One what-if scenario. Frozen and hashable, so it can key a cache."""

    product: str
    price_change: int = 0
    promo: int = 0
    marketing: float = 0.0
    supply: int = 100

    def describe(self) -> str:
        """A one-line summary for captions and the scenario table."""
        parts = [
            f"Price {self.price_change:+d}%" if self.price_change else "List price"
        ]
        if self.promo:
            parts.append(f"{self.promo}% Black Friday promo")
        parts.append(f"${self.marketing:g}k/wk marketing")
        if self.supply != 100:
            parts.append(f"supply {self.supply}%")
        return " · ".join(parts)


class Summary(NamedTuple):
    """Season totals. Units, revenue, and profit are medians across simulations."""

    units: float
    revenue: float
    profit: float
    stockout_risk: float  # Share of seasons where demand outruns supply some week


@dataclass(frozen=True)
class Forecast:
    weekly: pd.DataFrame  # One row per forecast week
    summary: Summary


def plan_for(product: str) -> Levers:
    return Levers(product, marketing=PRODUCTS[product].marketing)


def forecast_weeks() -> pd.DatetimeIndex:
    return pd.date_range(AS_OF, periods=HORIZON, freq="7D")


def expected_demand(product: Product, weeks: pd.DatetimeIndex) -> np.ndarray:
    """Weekly demand at list price with the planned marketing."""
    week_of_year = weeks.isocalendar().week.to_numpy(dtype=float)
    season = np.full(len(weeks), 0.55)
    for peak, height, width in product.peaks:
        distance = np.abs(week_of_year - peak)
        distance = np.minimum(distance, 52 - distance)
        season += height * np.exp(-0.5 * (distance / width) ** 2)
    return product.base_units * season


def marketing_lift(spend: float) -> float:
    """Demand multiplier for a weekly spend in $k, with diminishing returns."""
    return float(1 + 0.5 * np.log1p(spend / 10))


@st.cache_data(ttl="1h", show_spinner=False)
def load_history(product_name: str) -> pd.DataFrame:
    """Weekly units sold over the last 26 weeks. Replace with your own query."""
    product = PRODUCTS[product_name]
    weeks = pd.date_range(AS_OF - timedelta(weeks=26), periods=26, freq="7D")
    rng = np.random.default_rng(product.seed + 1)
    demand = expected_demand(product, weeks) * np.exp(rng.normal(0, 0.1, len(weeks)))
    return pd.DataFrame(
        {"week": weeks, "Actual": np.minimum(demand, product.supply).round()}
    )


@st.cache_data(max_entries=256, show_spinner=False)
def simulate(levers: Levers) -> Forecast:
    """Simulate the season under ``levers``: weekly demand bands and season totals."""
    product = PRODUCTS[levers.product]
    # Common random numbers: every scenario of a product sees the same
    # simulated futures, so differences between scenarios come from the levers.
    rng = np.random.default_rng(product.seed)
    shock = rng.normal(0, 0.1, (SIMULATIONS, 1))  # One market shock per season
    horizon = np.arange(HORIZON)
    spread = np.sqrt(1 + horizon / 10)  # Later weeks are less certain
    weekly_noise = rng.normal(0, 0.1, (SIMULATIONS, HORIZON)) * spread
    # The fitted elasticity is uncertain too.
    elasticity = product.elasticity * np.exp(rng.normal(0, 0.12, (SIMULATIONS, 1)))

    weeks = forecast_weeks()
    price = product.price * (1 + levers.price_change / 100)
    in_promo = (horizon >= PROMO_WEEKS[0]) & (horizon <= PROMO_WEEKS[1])
    unit_price = np.where(in_promo, price * (1 - levers.promo / 100), price)
    demand = (
        expected_demand(product, weeks)
        * (unit_price / product.price) ** elasticity
        * marketing_lift(levers.marketing)
        / marketing_lift(product.marketing)
        * np.exp(shock + weekly_noise)
    )
    supply = product.supply * levers.supply / 100
    units = np.minimum(demand, supply)
    stockout = demand > supply
    revenue = units * unit_price
    profit = revenue - units * product.unit_cost - levers.marketing * 1_000

    bands = np.percentile(demand, QUANTILES, axis=0)
    weekly = pd.DataFrame(
        {
            "week": weeks,
            **{f"P{q}": band for q, band in zip(QUANTILES, bands, strict=True)},
            "units": np.median(units, axis=0),
            "revenue": np.median(revenue, axis=0),
            "profit": np.median(profit, axis=0),
            "stockout_risk": stockout.mean(axis=0),
            "Supply": supply,
        }
    )
    summary = Summary(
        units=float(np.median(units.sum(axis=1))),
        revenue=float(np.median(revenue.sum(axis=1))),
        profit=float(np.median(profit.sum(axis=1))),
        stockout_risk=float(stockout.any(axis=1).mean()),
    )
    return Forecast(weekly, summary)


# (Label, Levers field, step, bounds, value format) of each lever in the tornado.
SWINGS = [
    ("Price", "price_change", 5, PRICE_RANGE, "{:+g}%"),
    ("Promo", "promo", 10, PROMO_RANGE, "{:g}% off"),
    ("Marketing", "marketing", 10, MARKETING_RANGE, "${:g}k/wk"),
    ("Supply", "supply", 15, SUPPLY_RANGE, "{:g}%"),
]


@st.cache_data(max_entries=128, show_spinner=False)
def sensitivity(levers: Levers) -> pd.DataFrame:
    """Median season profit change when each lever moves one step down or up."""
    current = simulate(levers).summary.profit
    rows = []
    for label, field, step, (low, high), value_format in SWINGS:
        value = getattr(levers, field)
        row: dict[str, Any] = {"lever": label}
        for direction, moved in (
            ("down", max(value - step, low)),
            ("up", min(value + step, high)),
        ):
            changes: dict[str, Any] = {field: moved}
            row[direction] = (
                simulate(replace(levers, **changes)).summary.profit - current
            )
            row[f"{direction}_label"] = value_format.format(moved)
        rows.append(row)
    return pd.DataFrame(rows)
