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

# This is a standalone demo app, not a package module (INP001); it uses
# typographic glyphs in user-facing copy on purpose (RUF001/RUF003); and as a
# demo it injects a little CSS for motion/polish via st.markdown (S-rules off).
# ruff: noqa: INP001, RUF001

"""PULSE — a guided, animated demo for ``st.signal`` and parallel fragments.

Run with:

    streamlit run specs/2026-06-11-st-signal/demo_app.py

The big idea, in one sentence: **change one control and only the panels that
care reload — everything else stays live.** This app makes that visible with
motion:

* a **live heartbeat** that keeps ticking during scoped reruns but freezes
  during a naive full rerun (proof the page stays responsive);
* a **flash** on every panel the instant it reloads (so you see *which* lit up);
* a **glowing map** that reacts to the Region control;
* a **cascade timeline (Gantt)** in the lab that shows the serial chain and the
  parallel fan-out overlapping in real time;
* an **auto-pilot** that drives the whole tour hands-free.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import pydeck as pdk

import streamlit as st

st.set_page_config(
    page_title="PULSE — Operations Intelligence",
    page_icon=":material/radar:",
    layout="wide",
)

# -- Look & feel: a little injected CSS for motion and polish -----------------
# (In a real app most of this belongs in a theme config; here it's inline so the
# demo is a single self-contained file.)

ACCENT = "#6C5CE7"
GOOD = "#00E5A0"

st.markdown(
    f"""
    <style>
      /* Gradient hero title. */
      .pulse-hero {{
        font-size: 2.6rem; font-weight: 800; line-height: 1.1; margin: 0;
        background: linear-gradient(90deg, {ACCENT}, {GOOD});
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }}
      /* A thin accent bar that sweeps once whenever its panel re-renders —
         i.e. every time that panel actually reloads. */
      @keyframes flashbar {{
        0%   {{ opacity: 1; transform: scaleX(0); transform-origin: left; }}
        40%  {{ opacity: 1; transform: scaleX(1); transform-origin: left; }}
        100% {{ opacity: 0; transform: scaleX(1); transform-origin: left; }}
      }}
      .flash-bar {{
        height: 4px; border-radius: 4px; margin-bottom: 10px;
        animation: flashbar 1.6s ease-out;
      }}
      /* Heartbeat dots. */
      .hb {{ display: flex; align-items: center; gap: 8px; }}
      .hb-dot {{
        width: 12px; height: 12px; border-radius: 50%;
        background: #3a3a4a; transition: none;
      }}
      .hb-dot.on {{ background: {GOOD}; box-shadow: 0 0 12px {GOOD}; }}
      .hb-clock {{
        font-family: ui-monospace, monospace; font-size: 1.8rem;
        font-weight: 700; letter-spacing: 2px;
      }}
    </style>
    """,
    unsafe_allow_html=True,
)


def flash(color: str = ACCENT) -> None:
    """Emit a one-shot accent sweep. Replays on each re-render of its panel."""
    st.markdown(
        f'<div class="flash-bar" style="background:'
        f'linear-gradient(90deg, {color}, transparent)"></div>',
        unsafe_allow_html=True,
    )


# -- Domain + signal metadata -------------------------------------------------

REGIONS = ["North America", "Europe", "Asia-Pacific", "Latin America"]
REGION_COORDS = {
    "North America": (40.0, -100.0),
    "Europe": (50.0, 10.0),
    "Asia-Pacific": (35.0, 139.0),
    "Latin America": (-15.0, -60.0),
}
WINDOWS = ["1H", "24H", "7D"]
SERVICES = ["api", "database", "cache", "queue", "auth"]

# Simulated query latency per panel (seconds).
LATENCY = {
    "kpis": 0.6,
    "revenue": 1.4,
    "throughput": 1.1,
    "map": 1.0,
    "latency": 1.2,
    "health": 0.8,
    "forecast": 1.5,
}

# Each signal gets a colour + dot + hex so the wiring is readable at a glance.
SIGNAL_INFO = {
    "region": {"color": "violet", "dot": "🟣", "hex": ACCENT},
    "window": {"color": "blue", "dot": "🔵", "hex": "#0984E3"},
    "tick": {"color": "green", "dot": "🟢", "hex": GOOD},
    "summary": {"color": "orange", "dot": "🟠", "hex": "#E1A100"},
}

FRESH_SECONDS = 4  # A panel counts as "just updated" for this long.

# -- Session bookkeeping ------------------------------------------------------

ss = st.session_state
ss.setdefault("reloads", {})
ss.setdefault("backend_seconds", 0.0)
ss.setdefault("last_loaded", {})  # panel_id -> datetime
ss.setdefault("events", [])  # (datetime, panel_id)
ss.setdefault("lab_trace", [])  # (datetime, stage_key, label, detail, seconds)
ss.setdefault("lab_runs", {})  # stage_key -> count
ss.setdefault("lab_batch", 0)
ss.setdefault("heartbeat", 0)  # backend tick counter (freezes when blocked)
ss.setdefault("autopilot_step", 0)


def _record_reload(panel_id: str, seconds: float) -> None:
    """Tally a simulated backend query for the telemetry + activity feed."""
    ss.reloads[panel_id] = ss.reloads.get(panel_id, 0) + 1
    ss.backend_seconds += seconds
    now = datetime.now()
    ss.last_loaded[panel_id] = now
    ss.events.append((now, panel_id))
    del ss.events[:-40]


def _query(panel_id: str, *seed_parts: object) -> np.random.Generator:
    """Simulate a slow data source; return a seeded RNG for fresh-but-stable data."""
    seconds = LATENCY[panel_id]
    with st.spinner("Querying source…"):
        time.sleep(seconds)
    _record_reload(panel_id, seconds)
    seed = abs(hash((panel_id, ss.reloads[panel_id], *seed_parts))) % (2**32)
    return np.random.default_rng(seed)


# -- Display helpers ----------------------------------------------------------


def _chips(watch_keys: list[str]) -> str:
    if not watch_keys:
        return ":gray-badge[:material/block: watches nothing]"
    return " ".join(
        f":{SIGNAL_INFO[k]['color']}-badge[{SIGNAL_INFO[k]['dot']} {k}]"
        for k in watch_keys
    )


def _accent_for(watch_keys: list[str]) -> str:
    return SIGNAL_INFO[watch_keys[0]]["hex"] if watch_keys else "#7a7a8a"


def _age(panel_id: str) -> float | None:
    ts = ss.last_loaded.get(panel_id)
    return None if ts is None else (datetime.now() - ts).total_seconds()


def _panel_footer(panel_id: str) -> None:
    count = ss.reloads.get(panel_id, 0)
    ts = ss.last_loaded.get(panel_id)
    when = ts.strftime("%H:%M:%S") if ts else "—"
    st.caption(f":material/refresh: reloaded **{count}×** · updated `{when}`")


# -- Live heartbeat: the "is the page still alive?" proof ---------------------


@st.fragment(run_every="0.5s")
def heartbeat() -> None:
    """A backend-driven pulse. Each tick increments a counter and advances a dot.

    Because the count comes from the *backend* (not a pure CSS loop), it keeps
    moving only while the script thread is free to serve this fragment. A naive
    full rerun blocks that thread for seconds, so the clock and dots visibly
    **freeze** — a scoped rerun doesn't touch this fragment, so it keeps ticking.
    """
    ss.heartbeat += 1
    n = 7
    active = ss.heartbeat % n
    dots = "".join(
        f'<span class="hb-dot {"on" if i == active else ""}"></span>' for i in range(n)
    )
    with st.container(border=True):
        cols = st.columns([2, 3], vertical_alignment="center")
        with cols[0]:
            st.markdown(
                f'<div class="hb"><span class="hb-clock">{datetime.now():%H:%M:%S}'
                f"</span></div>",
                unsafe_allow_html=True,
            )
            st.markdown(f'<div class="hb">{dots}</div>', unsafe_allow_html=True)
        with cols[1]:
            st.markdown(
                ":material/cardiology: **Live heartbeat** — keeps ticking while "
                "panels reload in **⚡ Scoped** mode. Switch to **🐌 Naive** and watch "
                "it **freeze** during every reload (the whole page is blocked)."
            )


# -- Panels -------------------------------------------------------------------


def panel_kpis() -> None:
    rng = _query("kpis")
    with st.container(border=True):
        flash(SIGNAL_INFO["tick"]["hex"])
        st.markdown(f"**:material/speed: Live KPIs** &nbsp; {_chips(['tick'])}")
        spark = lambda: list(rng.integers(40, 100, 12))  # noqa: E731
        m = st.columns(3)
        with m[0]:
            st.metric(
                "Throughput",
                f"{rng.integers(820, 990)}/s",
                f"{rng.integers(-8, 12)}%",
                border=True,
                chart_data=spark(),
                chart_type="area",
            )
        with m[1]:
            st.metric(
                "Active sessions",
                f"{rng.integers(11, 19)}.{rng.integers(0, 9)}k",
                f"{rng.integers(-4, 9)}%",
                border=True,
                chart_data=spark(),
                chart_type="line",
            )
        with m[2]:
            # A plotly gauge for visual variety.
            err = rng.uniform(0.1, 1.4)
            fig = _gauge("Error rate %", err, 0, 2, GOOD if err < 1 else "#E17055")
            st.plotly_chart(
                fig, use_container_width=True, config={"displayModeBar": False}
            )
        _panel_footer("kpis")


def _gauge(title: str, value: float, lo: float, hi: float, color: str) -> go.Figure:
    fig = go.Figure(
        go.Indicator(
            mode="gauge+number",
            value=round(value, 2),
            title={"text": title, "font": {"size": 13}},
            gauge={
                "axis": {"range": [lo, hi], "tickwidth": 1},
                "bar": {"color": color},
                "bgcolor": "rgba(0,0,0,0)",
            },
        )
    )
    fig.update_layout(
        height=160,
        margin=dict(l=10, r=10, t=30, b=0),
        paper_bgcolor="rgba(0,0,0,0)",
        font={"color": "#ddd"},
    )
    return fig


def panel_revenue() -> None:
    region = ss.get("f_region", REGIONS[0])
    rng = _query("revenue", region)
    with st.container(border=True):
        flash(SIGNAL_INFO["region"]["hex"])
        st.subheader(":material/payments: Revenue by sector")
        st.markdown(
            f"{_chips(['region'])} &nbsp;·&nbsp; "
            f":orange-badge[:material/bolt: emits 🟠 summary]"
        )
        sectors = ["Retail", "Wholesale", "Direct", "Partner", "Marketplace"]
        revenue = rng.integers(60, 240, len(sectors))
        data = pd.DataFrame({"sector": sectors, "revenue ($k)": revenue})
        st.bar_chart(data, x="sector", y="revenue ($k)", color=ACCENT, height=230)
        _panel_footer("revenue")

    # Chained signal: re-emit a derived headline the banner watches. Runs
    # serially (parallel workers can't fire signals).
    headline = (
        f"{region} · ${int(revenue.sum())}k revenue across {len(sectors)} sectors"
    )
    if "summary" in SIGNALS:
        SIGNALS["summary"].send(headline)
    else:
        ss["naive_headline"] = headline


def panel_map() -> None:
    region = ss.get("f_region", REGIONS[0])
    rng = _query("map", region)
    with st.container(border=True):
        flash(SIGNAL_INFO["region"]["hex"])
        st.subheader(":material/public: Regional activity")
        st.markdown(f"{_chips(['region'])} &nbsp; :gray[selected region glows]")
        rows = []
        for r, (lat, lon) in REGION_COORDS.items():
            selected = r == region
            rows.append(
                {
                    "region": r,
                    "lat": lat,
                    "lon": lon,
                    "radius": (int(rng.integers(70, 100)) if selected else 25) * 9000,
                    "color": [108, 92, 231, 230] if selected else [90, 90, 120, 90],
                }
            )
        df = pd.DataFrame(rows)
        layer = pdk.Layer(
            "ScatterplotLayer",
            df,
            get_position=["lon", "lat"],
            get_radius="radius",
            get_fill_color="color",
            pickable=True,
            stroked=True,
            get_line_color=[255, 255, 255, 120],
        )
        deck = pdk.Deck(
            layers=[layer],
            initial_view_state=pdk.ViewState(latitude=20, longitude=10, zoom=0.5),
            map_style=None,
            tooltip={"text": "{region}"},  # noqa: RUF027  (pydeck template, not an f-string)
        )
        st.pydeck_chart(deck, height=240)
        _panel_footer("map")


def panel_throughput() -> None:
    window = ss.get("f_window", WINDOWS[1])
    rng = _query("throughput", window)
    points = {"1H": 60, "24H": 48, "7D": 84}[window]
    with st.container(border=True):
        flash(SIGNAL_INFO["window"]["hex"])
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
        st.area_chart(data, height=230, color=[ACCENT, GOOD])
        _panel_footer("throughput")


def panel_latency() -> None:
    region = ss.get("f_region", REGIONS[0])
    rng = _query("latency", region)
    with st.container(border=True):
        flash(SIGNAL_INFO["region"]["hex"])
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
        flash(SIGNAL_INFO["tick"]["hex"])
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
        flash("#7a7a8a")
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
        st.line_chart(data, height=210, color=[ACCENT, "#00CEC9"])
        _panel_footer("forecast")


# (id, title, render fn, watched signal keys, can_run_parallel)
PANELS = [
    ("kpis", "Live KPIs", panel_kpis, ["tick"], True),
    ("revenue", "Revenue", panel_revenue, ["region"], False),  # emits → serial
    ("map", "Regional activity", panel_map, ["region"], True),
    ("throughput", "Throughput", panel_throughput, ["window", "tick"], True),
    ("latency", "Service latency", panel_latency, ["region"], True),
    ("health", "System health", panel_health, ["tick"], True),
    ("forecast", "Forecast", panel_forecast, [], True),
]
PANEL_TITLE = {pid: title for pid, title, _, _, _ in PANELS}
PANEL_WATCH = {pid: watch for pid, _, _, watch, _ in PANELS}


def signals_for(signal_key: str) -> list[str]:
    return [PANEL_TITLE[pid] for pid, w in PANEL_WATCH.items() if signal_key in w]


# -- Signal Monitor: the "what just happened" board ---------------------------


@st.fragment(run_every="1s")
def signal_monitor() -> None:
    """Polls once a second so panel ages tick up and the feed stays live."""
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
            st.markdown("**:material/history: Reload activity** (live)")
            if not ss.events:
                st.caption("No reloads yet.")
            for ts, pid in reversed(ss.events[-7:]):
                dot = (
                    SIGNAL_INFO[PANEL_WATCH[pid][0]]["dot"]
                    if PANEL_WATCH[pid]
                    else "⚪"
                )
                st.markdown(f"`{ts:%H:%M:%S}` {dot} {PANEL_TITLE[pid]}")


# -- Sidebar ------------------------------------------------------------------

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
        help="Fan slow panels across threads on the initial load and full reruns.",
    )

    autopilot = st.toggle(
        "🚀 Auto-pilot",
        value=False,
        disabled=not SCOPED,
        help="Hands-free: fires a different signal every few seconds so you can "
        "just watch which panels light up. Scoped mode only.",
    )

    st.divider()

    @st.fragment(run_every="2s")
    def live_totals() -> None:
        st.metric(":material/dns: Backend-seconds spent", f"{ss.backend_seconds:.1f}s")
        st.metric(":material/refresh: Total panel reloads", sum(ss.reloads.values()))
        st.caption("Climbs ~3× faster in naive mode — every click reloads everything.")

    live_totals()

    st.divider()
    st.markdown(
        """
        **:material/checklist: Try this**

        1. **Change Region** → :violet[violet] panels flash (incl. the map).
        2. **Pull latest** → :green[green] panels flash.
        3. Watch the **heartbeat** keep ticking.
        4. Flip to **🐌 Naive** and repeat — *everything* flashes and the
           heartbeat **freezes**.
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


