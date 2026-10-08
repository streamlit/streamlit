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

"""A multi-filter app whose view an agent reproduces from the embedded state."""

import json
from datetime import date, datetime, time

import streamlit as st

COUNTRIES = {"EU": ["France", "Germany"], "US": ["California", "Texas"]}
CITIES = {
    "France": ["Paris", "Lyon"],
    "Germany": ["Berlin", "Munich"],
    "California": ["Los Angeles", "San Francisco"],
    "Texas": ["Austin", "Dallas"],
}


def _use_us_preset() -> None:
    # A value set only through session state, from code.
    st.session_state.region = "US"


st.sidebar.button("US preset", on_click=_use_us_preset)
region = st.sidebar.selectbox("Region", list(COUNTRIES), key="region")
# Options depend on the region.
country = st.sidebar.selectbox("Country", COUNTRIES[region], key="country")
# Options depend on the country, and no key: its generated ID changes with them.
city = st.sidebar.selectbox("City", CITIES[country])

products = st.multiselect("Products", ["A", "B", "C", "D"], default=["A"])
price = st.slider("Price", 0, 100, (10, 90), key="price")
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

with st.form("limits"):
    limit = st.number_input("Row limit", min_value=1, max_value=1000, value=100)
    st.form_submit_button("Apply")

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
}
st.text("VIEW " + json.dumps(view, sort_keys=True))


@st.fragment
def chart_options() -> None:
    chart = st.radio("Chart type", ["bar", "line"], key="chart")
    st.text(f"FRAGMENT {chart}")


chart_options()


@st.dialog("Notes")
def notes() -> None:
    st.text_input("Note", key="note")


if st.button("Open notes"):
    notes()


def _load_preset() -> None:
    # Non-default values for every settable widget type below, written the
    # way the browser receives any value set from code.
    st.session_state.update(
        day=date(2024, 6, 1),
        span=(date(2024, 6, 1), date(2024, 6, 30)),
        at=time(17, 45),
        moment=datetime(2024, 6, 1, 8, 30),
        color="#00ff00",
        compact=True,
        granularity="Week",
        tags=["y", "z"],
        size="L",
        rating=3,
        notes_area="multi\nline </script>",
        ratio=0.25,
        hour=time(14, 0),
        stamp=datetime(2024, 6, 2, 6, 0),
        page_no=3,
    )


st.button("Load preset", on_click=_load_preset)
more = {
    "day": st.date_input("Day", value=date(2024, 5, 1), key="day"),
    "span": st.date_input(
        "Span", value=(date(2024, 5, 1), date(2024, 5, 7)), key="span"
    ),
    "at": st.time_input("At", value=time(9, 0), key="at"),
    "moment": st.datetime_input(
        "Moment", value=datetime(2024, 5, 1, 12, 0), key="moment"
    ),
    "color": st.color_picker("Color", "#ff0000", key="color"),
    "compact": st.toggle("Compact", key="compact"),
    "granularity": st.segmented_control(
        "Granularity", ["Day", "Week", "Month"], default="Day", key="granularity"
    ),
    "tags": st.pills("Tags", ["x", "y", "z"], selection_mode="multi", key="tags"),
    "size": st.select_slider("Size", ["S", "M", "L"], value="M", key="size"),
    "rating": st.feedback("stars", key="rating"),
    "notes_area": st.text_area("Notes", key="notes_area"),
    "ratio": st.number_input("Ratio", 0.0, 1.0, 0.5, key="ratio"),
    "hour": st.slider("Hour", value=time(8, 0), key="hour"),
    "stamp": st.slider(
        "Stamp",
        min_value=datetime(2024, 6, 1),
        max_value=datetime(2024, 6, 30),
        value=datetime(2024, 6, 1, 12, 0),
        key="stamp",
    ),
    "page_no": st.pagination(5, key="page_no"),
}
_, chart_tab = st.tabs(["Table", "Chart"], key="view_tabs", on_change="rerun")
more["chart_tab"] = chart_tab.open
details = st.expander("Details", key="details", on_change="rerun")
details.write("Details body")
more["details"] = details.open
st.text("MORE " + json.dumps(more, default=str, sort_keys=True))
