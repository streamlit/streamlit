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

# This is a standalone demo app, not a package module (INP001), and it uses
# typographic glyphs (multiplication sign, en dash) in user-facing copy on
# purpose (RUF001, RUF003).
# ruff: noqa: INP001, RUF001

"""PULSE — a demo dashboard for ``st.signal`` and parallel fragments.

Run with:

    streamlit run specs/2026-06-11-st-signal/demo_app.py

The dashboard simulates six "slow data sources" scattered across the page and
makes the execution model *visible*: a colour-coded wiring map, a live Signal
Monitor that shows exactly which panels reran, and per-panel reload counters.

Compare two execution strategies on the same UI:

* Naive full rerun — every interaction re-executes the whole script, reloading
  all six panels (watch the monitor light up end to end).
* Scoped reruns (``st.signal``) — a control fires a signal and only the
  fragments watching it reload; everything else stays live. Parallel fragments
  fan the slow panels out across threads on the initial load.
"""

from __future__ import annotations

import time
from datetime import datetime

import numpy as np
import pandas as pd

import streamlit as st

st.set_page_config(
    page_title="PULSE — Operations Intelligence",
    page_icon=":material/radar:",
    layout="wide",
)

# -- Domain + signal metadata -------------------------------------------------

REGIONS = ["North America", "Europe", "Asia-Pacific", "Latin America"]
WINDOWS = ["1H", "24H", "7D"]
SERVICES = ["api", "database", "cache", "queue", "auth"]

# Simulated query latency per panel (seconds). The sum is the cost of a naive
# full rerun; the max is roughly the cost of a parallel full load.
LATENCY = {
    "kpis": 0.6,
    "revenue": 1.4,
    "throughput": 1.1,
    "latency": 1.2,
    "health": 0.8,
    "forecast": 1.5,
}

# Each signal gets a colour + dot so the wiring is readable at a glance. The
# colour names match Streamlit's markdown badge colours.
SIGNAL_INFO = {
    "region": {"color": "violet", "dot": "🟣", "fires": "Region selector"},
    "window": {"color": "blue", "dot": "🔵", "fires": "Window control"},
    "tick": {"color": "green", "dot": "🟢", "fires": "Pull-latest button"},
    "summary": {"color": "orange", "dot": "🟠", "fires": "Revenue panel (chain)"},
}

FRESH_SECONDS = 4  # A panel counts as "just updated" for this long.

# -- Session bookkeeping ------------------------------------------------------

ss = st.session_state
ss.setdefault("reloads", {})
ss.setdefault("backend_seconds", 0.0)
ss.setdefault("last_loaded", {})  # panel_id -> datetime
ss.setdefault("events", [])  # (datetime, panel_id)
ss.setdefault("lab_trace", [])  # (datetime, stage_label, detail, seconds)
ss.setdefault("lab_runs", {})  # stage_key -> count
ss.setdefault("lab_batch", 0)


def _record_reload(panel_id: str, seconds: float) -> None:
    """Tally a simulated backend query for the telemetry + activity feed."""
    ss.reloads[panel_id] = ss.reloads.get(panel_id, 0) + 1
    ss.backend_seconds += seconds
    now = datetime.now()
    ss.last_loaded[panel_id] = now
    ss.events.append((now, panel_id))
    del ss.events[:-40]  # keep the feed bounded


def _query(panel_id: str, *seed_parts: object) -> np.random.Generator:
    """Simulate a slow data source and return a seeded RNG for fake data.

    The seed folds in the panel's reload count, so each refresh produces new
    numbers — like a live source — while staying deterministic within a render.
    """
    seconds = LATENCY[panel_id]
    with st.spinner("Querying source…"):
        time.sleep(seconds)
    _record_reload(panel_id, seconds)
    seed = abs(hash((panel_id, ss.reloads[panel_id], *seed_parts))) % (2**32)
    return np.random.default_rng(seed)


# -- Display helpers ----------------------------------------------------------


def _chips(watch_keys: list[str]) -> str:
    """Colour-coded badges naming the signals a panel watches."""
    if not watch_keys:
        return ":gray-badge[:material/block: watches nothing]"
    return " ".join(
        f":{SIGNAL_INFO[k]['color']}-badge[{SIGNAL_INFO[k]['dot']} {k}]"
        for k in watch_keys
    )


