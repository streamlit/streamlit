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

"""Fragment app for load testing.

Tests fragment partial rerun performance (fragment-only vs full reruns).
"""

import streamlit as st

st.title("Load Test - Fragments")


@st.fragment
def counter_fragment():
    if "count" not in st.session_state:
        st.session_state.count = 0
    if st.button("Increment", key="frag_btn"):
        st.session_state.count += 1
    st.write(f"Count: {st.session_state.count}")


counter_fragment()

# Heavy content outside fragment (should NOT rerun on fragment interaction)
with st.expander("Heavy content"):
    for i in range(20):
        st.markdown(f"**Item {i}**: " + "x" * 500)

st.button("Full rerun")