# -- Hero ---------------------------------------------------------------------

st.markdown('<p class="pulse-hero">Operations Intelligence</p>', unsafe_allow_html=True)
strategy = (
    ":green-badge[:material/bolt: Scoped reruns]"
    if SCOPED
    else ":red-badge[:material/sync: Naive full rerun]"
)
par = " :violet-badge[:material/account_tree: Parallel]" if parallel else ""
auto = " :orange-badge[:material/rocket_launch: Auto-pilot]" if autopilot else ""
st.markdown(
    f"{strategy}{par}{auto} &nbsp; — change a control and **only the panels that "
    f"watch it reload**. Everything else stays live."
)

with st.expander("How this demo works", icon=":material/help:"):
    st.markdown(
        """
        Seven panels each simulate a slow query (0.6–1.5s), colour-tagged with the
        signal they `watch=`:

        - :violet-badge[🟣 region] → **Revenue**, **Regional map**, **Service latency**
        - :blue-badge[🔵 window] → **Throughput**
        - :green-badge[🟢 tick] → **KPIs**, **Throughput**, **System health**
        - :orange-badge[🟠 summary] is *chained* — Revenue emits it, the headline watches it
        - :gray-badge[watches nothing] **Forecast** loads once and never reloads

        In **⚡ Scoped** mode a control fires one signal and only its panels rerun
        (they **flash**). In **🐌 Naive** mode the whole script reruns — everything
        flashes and the **heartbeat freezes**. The :material/account_tree:
        **Parallel** toggle fans the slow panels across threads.
        """
    )

