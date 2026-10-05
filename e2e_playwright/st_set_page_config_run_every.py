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


def live_page() -> None:
    auto = st.toggle("Auto-refresh", value=True)
    # The last call that passes run_every wins. None disables the timer.
    st.set_page_config(run_every=1 if auto else None)

    if "ticks" not in st.session_state:
        st.session_state.ticks = 0
    st.session_state.ticks += 1

    with st.container(key="tick_count"):
        st.markdown(f"ticks-{st.session_state.ticks}")

    @st.dialog("Notes")
    def notes() -> None:
        st.write("Dialog is open")

    if st.button("Open dialog"):
        notes()

    with st.form("details"):
        st.text_input("Name")
        st.form_submit_button("Save")


def quiet_page() -> None:
    with st.container(key="quiet_ticks"):
        st.markdown(f"ticks-{st.session_state.get('ticks', 0)}")
    st.markdown("quiet-page")


page = st.navigation(
    [
        st.Page(live_page, title="Live", default=True),
        st.Page(quiet_page, title="Quiet"),
    ]
)
page.run()
