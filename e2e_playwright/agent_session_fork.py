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

"""SPIKE: a multi-filter app whose session an agent forks.

The dashboard page is the widget-state-embedding branch's test app
(`agent_view_state.py`), so the two approaches run against the same widgets.
The additions cover what only a server-side copy can carry, and what a copy
cannot: state set from code, a dialog kept open through session state, values
that do not deep-copy, a shared cached resource, an upload, and the
connection's headers.
"""

import hashlib
import json
import sqlite3
import threading
import uuid
from datetime import date

import numpy as np
import pandas as pd

import streamlit as st
from streamlit.runtime.agent.fork import grant_for_current_session

COUNTRIES = {"EU": ["France", "Germany"], "US": ["California", "Texas"]}
CITIES = {
    "France": ["Paris", "Lyon"],
    "Germany": ["Berlin", "Munich"],
    "California": ["Los Angeles", "San Francisco"],
    "Texas": ["Austin", "Dallas"],
}

_TOKEN_HEADER = "Sf-Context-Current-User-Token"


def _digest(value: str | None) -> str | None:
    """Enough of a value to tell two apart, without printing a credential."""
    return None if value is None else hashlib.sha256(value.encode()).hexdigest()[:8]


class _Registry:
    """A shared resource with a lock, so a deep copy of it would fail."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.hits = 0


@st.cache_resource
def get_registry() -> _Registry:
    return _Registry()


@st.cache_resource(scope="session")
def callers_rights_connection() -> dict[str, str | None]:
    """Stands in for `st.connection("snowflake-callers-rights")`.

    That connection is cached per session in the same way, and reads the
    caller's token from `st.context.headers` once, when it connects.
    """
    return {
        "id": uuid.uuid4().hex[:8],
        "connected_with": _digest(st.context.headers.get(_TOKEN_HEADER)),
    }


def _use_us_preset() -> None:
    # A value set only through session state, from code.
    st.session_state.region = "US"


def _count_price_change() -> None:
    st.session_state.price_changes = st.session_state.get("price_changes", 0) + 1


def _pick_favorite() -> None:
    # Held by no widget, so only a server-side copy can carry it.
    st.session_state.favorite = "Lyon"


def _seed_session_objects() -> None:
    """Values apps keep in session state that a deep copy has to deal with.

    Each is built only when missing, the way apps usually initialize session
    state, which is what lets a fork drop one it cannot copy.
    """
    state = st.session_state
    if "db" not in state:
        state.db = sqlite3.connect(":memory:", check_same_thread=False)
    if "pending" not in state:
        state.pending = (n for n in range(3))
    if "lock" not in state:
        state.lock = threading.Lock()
    if "frame" not in state:
        state.frame = pd.DataFrame(np.zeros((200_000, 10)), columns=list("abcdefghij"))
    if "registry" not in state:
        state.registry = get_registry()


@st.dialog("Notes")
def notes() -> None:
    st.text_input("Note", key="note")


@st.dialog("Pinned notes", on_dismiss="rerun")
def pinned_notes() -> None:
    st.text_input("Pinned note", key="pinned_note")
    st.text(f"PINNED {st.session_state.get('pinned_note', '')}")


def dashboard() -> None:
    _seed_session_objects()
    st.text("FORK " + grant_for_current_session())

    st.sidebar.button("US preset", on_click=_use_us_preset)
    region = st.sidebar.selectbox("Region", list(COUNTRIES), key="region")
    # Options depend on the region.
    country = st.sidebar.selectbox("Country", COUNTRIES[region], key="country")
    # Options depend on the country, and no key: its generated ID changes.
    city = st.sidebar.selectbox("City", CITIES[country])

    products = st.multiselect("Products", ["A", "B", "C", "D"], default=["A"])
    price = st.slider(
        "Price", 0, 100, (10, 90), key="price", on_change=_count_price_change
    )
    since = st.slider(
        "Since",
        min_value=date(2024, 1, 1),
        max_value=date(2024, 12, 31),
        value=date(2024, 1, 1),
        key="since",
    )
    only_active = st.checkbox("Only active", key="only_active")
    search = st.text_input("Search")
    st.text_input("API token", type="password", key="token")
    sort = st.selectbox("Sort", ["name", "price"], key="sort", bind="query-params")

    with st.form("limits"):
        limit = st.number_input("Row limit", min_value=1, max_value=1000, value=100)
        st.form_submit_button("Apply")

    st.button("Pick favorite", on_click=_pick_favorite)
    upload = st.file_uploader("Upload", key="upload")

    view = {
        "region": region,
        "country": country,
        "city": city,
        "products": products,
        "price": price,
        "since": since.isoformat(),
        "only_active": only_active,
        "search": search,
        "limit": limit,
        "ref": st.query_params.get("ref"),
        "sort": sort,
    }
    st.text("VIEW " + json.dumps(view, sort_keys=True))

    state = st.session_state
    code_state = {
        "favorite": state.get("favorite"),
        "price_changes": state.get("price_changes", 0),
        "token_set": bool(state.get("token")),
        "upload": None if upload is None else [upload.name, upload.size],
    }
    st.text("CODE " + json.dumps(code_state, sort_keys=True))

    objects = {
        "db_works": state.db.execute("select 1").fetchone() == (1,),
        "pending_next": next(state.pending, "exhausted"),
        "lock_free": not state.lock.locked(),
        "frame_rows": len(state.frame),
        "registry_shared": state.registry is get_registry(),
    }
    st.text("OBJECTS " + json.dumps(objects, sort_keys=True))

    _show_headers()

    @st.fragment
    def chart_options() -> None:
        chart = st.radio("Chart type", ["bar", "line"], key="chart")
        st.text(f"FRAGMENT {chart}")

    chart_options()

    if st.button("Open notes"):
        notes()
    # A dialog the app keeps open through session state rather than through a
    # button press, which a server-side copy can reopen.
    if st.button("Pin notes"):
        st.session_state.show_pinned = True
    if st.session_state.get("show_pinned"):
        pinned_notes()


def _show_headers() -> None:
    headers = {
        "token": _digest(st.context.headers.get(_TOKEN_HEADER)),
        "probe": st.context.headers.get("X-Fork-Probe"),
        "user_agent": st.context.headers.get("User-Agent", "")[:24],
        "user": st.user.get("user_name"),
        "timezone": st.context.timezone,
    }
    st.text("HEADERS " + json.dumps(headers, sort_keys=True))
    st.text("RESOURCE " + json.dumps(callers_rights_connection(), sort_keys=True))


def settings() -> None:
    st.text("FORK " + grant_for_current_session())
    _show_headers()
    theme = st.radio("Density", ["cozy", "compact"], key="density")
    st.text(f"SETTINGS {theme}")


st.navigation(
    [
        st.Page(dashboard, title="Dashboard", url_path="dashboard", default=True),
        st.Page(settings, title="Settings", url_path="settings"),
    ]
).run()
