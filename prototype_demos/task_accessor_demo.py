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

"""Demo app for the `.task()` accessor prototype (Alternative C).

Run with `make debug prototype_demos/task_accessor_demo.py`, then open the app in
two browser tabs with the same region selected to watch one shared computation
update both of them.
"""

from __future__ import annotations

import time
import uuid

import streamlit as st

SLOW_SECONDS = 6


@st.cache_data(show_spinner=False)
def slow_query(region: str) -> dict[str, str]:
    """Stand-in for a slow database query. Never runs on the script thread."""
    time.sleep(SLOW_SECONDS)
    return {
        "region": region,
        "rows": "1,284",
        # A fresh id per execution: two tabs showing the same id shared one run.
        "computation_id": uuid.uuid4().hex[:8],
        "finished_at": time.strftime("%H:%M:%S"),
    }


@st.cache_data(show_spinner=False)
def failing_query(region: str) -> str:
    raise RuntimeError(f"No warehouse available for {region}")


@st.cache_data(ttl=15, refresh_mode="background", show_spinner=False)
def hourly_rollup(region: str) -> str:
    time.sleep(3)
    return f"{region} rollup computed at {time.strftime('%H:%M:%S')}"


st.title("Non-blocking cached execution — `.task()` accessor")
st.caption(
    "Alternative C: the plain call `slow_query(region)` is unchanged; "
    "`slow_query.task(region)` returns a handle instead of blocking."
)

st.session_state.setdefault("script_runs", 0)
st.session_state["script_runs"] += 1

region = st.radio("Region", ["emea", "amer", "apac"], horizontal=True)

st.header("1. The slow query")
task = slow_query.task(region)
if task.running:
    st.info(f"Running `slow_query({region!r})` — this takes {SLOW_SECONDS}s.")
elif task.error:
    st.error(f"Query failed: {task.error}")
else:
    result = task.result
    st.success(f"{result['rows']} rows for {result['region']}")
    st.write(
        f"Computation `{result['computation_id']}` finished at {result['finished_at']}."
    )

if st.button("Clear the query cache"):
    slow_query.clear()
    st.rerun()

st.header("2. The script is not blocked")
st.write(
    "These widgets render and respond on the very first run, while the query "
    "above is still computing."
)
st.slider("An unrelated slider", 0, 100, 50)
st.write(f"This session has run the script {st.session_state['script_runs']} times.")

st.header("3. A warm hit resolves in the same run")
warm = slow_query.task(region)
st.write("Cached already:", warm.done)

st.header("4. A task that fails")
failed = failing_query.task(region)
if failed.running:
    st.info("Running the failing query...")
elif failed.error:
    st.warning(f"Reported through the handle: {failed.error}")

st.header("5. Composing with `refresh_mode`")
rollup = hourly_rollup.task(region)
if rollup.running:
    st.info("Computing the rollup...")
else:
    st.write(rollup.result)
st.caption(
    "With a 15s ttl and background refresh, the stale value keeps being served "
    "while a refresh runs. The script never blocks either way."
)