def _age(panel_id: str) -> float | None:
    ts = ss.last_loaded.get(panel_id)
    return None if ts is None else (datetime.now() - ts).total_seconds()


def _panel_footer(panel_id: str) -> None:
    """The per-panel reload counter shown inside each card."""
    count = ss.reloads.get(panel_id, 0)
    ts = ss.last_loaded.get(panel_id)
    when = ts.strftime("%H:%M:%S") if ts else "—"
    st.caption(f":material/refresh: reloaded **{count}×** · updated `{when}`")


# -- Panels -------------------------------------------------------------------
#
# Each panel is a plain function. `mount()` decides whether to wrap it in a
# watcher fragment (scoped mode) or call it inline (naive mode).


def panel_kpis() -> None:
    rng = _query("kpis")
    with st.container(border=True):
        st.markdown(f"**:material/speed: Live KPIs** &nbsp; {_chips(['tick'])}")
        spark = lambda: list(rng.integers(40, 100, 12))  # noqa: E731
        with st.container(horizontal=True):
            st.metric(
                "Throughput",
                f"{rng.integers(820, 990)}/s",
                f"{rng.integers(-8, 12)}%",
                border=True,
                chart_data=spark(),
                chart_type="area",
            )
            st.metric(
                "Active sessions",
                f"{rng.integers(11, 19)}.{rng.integers(0, 9)}k",
                f"{rng.integers(-4, 9)}%",
                border=True,
                chart_data=spark(),
                chart_type="line",
            )
            st.metric(
                "Error rate",
                f"{rng.uniform(0.1, 0.9):.2f}%",
                f"{rng.integers(-30, 10)}%",
                border=True,
                delta_color="inverse",
                chart_data=spark(),
                chart_type="bar",
            )
            st.metric(
                "p99 latency",
                f"{rng.integers(120, 240)}ms",
                f"{rng.integers(-12, 18)}%",
                border=True,
                delta_color="inverse",
                chart_data=spark(),
                chart_type="line",
            )
        _panel_footer("kpis")


def panel_revenue() -> None:
    region = ss.get("f_region", REGIONS[0])
    rng = _query("revenue", region)
    with st.container(border=True):
        st.subheader(":material/payments: Revenue by sector")
        st.markdown(
            f"{_chips(['region'])} &nbsp;·&nbsp; "
            f":orange-badge[:material/bolt: emits 🟠 summary]"
        )
        sectors = ["Retail", "Wholesale", "Direct", "Partner", "Marketplace"]
        revenue = rng.integers(60, 240, len(sectors))
        data = pd.DataFrame({"sector": sectors, "revenue ($k)": revenue})
        st.bar_chart(data, x="sector", y="revenue ($k)", color="#6C5CE7", height=230)
        _panel_footer("revenue")

    # Chained signal: this region watcher re-emits a derived headline that the
    # banner at the top of the page watches. (This panel runs serially — a
    # parallel worker thread isn't allowed to fire signals.)
    headline = (
        f"{region} · ${int(revenue.sum())}k revenue across {len(sectors)} sectors"
    )
    if "summary" in SIGNALS:
        SIGNALS["summary"].send(headline)
    else:
        ss["naive_headline"] = headline


def panel_throughput() -> None:
    window = ss.get("f_window", WINDOWS[1])
    rng = _query("throughput", window)
    points = {"1H": 60, "24H": 48, "7D": 84}[window]
    with st.container(border=True):
        st.subheader(":material/show_chart: Throughput trend")
        st.markdown(_chips(["window", "tick"]))
        index = pd.date_range(end=datetime.now(), periods=points, freq="min")
        data = pd.DataFrame(
            {
                "ingest": rng.integers(400, 900, points).cumsum() % 900,
                "egress": rng.integers(300, 800, points).cumsum() % 800,
            },
            index=index,
        )
        st.area_chart(data, height=230, color=["#6C5CE7", "#00B894"])
        _panel_footer("throughput")


