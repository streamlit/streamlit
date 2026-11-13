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

"""Responsive dashboard with a slow operation running in the background.

The pattern: one piece of work on the page is much slower than everything else
(a heavy report, a full reconciliation, an export, a slow API call — a database
query is just one example). Run that slow work in a ``@st.fragment(parallel=True)``
so it loads on a worker thread. Keep controls that must stay responsive in the main
script; a widget inside a fragment waits until the in-progress full run finishes.

Before reaching for this pattern, check whether the slow work can be split into
smaller, independent operations. Parallel fragments overlap independent loads, so
splitting the work is often more performant than running it as a single long
operation.

Notes on this template:
- The slow report loads without blocking the page: it runs in a parallel fragment
  (off the main thread), and with ``refresh_mode="background"`` the cached result is
  served instantly once warm and refreshed off-thread when it goes stale.
- The filter lives in the main script (above the cards), so changing it triggers a
  full rerun that preempts the in-progress run and stays responsive. A control
  *inside* a fragment would instead be queued behind the in-progress run — which
  includes the slow report — until it finishes. When every card loads in a similar
  time this rarely matters and per-card controls are fine; it matters here because
  one card is much slower than the rest. ``bind="query-params"`` keeps the chosen
  region in the URL, so a view can be shared.
- The quick cards still use caching + parallel fragments: they are much faster than
  the report but slow enough that overlapping them and caching their results pays off.
- Layout-first loading: the main script draws each card's frame, title, and
  ``st.skeleton``, and calls the card's fragment inside it. The page has its final
  layout from the first paint, cached reruns update the cards in place, and the slow
  report's ``show_spinner`` text shows on its skeleton.

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
# Height of the KPI row's skeleton and metrics, so they match. It assumes the wide
# layout, where the three metrics fit in one row; on narrow screens they wrap.
KPI_HEIGHT = 108

# The slow operation stands in for heavy work (a big warehouse query, a full
# reconciliation, an export); real ones can take much longer. The quick loaders are
# *relatively* fast — fast enough to feel responsive, but slow enough that caching
# them and overlapping them as parallel fragments still pays off.
REPORT_SECONDS = 8
QUICK_SECONDS = 1.5


# =============================================================================
# Data loading (replace with your real data source)
# =============================================================================


def _rng(*parts: str) -> np.random.Generator:
    """Deterministic RNG so synthetic data is stable across reruns."""
    seed = int(hashlib.sha256("|".join(parts).encode()).hexdigest(), 16) % 2**32
    return np.random.default_rng(seed)


@st.cache_data(ttl="5m")
def load_kpis(region: str) -> dict[str, float]:
    """Summary metrics for the selected region (relatively fast)."""
    time.sleep(QUICK_SECONDS)
    rng = _rng("kpis", region)
    return {
        "pipelines": int(rng.integers(40, 80)),
        "on_time_pct": float(rng.uniform(92, 99.5)),
        "avg_latency_min": float(rng.uniform(3, 18)),
    }


@st.cache_data(ttl="5m")
def load_throughput(region: str) -> pd.DataFrame:
    """30-day throughput trend for the selected region (relatively fast)."""
    time.sleep(QUICK_SECONDS)
    rng = _rng("throughput", region)
    days = pd.date_range(end=date.today(), periods=30, freq="D")
    base = rng.integers(800, 2000)
    rows = (base * (1 + np.cumsum(rng.uniform(-0.03, 0.04, len(days))))).clip(min=0)
    return pd.DataFrame({"date": days, "rows_processed": rows.astype(int)})


@st.cache_data(
    ttl="10m",
    refresh_mode="background",
    show_spinner=f"Running the account-wide report… (~{REPORT_SECONDS}s)",
)
def run_freshness_report() -> pd.DataFrame:
    """Slow, account-wide freshness report (the heavy operation).

    Cached with ``refresh_mode="background"``: once warm, the page gets the cached
    result instantly and the refresh runs off-thread when the ``ttl`` expires. Only a
    cold load shows the ``show_spinner`` text; a background refresh shows none. The
    function only returns data. A background refresh runs off the script thread and
    does not replay ``st.*`` output, so don't call ``st.*`` commands here.
    """
    time.sleep(REPORT_SECONDS)
    rng = _rng("report")
    names = [f"pipeline-{i:02d}" for i in range(1, 16)]
    # Timezone-aware, so the table's relative times are right in every browser.
    now = pd.Timestamp.now("UTC")
    last_refresh = [
        now - timedelta(minutes=int(m)) for m in rng.integers(2, 240, len(names))
    ]
    sla_minutes = rng.choice([30, 60, 120], len(names))
    age = [(now - ts).total_seconds() / 60 for ts in last_refresh]
    return pd.DataFrame(
        {
            "pipeline": names,
            "last_refresh": last_refresh,
            "sla_minutes": sla_minutes,
            "within_sla": [a <= s for a, s in zip(age, sla_minutes, strict=True)],
            "rows_loaded": rng.integers(10_000, 500_000, len(names)),
        }
    )


# =============================================================================
# Cards (each a parallel fragment, so they load concurrently on a full rerun)
# =============================================================================


@st.fragment(parallel=True)
def kpis_card(region: str) -> None:
    """Quick KPI row for the selected region."""
    kpis = load_kpis(region)
    with st.container(horizontal=True):
        for label, value, fmt in [
            ("Active pipelines", kpis["pipelines"], "%d"),
            ("On-time", kpis["on_time_pct"], "%.1f%%"),
            ("Avg latency", kpis["avg_latency_min"], "%.0f min"),
        ]:
            st.metric(label, value, border=True, height=KPI_HEIGHT, format=fmt)


@st.fragment(parallel=True)
def throughput_card(region: str) -> None:
    """Quick throughput chart for the selected region."""
    throughput = load_throughput(region)
    st.line_chart(
        throughput,
        x="date",
        y="rows_processed",
        x_label="Date",
        y_label="Rows processed",
        height=CHART_HEIGHT,
        alt="Rows processed per day",
    )


@st.fragment(parallel=True)
def freshness_report() -> None:
    """The slow report, loaded in the background via a parallel fragment.

    On a full app rerun this is dispatched to a worker thread, so the main-script
    filter stays responsive and the quick cards fill in while the report is still
    loading. The main script calls it inside ``st.skeleton``, so the report's
    ``show_spinner`` text shows on the skeleton, at the report's size, instead of
    as a separate spinner.
    """
    report = run_freshness_report()
    # Draw the table first: the first element replaces the skeleton, which has the
    # table's height.
    st.dataframe(
        report,
        hide_index=True,
        height=REPORT_HEIGHT,
        column_config={
            "pipeline": "Pipeline",
            "last_refresh": st.column_config.DatetimeColumn(
                "Last refresh", format="distance"
            ),
            "sla_minutes": st.column_config.NumberColumn("SLA", format="%d min"),
            "within_sla": st.column_config.CheckboxColumn("Within SLA"),
            "rows_loaded": st.column_config.NumberColumn(
                "Rows loaded", format="localized"
            ),
        },
        alt="Per-pipeline freshness report",
    )
    overdue = int((~report["within_sla"]).sum())
    if overdue:
        st.warning(f"{overdue} of {len(report)} pipelines are past their SLA.")
    else:
        st.success(f"All {len(report)} pipelines are within their SLA.")


# =============================================================================
# Page layout
# =============================================================================

st.title("Operations dashboard", icon=":material/monitoring:", anchor=False)

# Global filter in the main script, just above the cards: changing it triggers a full
# rerun that preempts the in-progress run, so it stays responsive while the slow report
# is still loading.
region = st.segmented_control(
    "Region",
    REGIONS,
    default=REGIONS[0],
    required=True,
    key="region",
    bind="query-params",
)

# The main script draws each card's frame, title, and skeleton; the fragment's
# output replaces the skeleton.

# Quick, region-specific cards: they reload fast and update when the region changes.
with st.skeleton(height=KPI_HEIGHT):
    kpis_card(region)

with st.container(border=True):
    st.subheader("Throughput (last 30 days)")
    with st.skeleton(height=CHART_HEIGHT):
        throughput_card(region)

# Slow, region-independent report: loads in the background while the page stays usable.
with st.container(border=True):
    st.subheader("Pipeline freshness report")
    st.caption(
        f"Heavy, account-wide work (~{REPORT_SECONDS}s). It loads in the "
        "background, so the filter and the cards above stay responsive while it "
        "fills in."
    )
    with st.skeleton(height=REPORT_HEIGHT):
        freshness_report()