# -- Heartbeat ----------------------------------------------------------------

heartbeat()

# -- Chained-signal headline banner -------------------------------------------


def render_banner() -> None:
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
        on_click = SIGNALS["tick"] if SCOPED else None
        st.button(
            "Pull latest data",
            icon=":material/sync:",
            type="primary",
            width="stretch",
            on_click=on_click,
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
    mount(PANELS[2])  # map (region)
row2 = st.columns(2)
with row2[0]:
    mount(PANELS[3])  # throughput (window + tick)
with row2[1]:
    mount(PANELS[4])  # latency (region)
row3 = st.columns(2)
with row3[0]:
    mount(PANELS[5])  # health (tick)
with row3[1]:
    mount(PANELS[6])  # forecast (nothing)

# =============================================================================
# Dependency chain lab — a second, independent reactive subgraph
# =============================================================================

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
LAB_HEX = {"chain": ACCENT, "fanout": GOOD}

LAB = {
    "raw": st.signal("lab_raw"),
    "extracted": st.signal("lab_extracted", initial=0),
    "transformed": st.signal("lab_transformed", initial=0),
    "loaded": st.signal("lab_loaded", initial=0),
}


def _lab_chip(signal_key: str) -> str:
    return f":{LAB_COLOR[signal_key]}-badge[{signal_key}]"


def _lab_step(stage_key: str, label: str, detail: str) -> None:
    start = datetime.now()
    with st.spinner("Working…"):
        time.sleep(LAB_LATENCY[stage_key])
    ss.lab_runs[stage_key] = ss.lab_runs.get(stage_key, 0) + 1
    ss.lab_trace.append((start, stage_key, label, detail, LAB_LATENCY[stage_key]))


def _lab_card(num: str, name: str, watches: str, emits: str | None, body: str) -> None:
    wires = f"watches {_lab_chip(watches)}"
    if emits:
        wires += f" → emits {_lab_chip(emits)}"
    with st.container(border=True):
        flash(LAB_HEX["chain"] if emits or watches != "loaded" else LAB_HEX["fanout"])
        st.markdown(f"**{num} {name}**")
        st.caption(wires)
        st.markdown(body)


def stage_extract() -> None:  # watches raw
    ss.lab_trace = []  # a fresh cascade starts here
    ss.lab_batch += 1
    rng = np.random.default_rng(ss.lab_batch)
    count = int(rng.integers(950, 1050))
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


def consumer_report() -> None:  # watches loaded (parallel)
    rows = LAB["loaded"].value
    _lab_step("report", "④ Report", f"refreshed dashboard with {rows:,} rows")
    _lab_card("④", "Report", "loaded", None, f"### {rows:,}\nrows reported")


def consumer_audit() -> None:  # watches loaded (parallel)
    rows = LAB["loaded"].value
    _lab_step("audit", "④ Audit", "appended audit-log entry")
    _lab_card(
        "④", "Audit", "loaded", None, f"logged batch #{ss.lab_batch}\n({rows:,} rows)"
    )


def consumer_alert() -> None:  # watches loaded (parallel)
    rows = LAB["loaded"].value
    ok = rows > 900
    _lab_step("alert", "④ Alert", "healthy" if ok else "LOW VOLUME")
    state = ":green-badge[healthy]" if ok else ":red-badge[low volume]"
    _lab_card("④", "Alert", "loaded", None, f"{state}\n\n{rows:,} rows loaded")


_CHAIN_STAGES = {"extract", "transform", "load"}


def lab_timeline() -> None:
    """A live Gantt of the last cascade: serial chain, then the parallel fan-out.

    The three consumers share a start time and their bars **overlap** — the
    visual proof that they ran concurrently instead of one after another.
    """
    with st.container(border=True):
        st.markdown("**:material/timeline: Cascade timeline** — when each stage ran")
        if not ss.lab_trace:
            st.caption("Click **Ingest batch** to run the pipeline.")
            return
        rows = [
            {
                "Stage": label,
                "Start": start,
                "Finish": start + timedelta(seconds=secs),
                "Lane": "Serial chain" if key in _CHAIN_STAGES else "Parallel fan-out",
            }
            for start, key, label, _detail, secs in ss.lab_trace
        ]
        df = pd.DataFrame(rows)
        fig = px.timeline(
            df,
            x_start="Start",
            x_end="Finish",
            y="Stage",
            color="Lane",
            color_discrete_map={
                "Serial chain": ACCENT,
                "Parallel fan-out": GOOD,
            },
        )
        fig.update_yaxes(autorange="reversed", title=None)
        fig.update_xaxes(title=None)
        fig.update_layout(
            height=260,
            margin=dict(l=10, r=10, t=10, b=10),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font={"color": "#ccc"},
            legend={"orientation": "h", "y": 1.15},
        )
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

        serial_chain = sum(LAB_LATENCY[k] for k in ("extract", "transform", "load"))
        fanout_serial = sum(LAB_LATENCY[k] for k in ("report", "audit", "alert"))
        fanout_parallel = max(LAB_LATENCY[k] for k in ("report", "audit", "alert"))
        wall = serial_chain + fanout_parallel
        total = serial_chain + fanout_serial
        st.caption(
            f":material/schedule: Serial chain runs end-to-end "
            f"({serial_chain * 1000:.0f}ms); the three :green-badge[loaded] consumers "
            f"**overlap** (~{fanout_parallel * 1000:.0f}ms, not "
            f"{fanout_serial * 1000:.0f}ms serial). Wall-clock ≈ **{wall * 1000:.0f}ms** "
            f"instead of {total * 1000:.0f}ms. Parallel watchers are dispatched "
            "non-blocking; this timeline aggregates them on the next poll."
        )


def lab_graph() -> None:
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
    "A second, **independent** reactive graph on the same page. One **Ingest** "
    "click fires :red-badge[raw] and cascades :red-badge[raw] → :orange-badge[extracted] "
    "→ :blue-badge[transformed] → :green-badge[loaded], then **fans out** to three "
    "parallel consumers — in dependency order, in a single pass. Clicking Ingest "
    "doesn't touch the dashboard above, and dashboard controls don't touch this."
)

