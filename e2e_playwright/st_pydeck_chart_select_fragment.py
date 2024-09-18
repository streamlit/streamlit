# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
from __future__ import annotations

import streamlit as st
from shared.pydeck_utils import get_pydeck_chart

# SELECTIONS IN FRAGMENT
st.header("Selections in fragment:")


@st.fragment
def test_fragment():
    selection = get_pydeck_chart("selection_in_fragment", "single")
    st.write("PyDeck-in-fragment selection:", str(selection))


test_fragment()


if "runs" not in st.session_state:
    st.session_state.runs = 0
st.session_state.runs += 1
st.write("Runs:", st.session_state.runs)
