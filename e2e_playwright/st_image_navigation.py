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

import streamlit as st


def main_page() -> None:
    st.header("Main Page")
    st.image(
        "https://streamlit.io/images/brand/streamlit-logo-secondary-colormark-darktext.png",
        caption="Click to go to Details",
        link="page_details",
    )


def details_page() -> None:
    st.header("Details Page")
    st.write("Success! Internal navigation via st.image worked.")


page_main = st.Page(main_page, title="Home", url_path="page_home")
page_details = st.Page(details_page, title="Details", url_path="page_details")

pg = st.navigation([page_main, page_details])
pg.run()