def panel_latency() -> None:
    region = ss.get("f_region", REGIONS[0])
    rng = _query("latency", region)
    with st.container(border=True):
        st.subheader(":material/bolt: Service latency")
        st.markdown(_chips(["region"]))
        data = pd.DataFrame(
            {"service": SERVICES, "p95 (ms)": rng.integers(20, 320, len(SERVICES))}
        )
        st.bar_chart(
            data,
            x="p95 (ms)",
            y="service",
            color="#E17055",
            height=230,
            horizontal=True,
        )
        _panel_footer("latency")


def panel_health() -> None:
    rng = _query("health")
    with st.container(border=True):
        st.subheader(":material/monitor_heart: System health")
        st.markdown(_chips(["tick"]))
        states = rng.choice(
            ["healthy", "degraded", "down"], size=len(SERVICES), p=[0.7, 0.25, 0.05]
        )
        data = pd.DataFrame(
            {
                "service": SERVICES,
                "status": states,
                "uptime": rng.uniform(96, 100, len(SERVICES)).round(2),
                "load": rng.uniform(0.1, 0.95, len(SERVICES)).round(2),
            }
        )
        st.dataframe(
            data,
            hide_index=True,
            height=210,
            column_config={
                "uptime": st.column_config.ProgressColumn(
                    "uptime %", min_value=90, max_value=100, format="%.2f"
                ),
                "load": st.column_config.ProgressColumn(
                    "load", min_value=0, max_value=1, format="%.2f"
                ),
            },
        )
        _panel_footer("health")


def panel_forecast() -> None:
    rng = _query("forecast")
    with st.container(border=True):
        st.subheader(":material/insights: Quarterly forecast")
        st.markdown(
            f"{_chips([])} &nbsp; :gray[— reference model, loads once and stays put]"
        )
        months = pd.date_range(start=datetime.now(), periods=12, freq="MS")
        trend = np.linspace(100, 180, 12) + rng.normal(0, 8, 12)
        data = pd.DataFrame(
            {"baseline": trend, "optimistic": trend * rng.uniform(1.05, 1.2)},
            index=months,
        )
        st.line_chart(data, height=210, color=["#6C5CE7", "#00CEC9"])
        _panel_footer("forecast")


# (id, title, render fn, watched signal keys, can_run_parallel)
PANELS = [
    ("kpis", "Live KPIs", panel_kpis, ["tick"], True),
    ("revenue", "Revenue", panel_revenue, ["region"], False),  # emits → serial
    ("throughput", "Throughput", panel_throughput, ["window", "tick"], True),
    ("latency", "Service latency", panel_latency, ["region"], True),
    ("health", "System health", panel_health, ["tick"], True),
    ("forecast", "Forecast", panel_forecast, [], True),
]
PANEL_TITLE = {pid: title for pid, title, _, _, _ in PANELS}
PANEL_WATCH = {pid: watch for pid, _, _, watch, _ in PANELS}


def signals_for(signal_key: str) -> list[str]:
    """Panels driven by a signal — used for the blast-radius captions."""
    return [PANEL_TITLE[pid] for pid, w in PANEL_WATCH.items() if signal_key in w]


# -- The Signal Monitor: the "what just happened" centrepiece -----------------


