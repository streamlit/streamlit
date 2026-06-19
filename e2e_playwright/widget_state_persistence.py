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


def _render_value(label: str, key: str) -> None:
    """Always display a widget's current session_state value for assertions."""
    value = st.session_state.get(key, "UNSET")
    with st.container(key=f"{key}_value"):
        st.write(f"{label}: {value}")


def _render_widgets() -> None:
    if st.session_state.get("show"):
        st.text_input("Page-scoped", key="page_text", persist_state="page")
        st.text_input("Session-scoped", key="session_text", persist_state="session")
        st.text_input("Not persisted", key="plain_text")

    _render_value("page_text", "page_text")
    _render_value("session_text", "session_text")
    _render_value("plain_text", "plain_text")


def page_1() -> None:
    st.header("Page 1")
    _render_widgets()


def page_2() -> None:
    st.header("Page 2")
    _render_widgets()


st.sidebar.checkbox("Show widgets", key="show")

pg = st.navigation(
    [
        st.Page(page_1, title="Page 1", url_path="page_1", default=True),
        st.Page(page_2, title="Page 2", url_path="page_2"),
    ]
)
pg.run()
