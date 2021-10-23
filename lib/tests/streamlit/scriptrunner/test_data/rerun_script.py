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

"""A script for ScriptRunnerTest that uses st.experimental_rerun"""

import streamlit as st

state = st.session_state

if "run_count" not in state:
    state.run_count = 1
else:
    state.run_count += 1

st.text(f"run count: {state.run_count}")

if st.button("rerun me!"):
    st.experimental_rerun()


t = st.checkbox("toggle me!")
st.text(f"you picked: {t}")