@st.fragment(run_every="1s")
def signal_monitor() -> None:
    """A live monitor that polls once a second so panel ages tick up on screen.

    It is *not* wired to any signal — it just reads session state. That keeps
    the freshness ages counting up even while the rest of the page sits idle.
    """
    with st.container(border=True):
        live = [(pid, _age(pid)) for pid, *_ in PANELS]
        lit = [pid for pid, age in live if age is not None and age < FRESH_SECONDS]

        if lit:
            names = " · ".join(PANEL_TITLE[p] for p in lit)
            st.markdown(
                f"### :green[:material/bolt: {len(lit)} of {len(PANELS)} panels "
                f"just updated] &nbsp; {names}"
            )
        else:
            st.markdown(
                "### :gray[:material/check_circle: Idle] &nbsp; "
                ":gray[— change a control and watch which panels light up]"
            )

        fresh_col, feed_col = st.columns([3, 2], border=True)

        with fresh_col:
            st.markdown("**:material/sensors: Panel freshness**")
            for pid, title, _, watch, _ in PANELS:
                age = _age(pid)
                if age is None:
                    status = ":gray-badge[—]"
                elif age < FRESH_SECONDS:
                    status = ":green-badge[:material/bolt: LIVE just now]"
                else:
                    status = f":gray-badge[idle {int(age)}s]"
                st.markdown(f"{_chips(watch)} &nbsp; **{title}** &nbsp; {status}")

        with feed_col:
            st.markdown("**:material/history: Reload activity**")
            if not ss.events:
                st.caption("No reloads yet.")
            for ts, pid in reversed(ss.events[-7:]):
                dot = ""
                if PANEL_WATCH[pid]:
                    dot = SIGNAL_INFO[PANEL_WATCH[pid][0]]["dot"]
                st.markdown(f"`{ts:%H:%M:%S}` {dot} {PANEL_TITLE[pid]}")


# -- Sidebar controls (meta — these always trigger full reruns) ---------------

with st.sidebar:
    st.header(":material/radar: PULSE")
    st.caption("Operations intelligence demo")

    mode = st.segmented_control(
        "Execution strategy",
        ["🐌 Naive full rerun", "⚡ Scoped (st.signal)"],
        default="⚡ Scoped (st.signal)",
        help="Naive re-runs the whole script on every interaction. Scoped fires "
        "a signal so only the watching panels reload.",
    )
    SCOPED = mode == "⚡ Scoped (st.signal)"

    parallel = st.toggle(
        "Parallel data sources",
        value=True,
        help="Fan slow panels across threads on the initial load and full "
        "reruns. Signal-scoped reruns run their few watchers serially.",
    )

    st.divider()

    @st.fragment(run_every="2s")
    def live_totals() -> None:
        total_reloads = sum(ss.reloads.values())
        st.metric(":material/dns: Backend-seconds spent", f"{ss.backend_seconds:.1f}s")
        st.metric(":material/refresh: Total panel reloads", total_reloads)
        st.caption("Climbs ~3× faster in naive mode — every click reloads all six.")

    live_totals()

    st.divider()
    st.markdown(
        """
        **:material/checklist: What to try**

        1. Change **Region** → only the :violet[violet] panels reload.
        2. Hit **Pull latest** → only the :green[green] panels reload.
        3. Watch the **Forecast** — it watches nothing, so its counter
           never moves (in naive mode it climbs every click).
        4. Flip to **Naive full rerun** and repeat — the monitor lights up
           *all six* every time.
        """
    )
    if st.button("Reset counters", icon=":material/restart_alt:", width="stretch"):
        ss.reloads, ss.backend_seconds, ss.last_loaded, ss.events = {}, 0.0, {}, []
        st.rerun()


# -- Signals (only created in scoped mode) ------------------------------------

SIGNALS: dict[str, object] = {}
if SCOPED:
    SIGNALS = {
        "region": st.signal("sig_region", initial=REGIONS[0]),
        "window": st.signal("sig_window", initial=WINDOWS[1]),
        "tick": st.signal("sig_tick"),
        "summary": st.signal("sig_summary"),
    }


def mount(panel: tuple) -> None:
    """Render a panel — scoped as a watcher fragment, or inline for naive mode."""
    _panel_id, _title, render, watch_keys, can_parallel = panel
    if SCOPED:
        watchers = [SIGNALS[k] for k in watch_keys] or None
        st.fragment(render, watch=watchers, parallel=parallel and can_parallel)()
    else:
        render()


# -- Header -------------------------------------------------------------------

left, right = st.columns([3, 1], vertical_alignment="center")
with left:
    st.title(":material/radar: Operations Intelligence")
    strategy = (
        ":green-badge[:material/bolt: Scoped reruns]"
        if SCOPED
        else ":red-badge[:material/sync: Naive full rerun]"
    )
    par = " :violet-badge[:material/account_tree: Parallel]" if parallel else ""
    st.markdown(f"{strategy}{par}")
with right:
    st.caption(
        "Six slow data sources, scattered across the page. "
        "Change a control and watch *which* panels reload in the monitor below."
    )

