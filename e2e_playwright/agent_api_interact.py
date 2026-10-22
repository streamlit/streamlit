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

from __future__ import annotations

import time

import numpy as np
import pandas as pd

import streamlit as st

# The short-lived token Snowflake injects for caller's-rights connections.
# Only its presence is shown: an app must never display its value.
CALLERS_RIGHTS_TOKEN_HEADER = "Sf-Context-Current-User-Token"

st.session_state.setdefault("runs", 0)
st.session_state.runs += 1
st.sidebar.text(f"runs={st.session_state.runs}")
st.sidebar.selectbox(
    "Region", ["EMEA", "APAC", "AMER"], key="region", bind="query-params"
)


def home() -> None:
    st.image(np.full((8, 8, 3), (255, 75, 75), dtype=np.uint8), caption="Swatch")
    token = st.context.headers.get(CALLERS_RIGHTS_TOKEN_HEADER)
    st.text(f"timezone={st.context.timezone}")
    st.text(f"locale={st.context.locale}")
    st.text(f"url={st.context.url}")
    st.text(f"token={'present' if token else 'absent'}")
    st.text(f"user={st.user.get('email')}")
    st.text(f"logged_in={bool(st.user.get('is_logged_in'))}")
    st.text(f"cookies={len(st.context.cookies)}")


def report() -> None:
    st.selectbox(
        "Quarter", ["Q1", "Q2", "Q3", "Q4"], key="quarter", bind="query-params"
    )


def slow() -> None:
    st.session_state.setdefault("starts", 0)
    st.session_state.setdefault("done", 0)
    st.session_state.starts += 1
    # Longer than the test module's `server.agentWaitTimeout` of 5 seconds, with
    # room for the test to send another request while this run is still going.
    time.sleep(8)
    st.session_state.done += 1
    st.text(f"starts={st.session_state.starts}")
    st.text(f"done={st.session_state.done}")


def data() -> None:
    rows = st.number_input("Rows", min_value=1, max_value=500, value=250, key="rows")
    orders = pd.DataFrame(
        {"order": range(rows), "amount": [n * 1.5 for n in range(rows)]}
    )
    st.dataframe(orders, key="orders")
    st.line_chart(orders, x="order", y="amount")


st.navigation(
    [
        st.Page(home, title="Home", default=True),
        st.Page(report, title="Report", url_path="report"),
        st.Page(slow, title="Slow", url_path="slow"),
        st.Page(data, title="Data", url_path="data"),
    ]
).run()
