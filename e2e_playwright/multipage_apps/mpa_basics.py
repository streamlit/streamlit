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

from pathlib import Path

import streamlit as st

st.header("Main Page")
st.slider("x")

bound_cb = st.checkbox("Bound checkbox", key="bound_cb", bind="query-params")
st.write("bound_cb:", bound_cb)

st.write("Query Params:", st.query_params)

if st.button("`pages/02_page2.py`"):
    st.switch_page("pages/02_page2.py")

if st.button("`pages/08_slow_page.py`"):
    st.switch_page(Path("pages/08_slow_page.py"))


def switch_to_page_2() -> None:
    st.switch_page("pages/02_page2.py")


# Keep this last: tests in mpa_basics_test.py select the buttons above by position. The
# label avoids repeating a path used above, since the e2e helper matches by substring.
st.button("callback nav to page 2", on_click=switch_to_page_2)
