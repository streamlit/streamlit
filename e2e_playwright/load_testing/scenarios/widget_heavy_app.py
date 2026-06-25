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

"""Widget-heavy app for load testing.

Tests widget state management under load with 90+ widgets.
"""

import streamlit as st

st.title("Load Test - Widget Heavy")

cols = st.columns(3)
for i in range(30):
    with cols[i % 3]:
        st.text_input(f"Input {i}", key=f"input_{i}")
        st.slider(f"Slider {i}", 0, 100, key=f"slider_{i}")
        st.checkbox(f"Check {i}", key=f"check_{i}")