lab_left, lab_right = st.columns([2, 3], vertical_alignment="center")
with lab_left:
    st.button(
        "Ingest batch",
        icon=":material/play_arrow:",
        type="primary",
        width="stretch",
        on_click=LAB["raw"],
        help="Fires `raw` → watch the cascade ripple through every stage.",
    )
    st.caption(":red-badge[raw] → drives the whole pipeline")
with lab_right:
    lab_graph()

# A run_every poller (not a watcher): the parallel consumers write the trace
# from worker threads, which surfaces a pass later, so polling aggregates the
# complete cascade after it settles.
st.fragment(lab_timeline, run_every="1s")()

st.markdown("**:material/conveyor_belt: Pipeline** (serial chain)")
pipe = st.columns(3)
with pipe[0]:
    st.fragment(stage_extract, watch=[LAB["raw"]], parallel=False)()
with pipe[1]:
    st.fragment(stage_transform, watch=[LAB["extracted"]], parallel=False)()
with pipe[2]:
    st.fragment(stage_load, watch=[LAB["transformed"]], parallel=False)()

st.markdown(
    "**:material/call_split: Fan-out** — :green-badge[loaded] drives three "
    ":violet-badge[:material/account_tree: parallel] consumers, dispatched "
    "**concurrently** on separate threads (see the overlap in the timeline)."
)
fan = st.columns(3)
with fan[0]:
    st.fragment(consumer_report, watch=[LAB["loaded"]], parallel=True)()
