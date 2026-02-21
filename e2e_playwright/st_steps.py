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
from streamlit.runtime.scriptrunner import get_script_run_ctx

ctx = get_script_run_ctx()
if ctx is None:
    import sys

    # This script is not compatible with running it in "bare" mode (e.g. `python script.py`)
    # The reason is that the mutable container is not correctly returned if
    # the runtime doesn't exist.
    print("This test script does not support bare script execution.")
    sys.exit(0)

# Basic steps container without label
with st.steps() as steps:
    steps.step("Step without label", state="complete")

# Steps container with label
with st.steps("My Pipeline") as pipeline:
    pipeline.step("First step", state="complete")
    pipeline.step("Second step", state="running")
    pipeline.step("Third step")

# Steps with different states
with st.steps("State Examples") as state_steps:
    state_steps.step("Completed", state="complete")
    state_steps.step("Running", state="running")
    state_steps.step("Error", state="error")
    state_steps.step("Default")

# Steps with descriptions
with st.steps("Steps with Descriptions") as desc_steps:
    desc_steps.step(
        "Load data", description="Loading from database...", state="complete"
    )
    desc_steps.step("Process", description="Analyzing results", state="running")

# Steps with custom icons
with st.steps("Custom Icons") as icon_steps:
    icon_steps.step("Star step", icon=":material/star:", state="complete")
    icon_steps.step("Emoji step", icon="🎉")

# Step with content
with st.steps("Steps with Content") as content_steps:
    with content_steps.step("Step with markdown", state="complete"):
        st.markdown("This is **markdown** content inside a step.")
    with content_steps.step("Step with code", state="complete"):
        st.code("print('Hello from step!')")

# Collapsed steps container
st.steps("Collapsed Container", expanded=False)

# Steps with height (scrollable)
with st.steps("Scrollable Steps", height=150) as scroll_steps:
    for i in range(5):
        scroll_steps.step(f"Scroll step {i + 1}", state="complete")

# Step update example
with st.steps("Update Example") as update_steps:
    step = update_steps.step("Original label", state="running")
    step.update(label="Updated label", state="complete")
