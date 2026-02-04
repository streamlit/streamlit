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

st.title("Dynamic Containers Test")

# Track reruns to verify rerun happens on toggle/switch
if "counter" not in st.session_state:
    st.session_state.counter = 0
st.session_state.counter += 1

# ============================================================================
# Expander Tests
# ============================================================================

st.header("Expander with on_change='rerun'")

with st.echo():
    # Create expander with on_change="rerun" to enable state tracking
    exp_rerun = st.expander("Rerun expander", expanded=False, on_change="rerun")

    # Use .open to decide whether to render content
    if exp_rerun.open:
        with exp_rerun:
            st.write("Rerun expander content is visible")

    # Display the current state using .open
    st.write(f"exp_rerun.open = {exp_rerun.open}")

st.divider()

st.header("Expander with on_change='ignore'")

with st.echo():
    # Create expander with on_change="ignore" (default) - no state tracking
    exp_ignore = st.expander("Ignore expander", expanded=False, on_change="ignore")

    with exp_ignore:
        st.write("Ignore expander content (always rendered)")

    # .open returns None when on_change="ignore"
    st.write(f"exp_ignore.open = {exp_ignore.open}")

st.divider()

# ============================================================================
# Tabs Tests
# ============================================================================

st.header("Tabs with on_change='rerun'")

with st.echo():
    # Create tabs with on_change="rerun" to enable state tracking
    tabs_rerun = st.tabs(["Tab A", "Tab B", "Tab C"], on_change="rerun")

    # Only execute content for the active tab
    if tabs_rerun[0].open:
        with tabs_rerun[0]:
            st.write("Tab A content is visible")

    if tabs_rerun[1].open:
        with tabs_rerun[1]:
            st.write("Tab B content is visible")

    if tabs_rerun[2].open:
        with tabs_rerun[2]:
            st.write("Tab C content is visible")

    # Display the current state using .open
    st.write(f"tabs_rerun[0].open = {tabs_rerun[0].open}")
    st.write(f"tabs_rerun[1].open = {tabs_rerun[1].open}")
    st.write(f"tabs_rerun[2].open = {tabs_rerun[2].open}")

st.divider()

st.header("Tabs with on_change=None (default)")

with st.echo():
    # Create tabs without on_change - no state tracking
    tabs_default = st.tabs(["Tab X", "Tab Y"])

    with tabs_default[0]:
        st.write("Tab X content (always rendered)")

    with tabs_default[1]:
        st.write("Tab Y content (always rendered)")

    # .open returns None when on_change is not set
    st.write(f"tabs_default[0].open = {tabs_default[0].open}")
    st.write(f"tabs_default[1].open = {tabs_default[1].open}")

st.divider()

# ============================================================================
# Programmatic Control Tests
# ============================================================================

st.header("Programmatic Tab Control")

with st.echo():
    # Simple callbacks to set tab state
    def goto_step_1():
        st.session_state.wizard_tabs = "Step 1"

    def goto_step_2():
        st.session_state.wizard_tabs = "Step 2"

    def goto_step_3():
        st.session_state.wizard_tabs = "Step 3"

    # Buttons BEFORE tabs - callbacks run before tabs are registered
    st.write("Navigate programmatically:")
    col1, col2, col3 = st.columns(3)
    with col1:
        st.button("Go to Step 1", on_click=goto_step_1)
    with col2:
        st.button("Go to Step 2", on_click=goto_step_2)
    with col3:
        st.button("Go to Step 3", on_click=goto_step_3)

    # Create tabs AFTER buttons
    tabs_prog = st.tabs(
        ["Step 1", "Step 2", "Step 3"], key="wizard_tabs", on_change="rerun"
    )

    # Render content for active tab
    if tabs_prog[0].open:
        with tabs_prog[0]:
            st.write("Step 1 content")

    if tabs_prog[1].open:
        with tabs_prog[1]:
            st.write("Step 2 content")

    if tabs_prog[2].open:
        with tabs_prog[2]:
            st.write("Step 3 content")

    # Show current tab
    st.write(f"Current tab: {st.session_state.get('wizard_tabs', 'Step 1')}")

st.divider()

st.header("Programmatic Expander Control")

with st.echo():
    # Simple callbacks to set expander state
    def open_expander():
        st.session_state.my_expander = True

    def close_expander():
        st.session_state.my_expander = False

    # Buttons BEFORE expander - callbacks run before expander is registered
    st.write("Control expander programmatically:")
    col1, col2 = st.columns(2)
    with col1:
        st.button("Open Expander", on_click=open_expander)
    with col2:
        st.button("Close Expander", on_click=close_expander)

    # Create expander AFTER buttons
    exp_prog = st.expander(
        "Programmatic expander", key="my_expander", on_change="rerun"
    )

    # Render content only if open
    if exp_prog.open:
        with exp_prog:
            st.write("Programmatically controlled content")
            st.info("This expander can be opened/closed via buttons above")

    # Show current state
    st.write(f"exp_prog.open = {exp_prog.open}")
    st.write(f"Session state value: {st.session_state.get('my_expander', False)}")

st.divider()

st.write(f"Script has run {st.session_state.counter} times")
