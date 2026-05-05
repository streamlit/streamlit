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

# Basic steps container
with st.steps() as steps:
    steps.step("First step", state="complete")
    steps.step("Second step", state="running")
    steps.step("Third step")

# Steps with different states
with st.steps() as state_steps:
    state_steps.step("Completed", state="complete")
    state_steps.step("Running", state="running")
    state_steps.step("Error", state="error")
    state_steps.step("Default")

# Steps with descriptions
with st.steps() as desc_steps:
    desc_steps.step(
        "Load data", description="Loading from database...", state="complete"
    )
    desc_steps.step("Process", description="Analyzing results", state="running")

# Steps with custom icons
with st.steps() as icon_steps:
    icon_steps.step("Star step", icon=":material/star:", state="complete")
    icon_steps.step("Emoji step", icon="🎉")

# Step with content
with st.steps() as content_steps:
    with content_steps.step("Step with markdown", state="complete"):
        st.markdown("This is **markdown** content inside a step.")
    with content_steps.step("Step with code", state="complete"):
        st.code("print('Hello from step!')")

# Steps with height (scrollable)
with st.steps(height=150) as scroll_steps:
    for i in range(5):
        scroll_steps.step(f"Scroll step {i + 1}", state="complete")

# Step update example
with st.steps() as update_steps:
    step = update_steps.step("Original label", state="running")
    step.update(label="Updated label", state="complete")

# Agent thinking simulation - triggered by button
if st.button("Simulate Agent Thinking"):
    import time

    with st.steps() as agent_steps:
        # Step 1: Understanding the query
        with agent_steps.step("Understanding query", state="running") as step1:
            st.write("Analyzing your request...")
            time.sleep(0.5)

        # Step 2: Searching knowledge base
        with agent_steps.step("Searching knowledge base", state="running") as step2:
            for _chunk in st.write_stream(
                iter(["Searching", " for", " relevant", " information", "..."])
            ):
                time.sleep(0.1)

        # Step 3: Generating response
        with agent_steps.step(
            "Generating response",
            description="Synthesizing information",
            state="running",
        ) as step3:
            st.code("result = synthesize(knowledge)")
            time.sleep(0.3)

        # Step 4: Complete
        agent_steps.step("Done!", state="complete", icon=":material/check_circle:")
        st.success("Agent thinking complete!")
