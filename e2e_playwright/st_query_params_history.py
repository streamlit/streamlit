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


def history_page() -> None:
    st.checkbox("Toggle this")
    st.query_params["number"] = 1
    if st.button("Set extra param"):
        st.query_params["extra"] = "yes"
    st.markdown(str(st.query_params))


def query_params_page() -> None:
    number = st.radio(
        "Number",
        options=["3", "5"],
        index=1,
        key="number",
        bind="query-params",
        horizontal=True,
    )
    st.markdown(f"Selected: {number}")

    if st.button("Increment Query Param"):
        value = int(st.query_params.get("value", "0"))
        st.query_params["value"] = value + 1

    st.markdown(f"Query params: {dict(st.query_params)}")


st.navigation(
    [
        st.Page(history_page, title="History", default=True),
        st.Page(query_params_page, title="Query Params", url_path="query-params"),
    ]
).run()
