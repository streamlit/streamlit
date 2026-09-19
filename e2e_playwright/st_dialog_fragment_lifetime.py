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


@st.dialog("Periodic fragment dialog", dismissible=False)
def show_dialog() -> None:
    if st.button("Increment"):
        st.session_state.dialog_clicks = st.session_state.get("dialog_clicks", 0) + 1

    st.write(f"Clicks: {st.session_state.get('dialog_clicks', 0)}")

    if st.button("Close dialog"):
        st.rerun()


@st.fragment(run_every=1)
def parent_fragment() -> None:
    st.session_state.parent_runs = st.session_state.get("parent_runs", 0) + 1
    st.write(f"Parent runs: {st.session_state.parent_runs}")

    if st.button("Open dialog"):
        show_dialog()


parent_fragment()
