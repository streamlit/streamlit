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

"""Responsive dashboard with a slow query running in the background.

The pattern: one query is much slower than everything else on the page (a heavy
report, a full reconciliation, an export). Run that slow query in a
``@st.fragment(parallel=True)`` so it loads on a worker thread, and keep the
filter and the quick overview in the main script so the page stays interactive
while the slow report is still loading.

Demonstrates:
- ``@st.fragment(parallel=True)`` to run a slow query in the background
- A filter in the main script, so changing it stays responsive (a full rerun
  preempts the in-progress run; a control *inside* the slow fragment would be
  queued behind it until the report finishes)
- ``@st.cache_data(ttl=..., refresh_mode="background")`` so a warm report serves
  instantly and refreshes off-thread when it goes stale
- ``st.skeleton`` as the loading placeholder while the report fills in

This template uses synthetic data with ``time.sleep`` to stand in for slow work.
Replace ``run_freshness_report()`` and the ``load_*`` loaders with your real data
source (e.g., Snowflake queries, cloud APIs, etc.).
"""

import hashlib
import time
from datetime import date, timedelta

import numpy as np
import pandas as pd

import streamlit as st

st.set_page_config(
    page_title="Operations Dashboard",
    page_icon=":material/monitoring:",
    layout="wide",
)


# =============================================================================
# Constants
# =============================================================================

REGIONS = ["us-west-2", "us-east-1", "eu-west-1", "ap-northeast-1"]
CHART_HEIGHT = 280
REPORT_HEIGHT = 320

# How long the slow report takes. Stands in for a heavy warehouse query; real
# ones can take much longer. The quick loaders below are deliberately fast.
REPORT_SECONDS = 8
QUICK_SECONDS = 0.2


# =============================================================================
# Data loading (replace with your real data source)
# =============================================================================


def _rng(*parts: str) -> np.random.Generator:
    """Deterministic RNG so synthetic data is stable across reruns."""
    seed = int(hashlib.sha256("|".join(parts).encode()).hexdigest(), 16) % 2**32
    return np.random.default_rng(seed)


@st.cache_data(ttl="5m", show_spinner=False)
def load_kpis(region: str) -> dict[str, float]:
    """Quick summary metrics for the selected region (fast query)."""
    time.sleep(QUICK_SECONDS)
    rng = _rng("kpis", region)
    return {
        "pipelines": int(rng.integers(40, 80)),
        "on_time_pct": float(rng.uniform(92, 99.5)),
        "avg_latency_min": float(rng.uniform(3, 18)),
    }


@st.cache_data(ttl="5m", show_spinner=False)
def load_throughput(region: str) -> pd.DataFrame:
    """Quick 30-day throughput trend for the selected region (fast query)."""
    time.sleep(QUICK_SECONDS)
    rng = _rng("throughput", region)
    days = pd.date_range(end=date.today(), periods=30, freq="D")
    base = rng.integers(800, 2000)
    rows = (base * (1 + np.cumsum(rng.uniform(-0.03, 0.04, len(days))))).clip(min=0)
    return pd.DataFrame({"date": days, "rows_processed": rows.astype(int)})


@st.cache_data(ttl="10m", refresh_mode="background", show_spinner=False)
def run_freshness_report(region: str) -> pd.DataFrame:
    """Slow per-pipeline freshness report (the heavy query).

    ``refresh_mode="background"`` serves the cached result instantly once warm and
    refreshes it off-thread when the ``ttl`` expires, so the page never blocks on a
    stale-but-acceptable report. Background refresh requires a ``ttl`` and the
    function must not render Streamlit elements or touch ``st.session_state`` — it
    only returns data.
    """
    time.sleep(REPORT_SECONDS)
    rng = _rng("report", region)
    names = [f"{region}-pipeline-{i:02d}" for i in range(1, 13)]
    last_refresh = [
        pd.Timestamp.now() - timedelta(minutes=int(m))
        for m in rng.integers(2, 240, len(names))
    ]
    sla_minutes = rng.choice([30, 60, 120], len(names))
    age = [(pd.Timestamp.now() - ts).total_seconds() / 60 for ts in last_refresh]
    return pd.DataFrame(
        {
            "pipeline": names,
            "last_refresh": last_refresh,
            "sla_minutes": sla_minutes,
            "within_sla": [a <= s for a, s in zip(age, sla_minutes)],
            "rows_loaded": rng.integers(10_000, 500_000, len(names)),
        }
    )


# =============================================================================
# Components
# =============================================================================


@st.fragment(parallel=True)
def freshness_report(region: str) -> None:
    """Render the slow report inside a parallel fragment.

    On a full app rerun this is dispatched to a worker thread, so the rest of the
    page (the filter and the overview below) renders and stays interactive while
    the report is still loading. ``st.skeleton`` holds the space until the data is
    ready.
    """
    with st.container(border=True):
        st.subheader("Pipeline freshness report")
        st.caption(
            f"Heavy query (~{REPORT_SECONDS}s). It loads in the background — the "
            "filter above and the overview below stay responsive while it runs."
        )
        with st.skeleton(height=REPORT_HEIGHT):
            report = run_freshness_report(region)
            overdue = int((~report["within_sla"]).sum())
            if overdue:
                st.warning(f"{overdue} of {len(report)} pipelines are past their SLA.")
            else:
                st.success(f"All {len(report)} pipelines are within their SLA.")
            st.dataframe(
                report,
                hide_index=True,
                height=REPORT_HEIGHT,
                alt="Per-pipeline freshness report",
            )


def render_overview(region: str) -> None:
    """Quick, always-responsive summary rendered inline in the main script."""
    kpis = load_kpis(region)
    col1, col2, col3 = st.columns(3)
    col1.metric("Active pipelines", kpis["pipelines"])
    col2.metric("On-time", f"{kpis['on_time_pct']:.1f}%")
    col3.metric("Avg latency", f"{kpis['avg_latency_min']:.0f} min")

    with st.container(border=True):
        st.subheader("Throughput (last 30 days)")
        throughput = load_throughput(region)
        st.line_chart(
            throughput,
            x="date",
            y="rows_processed",
            height=CHART_HEIGHT,
            alt="Rows processed per day",
        )


# =============================================================================
# Page layout
# =============================================================================

with st.container(
    horizontal=True, horizontal_alignment="distribute", vertical_alignment="center"
):
    st.markdown("# :material/monitoring: Operations Dashboard")
    if st.button(":material/restart_alt: Reset", type="tertiary"):
        st.session_state.clear()
        st.rerun()

# Filter lives in the main script: changing it triggers a full rerun that
# preempts the in-progress run, so it stays responsive while the report reloads.
region = st.selectbox("Region", REGIONS, key="region")

# Slow report: dispatched to a worker thread so it loads in the background.
freshness_report(region)

# Quick overview: renders immediately and updates instantly when the region changes.
render_overview(region)
