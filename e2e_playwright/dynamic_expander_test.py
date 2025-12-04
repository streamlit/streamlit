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

import streamlit as st

st.title("Dynamic Expander Test")

# Track reruns to verify rerun happens on toggle
if "counter" not in st.session_state:
    st.session_state.counter = 0
st.session_state.counter += 1

st.header("on_change='rerun'")

# Create expander with on_change="rerun" to enable state tracking
exp_rerun = st.expander("Rerun expander", expanded=False, on_change="rerun")

# Use .open to decide whether to render content
if exp_rerun.open:
    with exp_rerun:
        st.write("Rerun expander content is visible")

# Display the current state using .open
st.write(f"exp_rerun.open = {exp_rerun.open}")

st.divider()

st.header("on_change='ignore'")

# Create expander with on_change="ignore" (default) - no state tracking
exp_ignore = st.expander("Ignore expander", expanded=False, on_change="ignore")

with exp_ignore:
    st.write("Ignore expander content (always rendered)")

# .open returns None when on_change="ignore"
st.write(f"exp_ignore.open = {exp_ignore.open}")

st.divider()

st.write(f"Script has run {st.session_state.counter} times")
