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

"""Synthetic data, cached loaders, and filters for the revenue dashboard.

Replace ``_generate_book`` with your own query (for example
``st.connection("snowflake").query(...)``). Keep the cached loader returning
the unfiltered source data, and apply the cheap interactive filters outside
the cache.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
import pandas as pd

import streamlit as st

# Simulates warehouse latency on the first (uncached) load so the skeletons
# are visible. Set to 0 when you connect a real data source.
SIMULATED_LATENCY_S = 0.8

# Months of generated history: the longest period (24) plus 12 months of
# retention lookback and a few spare months.
N_MONTHS = 40
PERIODS = {"3M": 3, "6M": 6, "12M": 12, "24M": 24}
DEFAULT_PERIOD = "24M"
REGIONS = ["North America", "EMEA", "APAC", "LATAM"]
PLANS = ["Enterprise", "Pro", "Starter"]
INDUSTRIES = ["Fintech", "Healthcare", "Retail", "Manufacturing", "Media", "Logistics"]

_OWNERS = ["Ava Chen", "Marcus Reid", "Priya Nair", "Jonas Berg", "Sofia Rossi"]
_NAME_PREFIXES = [
    "Apex", "Bluefin", "Cobalt", "Driftwood", "Ember", "Fjordline", "Granite",
    "Halcyon", "Ionix", "Juniper", "Keystone", "Lumora", "Meridian", "Novalis",
    "Orchid", "Pinnacle", "Redwood", "Solstice", "Tidewater", "Zephyr",
]  # fmt: skip
_NAME_SUFFIXES = [
    "Labs", "Health", "Logistics", "Systems", "Capital", "Retail", "Robotics",
    "Media", "Foods", "Energy", "Analytics", "Bio",
]  # fmt: skip
_PLAN_MRR_RANGE = {
    "Starter": (500, 2_000),
    "Pro": (1_500, 6_000),
    "Enterprise": (6_000, 22_000),
}
_PLAN_SEAT_PRICE = {"Starter": 25, "Pro": 45, "Enterprise": 70}
# Product and pricing milestones that the MRR chart can annotate, as the
# number of months before the current month.
_MILESTONES = [
    (19, "Pro price change"),
    (13, "EMEA launch"),
    (7, "AI copilot GA"),
    (2, "Usage billing"),
]


@dataclass(frozen=True)
class Filters:
    """The page's global filters, read from the toolbar widgets."""

    period: str
    regions: tuple[str, ...]
    plans: tuple[str, ...]
    annotations: bool

    @property
    def months(self) -> int:
        return PERIODS[self.period]

    def describe(self) -> str:
        """Summarize the active filters for the caption under the page title."""
        regions = (
            "All regions"
            if len(self.regions) == len(REGIONS)
            else ", ".join(self.regions)
        )
        plans = "all plans" if len(self.plans) == len(PLANS) else ", ".join(self.plans)
        return f"{regions} · {plans} · last {self.months} months"


def current_filters() -> Filters:
    """Read the toolbar filters from Session State; empty pills mean "all"."""
    return Filters(
        period=st.session_state.period,
        regions=tuple(st.session_state.regions or REGIONS),
        plans=tuple(st.session_state.plans or PLANS),
        annotations=st.session_state.annotations,
    )


def month_index() -> pd.DatetimeIndex:
    """Return the first day of each month in the generated history."""
    this_month = pd.Timestamp(date.today()).to_period("M").to_timestamp()
    return pd.date_range(end=this_month, periods=N_MONTHS, freq="MS")


def milestones(filters: Filters) -> list[tuple[pd.Timestamp, str]]:
    """Return the milestones inside the selected period, if annotations are on."""
    if not filters.annotations:
        return []
    months = month_index()
    return [
        (months[-1 - ago], label) for ago, label in _MILESTONES if ago < filters.months
    ]


