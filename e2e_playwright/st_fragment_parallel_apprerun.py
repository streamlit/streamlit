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

"""App script for E14: st.rerun(scope='app') cancels all and restarts.

Isolated because app-scoped rerun cancels the coordinator and restarts
the script, which would interfere with other scenarios in the same app.
"""

import streamlit as st

st.subheader("E14: App-scoped rerun")

if "e14_app_runs" not in st.session_state:
    st.session_state.e14_app_runs = 0
st.session_state.e14_app_runs += 1


@st.fragment(parallel=True)
def rerun_app_fragment():
    if st.session_state.e14_app_runs == 1:
        st.rerun(scope="app")
    st.write("e14_restarted")


@st.fragment(parallel=True)
def other_fragment():
    st.write(f"e14_b_loaded_run_{st.session_state.e14_app_runs}")


rerun_app_fragment()
other_fragment()
st.write(f"e14_app_runs: {st.session_state.e14_app_runs}")
