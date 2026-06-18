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

# --- Scenario 1: widget inside a fragment survives a full app rerun ---


@st.fragment
def widget_fragment():
    val = st.slider("Fragment slider", 0, 100, 50, key="frag_slider")
    st.markdown(f"slider value: {val}")


widget_fragment()

st.markdown(f"app uuid: {uuid4()}")
st.button("Trigger full rerun", key="full_rerun_btn")


# --- Scenario 2: st.form inside a normal fragment ---


@st.fragment
def form_fragment():
    with st.form("frag_form"):
        user_input = st.text_input("Name", key="form_name")
        submitted = st.form_submit_button("Submit form")

    if submitted:
        st.markdown(f"submitted: {user_input}")
    else:
        st.markdown("not submitted")


form_fragment()