def _generate_book(n_accounts: int = 240) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Generate customer accounts and their monthly MRR history."""
    rng = np.random.default_rng(7)
    months = month_index()
    plan = rng.choice(PLANS, n_accounts, p=[0.17, 0.37, 0.46])
    # Bias signups toward older months so the book has a mature base.
    start = np.minimum(
        (rng.beta(1.3, 2.2, n_accounts) * N_MONTHS).astype(int), N_MONTHS - 1
    )
    low = np.array([_PLAN_MRR_RANGE[p][0] for p in plan])
    high = np.array([_PLAN_MRR_RANGE[p][1] for p in plan])
    drift = rng.normal(0.016, 0.018, n_accounts)
    # Monthly growth with noise and occasional expansions and contractions,
    # so the MRR bridge has every kind of movement.
    factors = 1 + drift[:, None] + rng.normal(0, 0.025, (n_accounts, N_MONTHS))
    jumps = rng.random((n_accounts, N_MONTHS))
    factors = np.where(jumps > 0.975, factors * 1.22, factors)
    factors = np.where(jumps < 0.02, factors * 0.82, factors)
    active = np.arange(N_MONTHS)[None, :] >= start[:, None]
    cumulative = np.cumprod(np.where(active, factors, 1.0), axis=1)
    growth = cumulative / np.take_along_axis(cumulative, start[:, None], axis=1)
    mrr = np.where(active, rng.uniform(low, high)[:, None] * growth, 0.0)
    churn_month = np.where(
        rng.random(n_accounts) < 0.2,
        start + rng.integers(4, 30, n_accounts),
        N_MONTHS + 1,
    )
    mrr = np.where(np.arange(N_MONTHS)[None, :] >= churn_month[:, None], 0.0, mrr)
    mrr = np.round(mrr / 10) * 10

    ids = [f"ACC-{1000 + i}" for i in range(n_accounts)]
    history = pd.DataFrame(mrr, index=ids, columns=months)
    current = mrr[:, -1]
    trend = mrr[:, -12:]
    with np.errstate(divide="ignore", invalid="ignore"):
        momentum = np.where(trend[:, 0] > 0, trend[:, -1] / trend[:, 0] - 1, 0.3)
    health = np.clip(56 + momentum * 50 + rng.normal(0, 16, n_accounts), 3, 99)
    status = np.select(
        [current == 0, health >= 70, health >= 45],
        ["Churned", "Healthy", "Needs attention"],
        default="At risk",
    )
    # 240 unique names; add more before raising n_accounts.
    combos = [f"{p} {s}" for p in _NAME_PREFIXES for s in _NAME_SUFFIXES]
    signups = [
        months[s].date() + timedelta(days=int(rng.integers(0, 27))) for s in start
    ]
    today = date.today()
    renewals = [
        signup.replace(year=today.year + (signup.replace(year=today.year) < today))
        for signup in signups
    ]
    seat_price = np.array([_PLAN_SEAT_PRICE[p] for p in plan])
    seats = np.round(current / seat_price).astype(int)
    accounts = pd.DataFrame(
        {
            "name": rng.choice(combos, n_accounts, replace=False),
            "plan": plan,
            "region": rng.choice(REGIONS, n_accounts, p=[0.42, 0.3, 0.18, 0.1]),
            "industry": rng.choice(INDUSTRIES, n_accounts),
            "mrr": current,
            "mrr_trend": [row.tolist() for row in trend],
            "seats": seats,
            "health": np.where(current == 0, 0, health.round()).astype(int),
            "status": status,
            "owner": rng.choice(_OWNERS, n_accounts),
            "customer_since": signups,
            "renewal_date": renewals,
        },
        index=pd.Index(ids, name="account_id"),
    )
    return accounts, history


# The cards call this inside ``st.skeleton``, so the spinner text labels the
# skeleton during a slow load instead of drawing a second indicator.
@st.cache_data(ttl="1h", show_spinner="Loading the customer book...")
def load_book() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load customer accounts and their monthly MRR history."""
    time.sleep(SIMULATED_LATENCY_S)
    return _generate_book()


def filter_accounts(accounts: pd.DataFrame, filters: Filters) -> pd.DataFrame:
    in_regions = accounts["region"].isin(filters.regions)
    return accounts[in_regions & accounts["plan"].isin(filters.plans)]


def mrr_by_plan(
    history: pd.DataFrame, accounts: pd.DataFrame, months: int
) -> pd.DataFrame:
    """Return total MRR per month (rows) and plan (columns)."""
    window = history.loc[accounts.index].iloc[:, -months:]
    return window.groupby(accounts["plan"]).sum().T.reindex(columns=PLANS, fill_value=0)


def mrr_forecast(monthly: pd.DataFrame, horizon: int = 3) -> pd.DataFrame:
    """Extend each plan's MRR by its average monthly growth in the last six months.

    A shorter window uses all of its months.
    """
    recent = monthly.iloc[-7:]
    total_growth = recent.iloc[-1] / recent.iloc[0].replace(0, np.nan)
    growth = (total_growth ** (1 / (len(recent) - 1))).fillna(1.0)
    future = pd.date_range(monthly.index[-1], periods=horizon + 1, freq="MS")[1:]
    rows = [monthly.iloc[-1] * growth**step for step in range(1, horizon + 1)]
    return pd.DataFrame(rows, index=future)


def mrr_movements(
    history: pd.DataFrame, ids: pd.Index, months: int
) -> dict[str, float]:
    """Sum each month's MRR movements over the window, by movement type.

    Comparing month to month keeps changes that a start-to-end comparison
    would net out, such as an account that expands and then churns.
    """
    mrr = history.loc[ids].to_numpy()[:, -months - 1 :]
    before, after = mrr[:, :-1], mrr[:, 1:]
    change = after - before
    return {
        "start": float(mrr[:, 0].sum()),
        "new": float(after[before == 0].sum()),
        "expansion": float(change[(before > 0) & (change > 0)].sum()),
        "contraction": float(-change[(after > 0) & (change < 0)].sum()),
        "churn": float(before[(before > 0) & (after == 0)].sum()),
        "end": float(mrr[:, -1].sum()),
    }


def monthly_kpis(history: pd.DataFrame, ids: pd.Index, months: int) -> pd.DataFrame:
    """Return per-month ARR, net new MRR, net revenue retention, and gross churn.

    The rows cover the window plus one month, so each KPI can be compared with
    the start of the window.
    """
    mrr = history.loc[ids]
    total = mrr.sum()
    previous = mrr.shift(1, axis=1)
    churned = previous.where((previous > 0) & (mrr == 0), 0).sum()
    contraction = (previous - mrr).where((mrr > 0) & (mrr < previous), 0).sum()
    year_ago = mrr.shift(12, axis=1)
    retained = mrr.where(year_ago > 0, 0).sum()
    year_ago_total = year_ago.sum().replace(0, np.nan)
    previous_total = previous.sum().replace(0, np.nan)
    kpis = pd.DataFrame(
        {
            "arr": total * 12,
            "net_new_mrr": total.diff(),
            "nrr": retained / year_ago_total * 100,
            "gross_churn": (churned + contraction) / previous_total * 100,
        }
    )
    return kpis.iloc[-(months + 1) :]


def accounts_csv(accounts: pd.DataFrame) -> bytes:
    columns = ["name", "plan", "region", "industry", "mrr", "seats", "health", "status"]
    return accounts[columns].to_csv().encode()