with st.expander("How this demo works", icon=":material/help:"):
    st.markdown(
        """
        Each panel simulates a slow query (0.6–1.5s) and is colour-tagged with
        the signals it `watch=`es:

        - :violet-badge[🟣 region] drives **Revenue** + **Service latency**
        - :blue-badge[🔵 window] drives **Throughput**
        - :green-badge[🟢 tick] drives **KPIs**, **Throughput**, **System health**
        - :orange-badge[🟠 summary] is *chained* — the Revenue panel emits it,
          and the headline banner watches it
        - :gray-badge[watches nothing] **Forecast** loads once and never reloads

        In **⚡ Scoped** mode, changing a control fires one signal and only the
        matching panels rerun — the **Signal Monitor** shows exactly which.
        In **🐌 Naive** mode the whole script reruns, so all six light up on
        every click. The :material/account_tree: **Parallel** toggle fans the
        slow panels across threads on the initial load.
        """
    )

# -- Chained-signal headline banner -------------------------------------------


def render_banner() -> None:
    # On the very first full run the Revenue panel hasn't emitted `summary` yet
    # (it renders below this banner), so fall back to a baseline headline. After
    # the first region change the chained value flows in.
    baseline = f"{ss.get('f_region', REGIONS[0])} · live feed connected"
    if SCOPED:
        text = SIGNALS["summary"].value or baseline
    else:
        text = ss.get("naive_headline") or baseline
    st.info(
        f":material/campaign: **Regional headline** — {text}", icon=":material/bolt:"
    )


if SCOPED:
    st.fragment(render_banner, watch=[SIGNALS["summary"]], parallel=False)()
else:
    render_banner()

# -- Control bar --------------------------------------------------------------

with st.container(border=True):
    st.markdown("**:material/tune: Controls** — each fires one signal")
    c1, c2, c3 = st.columns(3, vertical_alignment="top")
    with c1:
        if SCOPED:
            st.selectbox("Region", REGIONS, key="f_region", on_change=SIGNALS["region"])
        else:
            st.selectbox("Region", REGIONS, key="f_region")
        st.caption(f"{_chips(['region'])} → drives {len(signals_for('region'))} panels")
    with c2:
        if SCOPED:
            st.segmented_control(
                "Window",
                WINDOWS,
                default=WINDOWS[1],
                key="f_window",
                on_change=SIGNALS["window"],
            )
        else:
            st.segmented_control("Window", WINDOWS, default=WINDOWS[1], key="f_window")
        st.caption(f"{_chips(['window'])} → drives {len(signals_for('window'))} panel")
    with c3:
        if SCOPED:
            st.button(
                "Pull latest data",
                icon=":material/sync:",
                type="primary",
                width="stretch",
                on_click=SIGNALS["tick"],
            )
        else:
            st.button(
                "Pull latest data",
                icon=":material/sync:",
                type="primary",
                width="stretch",
            )
        st.caption(f"{_chips(['tick'])} → drives {len(signals_for('tick'))} panels")

# -- Live Signal Monitor ------------------------------------------------------

signal_monitor()

# -- Dashboard grid -----------------------------------------------------------

mount(PANELS[0])  # KPI strip, full width

row1 = st.columns(2)
with row1[0]:
    mount(PANELS[1])  # revenue (region)
with row1[1]:
    mount(PANELS[2])  # throughput (window + tick)

row2 = st.columns(2)
with row2[0]:
    mount(PANELS[3])  # latency (region)
with row2[1]:
    mount(PANELS[4])  # health (tick)

mount(PANELS[5])  # forecast (watches nothing), full width

# =============================================================================
# Dependency chain lab — a second, independent reactive subgraph
# =============================================================================
#
# Because signals scope their reruns, this whole pipeline lives on the SAME page
# as the dashboard above without interfering: clicking "Ingest batch" cascades
# through these stages only, and changing a dashboard control reruns dashboard
# panels only. The lab is always signal-driven (independent of the dashboard's
# execution-strategy toggle).