with fan[1]:
    st.fragment(consumer_audit, watch=[LAB["loaded"]], parallel=True)()
with fan[2]:
    st.fragment(consumer_alert, watch=[LAB["loaded"]], parallel=True)()


# -- Auto-pilot ---------------------------------------------------------------
# Declared last so its fired signals append to a clean pass. Fires a different
# signal every few seconds and narrates with a toast, so a viewer can just watch.

_AUTOPILOT_STEPS = [
    ("tick", "🟢 Pull latest — KPIs, Throughput, Health light up"),
    ("region", "🟣 Region refresh — Revenue, Map, Latency light up"),
    ("raw", "🔴 Ingest batch — the lab pipeline cascades"),
    ("window", "🔵 Window refresh — Throughput lights up"),
]

if SCOPED and autopilot:

    @st.fragment(run_every="3s")
    def run_autopilot() -> None:
        step = ss.autopilot_step % len(_AUTOPILOT_STEPS)
        ss.autopilot_step += 1
        key, narration = _AUTOPILOT_STEPS[step]
        st.toast(narration, icon="🚀")
        if key == "raw":
            LAB["raw"]()  # fire the lab cascade
        else:
            SIGNALS[key]()  # bare-fire the dashboard signal

    run_autopilot()

st.caption(
    ":material/info: Each lab stage `send()`s the next signal, so the runtime runs "
    "them in dependency order within one pass. A signal fires at most once per pass."
)
