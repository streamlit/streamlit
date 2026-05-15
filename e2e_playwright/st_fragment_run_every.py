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

from uuid import uuid4

import streamlit as st


@st.fragment(run_every=1.0)
def my_auto_updating_fragment():
    with st.container(key="standalone_auto_fragment"):
        st.write(f"uuid in fragment: {uuid4()}")


my_auto_updating_fragment()


# Regression for https://github.com/streamlit/streamlit/issues/15084: nested
# ``run_every`` under an outer fragment must not crash when the outer fragment
# stops rendering the inner chain (stale auto-rerun + invalid delta path).
@st.fragment
def outer_nested_demo():
    show_nested = st.checkbox(
        "Show nested auto fragment",
        value=True,
        key="show_nested_auto_fragment",
    )
    if show_nested:

        @st.fragment
        def middle():
            @st.fragment(run_every=1.0)
            def nested_auto():
                with st.container(key="nested_auto_fragment"):
                    st.write(f"nested uuid: {uuid4()}")

            nested_auto()

        middle()


outer_nested_demo()
