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

st.title("Skills nudge e2e")
st.write("App used to e2e-test the install-skills nudge toast.")

# Lets the test fire a regular st.toast on demand, to verify it coexists with
# (and does not displace) the persistent install-skills nudge.
if st.button("Show toast"):
    st.toast("App toast message")
