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

"""Test app for help on st.Page: nav tooltips and st.page_link inheritance."""

from typing import Literal

import streamlit as st


def home() -> None:
    st.header("Home page")
    st.page_link(revenue)
    st.page_link(revenue, label="Revenue without tooltip", help="")
    st.page_link(revenue, label="Revenue with local help", help="Opens revenue.")
    st.page_link(archive)


def revenue_page() -> None:
    st.header("Revenue page")


def costs_page() -> None:
    st.header("Costs page")


def archive_page() -> None:
    st.header("Archive page")


position: Literal["sidebar", "top"] = st.radio("Position", ["sidebar", "top"])

home_page = st.Page(home, title="Home", default=True)
revenue = st.Page(
    revenue_page, title="Revenue", help="Net revenue by **region**. Excludes `refunds`."
)
archive = st.Page(
    archive_page, title="Archive", visibility="hidden", help="Closed periods."
)
costs = st.Page(
    costs_page,
    title="Costs",
    help=(
        "Operating costs by team, in EUR, including shared infrastructure, "
        "licenses, and contractors. Allocations follow the monthly cost model. "
        "See [the glossary](#glossary)."
    ),
)
docs = st.Page(
    "https://docs.streamlit.io", title="Docs", help="Opens the Streamlit docs."
)

st.navigation(
    {"": [home_page, revenue, archive], "More": [costs, docs]}, position=position
).run()
