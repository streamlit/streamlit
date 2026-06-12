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

import streamlit as st


def count_run(name: str) -> int:
    """Track how often each part of the app executes."""
    runs = int(st.session_state.get(name, 0)) + 1
    st.session_state[name] = runs
    return runs


full_runs = count_run("full_runs")

country = st.signal("US", key="country")
stats = st.signal("stats for US", key="stats")

# Bare attachment: changing the selectbox fires the signal and reruns only
# its watchers (chart_panel, plus metrics_row via the chained stats signal).
# Note: placed in the main body (not sidebar) to avoid dropdown z-index issues
# in headless E2E tests.
st.selectbox("Country", ["US", "CA", "DE"], key="country_select", on_change=country)

st.markdown(f"full runs: {full_runs}")

col1, col2 = st.columns(2)


@st.fragment(watch=country)
def chart_panel():
    runs = count_run("chart_runs")
    st.markdown(f"chart: {st.session_state.country_select} (chart runs: {runs})")
    # Chained signal: this watcher re-emits for its own dependents.
    stats.send(f"stats for {st.session_state.country_select}")


@st.fragment(watch=stats)
def metrics_row():
    runs = count_run("metrics_runs")
    st.markdown(f"metrics: {stats.value} (metrics runs: {runs})")


with col1:
    chart_panel()
with col2:
    metrics_row()


@st.fragment
def poke_panel():
    runs = count_run("poke_runs")
    # A value widget with a signal callback scopes its rerun to the signal's
    # watchers, suppressing this enclosing (non-watcher) fragment's own rerun.
    st.checkbox("Poke country", key="poke", on_change=country)
    st.markdown(f"poke runs: {runs}")


poke_panel()


@st.fragment
def live_table():
    runs = count_run("table_runs")
    st.markdown(f"table runs: {runs}")


live_table()

# Fragment function as a callback: reruns only live_table.
st.sidebar.button("Reload table", on_click=live_table)