LAB_LATENCY = {
    "extract": 0.9,
    "transform": 0.8,
    "load": 0.7,
    "report": 0.5,
    "audit": 0.45,
    "alert": 0.45,
}
LAB_COLOR = {
    "raw": "red",
    "extracted": "orange",
    "transformed": "blue",
    "loaded": "green",
}

LAB = {
    "raw": st.signal("lab_raw"),
    "extracted": st.signal("lab_extracted", initial=0),
    "transformed": st.signal("lab_transformed", initial=0),
    "loaded": st.signal("lab_loaded", initial=0),
}


def _lab_chip(signal_key: str) -> str:
    return f":{LAB_COLOR[signal_key]}-badge[{signal_key}]"


def _lab_step(stage_key: str, label: str, detail: str) -> None:
    """Run a pipeline stage: simulate work, then log it to the cascade trace."""
    with st.spinner("Working…"):
        time.sleep(LAB_LATENCY[stage_key])
    ss.lab_runs[stage_key] = ss.lab_runs.get(stage_key, 0) + 1
    ss.lab_trace.append((datetime.now(), label, detail, LAB_LATENCY[stage_key]))


def _lab_card(num: str, name: str, watches: str, emits: str | None, body: str) -> None:
    wires = f"watches {_lab_chip(watches)}"
    if emits:
        wires += f" → emits {_lab_chip(emits)}"
    with st.container(border=True):
        st.markdown(f"**{num} {name}**")
        st.caption(wires)
        st.markdown(body)


def stage_extract() -> None:  # watches raw
    ss.lab_trace = []  # a fresh cascade starts here
    ss.lab_batch += 1
    rng = np.random.default_rng(ss.lab_batch)
    count = int(rng.integers(950, 1050))
    ss["lab_count"] = count
    _lab_step("extract", "① Extract", f"read {count:,} records from source")
    LAB["extracted"].send(count)
    _lab_card("①", "Extract", "raw", "extracted", f"### {count:,}\nrecords read")


def stage_transform() -> None:  # watches extracted
    raw_count = LAB["extracted"].value
    valid = int(raw_count * 0.94)
    _lab_step("transform", "② Transform", f"cleaned {raw_count:,} → {valid:,} valid")
    LAB["transformed"].send(valid)
    _lab_card(
        "②",
        "Transform",
        "extracted",
        "transformed",
        f"### {valid:,}\n:gray[{raw_count:,} in · {raw_count - valid:,} dropped]",
    )


def stage_load() -> None:  # watches transformed
    rows = LAB["transformed"].value
    _lab_step("load", "③ Load", f"wrote {rows:,} rows to the warehouse")
    LAB["loaded"].send(rows)
    _lab_card("③", "Load", "transformed", "loaded", f"### {rows:,}\nrows written")


def consumer_report() -> None:  # watches loaded
    rows = LAB["loaded"].value
    _lab_step("report", "④ Report", f"refreshed dashboard with {rows:,} rows")
    _lab_card("④", "Report", "loaded", None, f"### {rows:,}\nrows reported")


def consumer_audit() -> None:  # watches loaded
    rows = LAB["loaded"].value
    _lab_step("audit", "④ Audit", "appended audit-log entry")
    _lab_card(
        "④", "Audit", "loaded", None, f"logged batch #{ss.lab_batch}\n({rows:,} rows)"
    )


def consumer_alert() -> None:  # watches loaded
    rows = LAB["loaded"].value
    ok = rows > 900
    _lab_step("alert", "④ Alert", "healthy" if ok else "LOW VOLUME")
    state = ":green-badge[healthy]" if ok else ":red-badge[low volume]"
    _lab_card("④", "Alert", "loaded", None, f"{state}\n\n{rows:,} rows loaded")


