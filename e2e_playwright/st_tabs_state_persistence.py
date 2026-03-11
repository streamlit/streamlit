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

# A toggle that controls a conditional element above the tabs.
# Toggling this inserts/removes st.write, shifting the tabs' delta path.
show = st.toggle("Show summary", key="show_toggle")
if show:
    st.write("Here is a summary of the data")

# Keyed tabs — should persist active tab across remounts caused by the toggle
tab1, tab2, tab3 = st.tabs(["Overview", "Details", "Raw Data"], key="my_tabs")
with tab1:
    st.write("Overview content")
with tab2:
    st.write("Details content")
with tab3:
    st.write("Raw Data content")

# Unkeyed tabs — should NOT persist (control group)
utab1, utab2 = st.tabs(["Alpha", "Beta"])
with utab1:
    st.write("Alpha content")
with utab2:
    st.write("Beta content")

# CSS key class verification
st.write("css-check-marker")
