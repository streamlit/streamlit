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

st.title("Expander Widget State Test")

# Initialize state
if "expander_1" not in st.session_state:
    st.session_state["expander_1"] = True

# Button to toggle state (must be BEFORE expander creation)
if st.button("Toggle Expander"):
    st.session_state["expander_1"] = not st.session_state["expander_1"]

# Create expander - it will use the state from session_state
exp = st.expander("Expand me", expanded=True, key="expander_1")
with exp:
    st.write("This is the expander content")
    st.write(f"Current state in session_state: {st.session_state['expander_1']}")

# Show current state outside expander
st.write(f"The Expander is {'open' if st.session_state['expander_1'] else 'closed'}")

# Show rerun counter
if "counter" not in st.session_state:
    st.session_state.counter = 0

st.session_state.counter += 1
st.write(f"Script has run {st.session_state.counter} times")
