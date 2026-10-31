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

"""Timeline steps: `type="step"` for both st.expander and st.status.

Both commands render through the same block proto and frontend component, so
they share one app. Each scenario is wrapped in a keyed container so tests can
target it without index-based locators.
"""

import streamlit as st
from streamlit.runtime.scriptrunner import get_script_run_ctx

ctx = get_script_run_ctx()
if ctx is None:
    import sys

    # This script is not compatible with running it in "bare" mode (e.g.
    # `python script.py`), for the same reason as st_status.py: without the
    # runtime, st.status does not return a mutable container, so .update() is
    # unavailable. The keyed step also has no session state to read back.
    print("This test script does not support bare script execution.")
    sys.exit(0)


with st.container(key="steps_basic"):
    with st.expander("Understanding the question", type="step", expanded=True):
        st.write("Parsed the request")

    with st.expander("Searching for information", type="step"):
        st.write("Collapsed step content")

    # A step without content ends the timeline and is not collapsible.
    st.expander("Generating response", type="step")

with st.container(key="steps_status"):
    running = st.status("Loading data", type="step", state="running")
    running.write("Streaming rows")

    with st.status("Fetching results", type="step", state="running"):
        st.write("Fetched 10 rows")

    updated = st.status("Update target", type="step", state="running")
    updated.write("Update content")
    updated.update(state="error")

with st.container(key="steps_broken_chain"):
    with st.expander("First chain step", type="step", expanded=True):
        st.write("First chain content")

    st.write("Interleaved element")

    with st.expander("Second chain step", type="step", expanded=True):
        st.write("Second chain content")

with st.container(key="steps_empty_between"):
    with st.expander("Segment one step", type="step", expanded=True):
        st.write("Segment one content")

    # An empty step in the middle splits the timeline into two segments.
    st.expander("Segment divider", type="step")

    with st.expander("Segment two step", type="step", expanded=True):
        st.write("Segment two content")

with st.container(key="steps_custom_gap"):
    with st.container(gap="medium"):
        with st.expander("Wide gap step 1", type="step"):
            st.write("Wide gap content 1")

        with st.expander("Wide gap step 2", type="step"):
            st.write("Wide gap content 2")

with st.container(key="steps_scrollable"):
    with st.container(height=200):
        for index in range(6):
            with st.status(f"Scrolled event {index}", type="step", state="complete"):
                st.write(f"Event {index} details")

with st.container(key="steps_params"):
    with st.expander(
        "Step with icon", type="step", icon=":material/bolt:", expanded=True
    ):
        st.write("Icon step content")

    with st.expander("Narrow step", type="step", width=300):
        st.write("Narrow step content")

    with st.expander("Regular expander"):
        st.write("Regular content")

with st.container(key="steps_widget"):
    with st.expander("Keyed step", type="step", key="keyed_step", on_change="rerun"):
        st.write("Keyed step content")

    st.write(f"Keyed step expanded: {st.session_state.keyed_step}")
    st.button("Rerun")
