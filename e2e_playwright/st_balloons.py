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

# --- Button-triggered balloons (element hash memo regression test) ---
if "balloons_count" not in st.session_state:
    st.session_state.balloons_count = 0
    # Initial balloons on first load
    st.balloons()

if st.button("Show more balloons"):
    st.session_state.balloons_count += 1
    st.balloons()
    st.write(f"Balloons shown: {st.session_state.balloons_count}")
