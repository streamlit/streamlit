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

import json
from typing import Any

import streamlit as st

state = st.session_state


def _line(name: str, value: Any) -> None:
    """Show `name=<JSON>`, the output a browser and the agent API both read."""
    st.text(f"{name}={json.dumps(value)}")


def _changed(key: str) -> None:
    state.log.append([key, state[key]])


def dashboard() -> None:
    region = st.selectbox(
        "Region",
        ["EMEA", "APAC", "AMER"],
        key="region",
        bind="query-params",
        on_change=_changed,
        args=("region",),
    )
    metrics = st.multiselect(
        "Metrics",
        ["revenue", "users", "churn"],
        default=["revenue"],
        key="metrics",
        on_change=_changed,
        args=("metrics",),
    )
    year = st.slider(
        "Year", 2024, 2026, 2026, key="year", on_change=_changed, args=("year",)
    )
    _line("values", {"region": region, "metrics": metrics, "year": year})
    _line("rows", [f"{region}/{m}/{y}" for m in metrics for y in range(2024, year + 1)])
    detail()


@st.fragment
def detail() -> None:
    state.setdefault("fragment_runs", 0)
    state.fragment_runs += 1
    st.radio(
        "Detail",
        ["summary", "full"],
        key="detail",
        on_change=_changed,
        args=("detail",),
    )
    _line("fragment_runs", state.fragment_runs)
    # Here rather than in the page body, so a fragment rerun refreshes it.
    _line("log", state.log)


def _submitted(button: str) -> None:
    state.log.append([button, {"name": state.name, "age": state.age}])


def profile() -> None:
    with st.form("profile"):
        st.text_input("Name", key="name")
        st.number_input("Age", value=30, key="age")
        st.form_submit_button("Save", key="save", on_click=_submitted, args=("save",))
        st.form_submit_button(
            "Draft", key="draft", on_click=_submitted, args=("draft",)
        )
    _line("log", state.log)


def chat() -> None:
    state.setdefault("transcript", [])
    prompt = st.chat_input(
        "Say something", key="prompt", on_submit=_changed, args=("prompt",)
    )
    if prompt is not None:
        state.transcript.append(f"echo: {prompt}")
    _line("transcript", state.transcript)
    _line("log", state.log)


def _dismissed() -> None:
    state.log.append(["dismissed", state.get("new_name")])


@st.dialog("Rename project", on_dismiss=_dismissed)
def rename_dialog() -> None:
    state.setdefault("step", 1)
    _line("step", state.step)
    if state.step == 1:
        st.text_input("New name", key="new_name")
        if st.button("Next", key="next"):
            state.log.append(["next", state.new_name])
            state.draft = state.new_name
            state.step = 2
            st.rerun(scope="fragment")
    else:
        _line("draft", state.draft)
        if st.button("Confirm", key="confirm"):
            state.log.append(["confirm", state.draft])
            state.project = state.draft
            state.step = 1
            st.rerun()


def rename() -> None:
    state.setdefault("project", "Apollo")
    _line("project", state.project)
    _line("log", state.log)
    if st.button("Rename project", key="open_rename"):
        rename_dialog()
    st.checkbox("Archive", key="archive", on_change=_changed, args=("archive",))


state.setdefault("log", [])
state.setdefault("page_runs", 0)
# Counts full runs only: a fragment or dialog rerun leaves it unchanged.
state.page_runs += 1
_line("page_runs", state.page_runs)

st.navigation(
    [
        st.Page(dashboard, title="Dashboard", default=True),
        st.Page(profile, title="Profile", url_path="profile"),
        st.Page(chat, title="Chat", url_path="chat"),
        st.Page(rename, title="Rename", url_path="rename"),
    ]
).run()
