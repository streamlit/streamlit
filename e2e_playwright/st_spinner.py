# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import time

import streamlit as st

# A spinner always requires a computation to run for a certain time
# Therefore, we add a button to allow triggering the spinner during the test execution.
if st.button("Run spinner basic"):
    with st.spinner("Loading..."):
        time.sleep(2)

if st.button("Run spinner with time"):
    with st.spinner("Loading...", show_time=True):
        time.sleep(2)

st.header("Spinner - width examples")

if st.button("Run spinner with content width (default)"):
    with st.spinner("Loading with content width...", width="content"):
        time.sleep(2)

if st.button("Run spinner with stretch width"):
    with st.spinner("Loading with stretch width...", width="stretch"):
        time.sleep(2)

if st.button("Run spinner with 300px width"):
    with st.spinner(
        "Loading with 300px width.... the text is long and does not fit in the width",
        width=300,
    ):
        time.sleep(2)