def lab_trace_panel() -> None:  # watches loaded — declared last, so runs last
    with st.container(border=True):
        st.markdown(
            "**:material/timeline: Cascade trace** — execution order of the last pass"
        )
        if not ss.lab_trace:
            st.caption("Click **Ingest batch** to run the pipeline.")
            return
        for t, label, detail, secs in ss.lab_trace:
            stamp = f"{t:%H:%M:%S}.{t.microsecond // 1000:03d}"
            st.markdown(
                f"`{stamp}` &nbsp; **{label}** — {detail} &nbsp; :gray[{secs * 1000:.0f}ms]"
            )
        total = sum(s for *_, s in ss.lab_trace)
        fanout = sum(LAB_LATENCY[k] for k in ("report", "audit", "alert"))
        batched = max(LAB_LATENCY[k] for k in ("report", "audit", "alert"))
        st.caption(
            f"One trigger → {len(ss.lab_trace)} stages, in order, in a single rerun "
            f"pass · {total * 1000:.0f}ms of pipeline work."
        )
        st.caption(
            f":material/schedule: The three :green-badge[loaded] consumers run "
            f"**serially** today ({fanout * 1000:.0f}ms). *Parallel watcher batching* "
            f"(spec Phase 3) would run them as one concurrent batch (~{batched * 1000:.0f}ms) "
            "and then return to serial — not yet implemented; signal-triggered watchers "
            "always run serially for now."
        )


def lab_graph() -> None:
    """A static DAG of the pipeline: the chain (left) fanning out (right)."""
    dot = """
    digraph pipeline {
      rankdir=LR; bgcolor="transparent"; pad=0.2;
      node [shape=box style="rounded,filled" fontname="sans-serif"
            fontcolor="white" color="#44475a" fillcolor="#2b2b3d" fontsize=11];
      edge [color="#8888aa" fontcolor="#8888aa" fontsize=9];
      Ingest [fillcolor="#6C5CE7" color="#6C5CE7"];
      Ingest -> Extract  [label="raw"];
      Extract -> Transform [label="extracted"];
      Transform -> Load  [label="transformed"];
      Load -> Report [label="loaded"];
      Load -> Audit  [label="loaded"];
      Load -> Alert  [label="loaded"];
    }
    """
    st.graphviz_chart(dot, use_container_width=True)


st.divider()
st.header(":material/account_tree: Dependency chain lab")
st.markdown(
    "A four-stage ETL pipeline wired entirely by signals. One **Ingest** click "
    "fires :red-badge[raw], which cascades :red-badge[raw] → :orange-badge[extracted] "
    "→ :blue-badge[transformed] → :green-badge[loaded], then **fans out** to three "
    "consumers — all in a single rerun pass, in dependency order. The record count "
    "is a real payload carried by each `send()`."
)

lab_left, lab_right = st.columns([2, 3], vertical_alignment="center")
with lab_left:
    st.button(
        "Ingest batch",
        icon=":material/play_arrow:",
        type="primary",
        width="stretch",
        on_click=LAB["raw"],
        help="Fires the `raw` signal → watch the cascade ripple through every stage.",
    )
    st.caption(":red-badge[raw] → drives the whole pipeline")
with lab_right:
    lab_graph()

st.markdown("**:material/conveyor_belt: Pipeline** (chain)")
pipe = st.columns(3)
with pipe[0]:
    st.fragment(stage_extract, watch=[LAB["raw"]], parallel=False)()
with pipe[1]:
    st.fragment(stage_transform, watch=[LAB["extracted"]], parallel=False)()
with pipe[2]:
    st.fragment(stage_load, watch=[LAB["transformed"]], parallel=False)()

st.markdown(
    "**:material/call_split: Fan-out** — :green-badge[loaded] drives three consumers "
    "(one signal, three watchers). They run **serially** for now — see the trace note below."
)
fan = st.columns(3)
with fan[0]:
    st.fragment(consumer_report, watch=[LAB["loaded"]], parallel=False)()
with fan[1]:
    st.fragment(consumer_audit, watch=[LAB["loaded"]], parallel=False)()
with fan[2]:
    st.fragment(consumer_alert, watch=[LAB["loaded"]], parallel=False)()

# Declared last so it runs after every other loaded-watcher in the pass and
# therefore sees the complete, ordered trace.
st.fragment(lab_trace_panel, watch=[LAB["loaded"]], parallel=False)()

st.caption(
    ":material/info: Each stage `send()`s the next signal, so the runtime runs them "
    "in dependency order within one pass. A signal fires at most once per pass, so even "
    "if two stages emitted the same signal the watchers would still run only once."
)
