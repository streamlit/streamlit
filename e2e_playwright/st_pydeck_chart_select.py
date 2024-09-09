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

import time
from typing import Literal

import streamlit as st
from shared.pydeck_utils import get_pydeck_chart

if st.button("Create some elements to unmount component"):
    for _ in range(3):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")


selection_mode: Literal["single", "multi"] = st.selectbox(
    "Map Selection Mode",
    ["multi", "single"],
)

event_data = get_pydeck_chart("managed_multiselect_map", selection_mode)

col1, col2 = st.columns(2)

with col1:
    st.write("### Session State")
    st.write(st.session_state)

with col2:
    st.write("### Event Data")
    st.write(event_data)
