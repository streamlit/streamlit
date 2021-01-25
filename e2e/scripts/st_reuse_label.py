# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import streamlit as st

if st.button("Rerun test"):
    st.test_run_count = -1

if hasattr(st, "test_run_count"):
    st.test_run_count += 1
else:
    st.test_run_count = 0 if st.get_option("server.headless") else -1

if st.test_run_count < 1:
    w1 = st.slider("label", 0, 100, 25, 1)
else:
    w1 = st.selectbox("label", ("m", "f"), 1)

st.write("value 1:", w1)
st.write("test_run_count:", st.test_run_count)
st.write(
    """
    If this is failing locally, it could be because you have a browser with
    Streamlit open. Close it and the test should pass.
"""
)
# TODO: Use session-specific state for test_run_count, to fix the issue above.
