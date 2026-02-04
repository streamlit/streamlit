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

tab1, tab2, tab3 = st.tabs(["Tab 1", "Tab 2", "Tab 3"])

with tab1:
    st.write("tab1")
    st.text_input("Text input")

with tab2:
    st.write("tab2")
    st.number_input("Number input")

with tab3:
    st.write("tab3")
    st.date_input("Date input")

with st.expander("Expander", expanded=True):
    many_tabs = st.tabs([f"Tab {i}" for i in range(25)])

sidebar_tab1, sidebar_tab2 = st.sidebar.tabs(["Foo", "Bar"])
sidebar_tab1.write("I am in the sidebar")
sidebar_tab2.write("I'm also in the sidebar")

st.tabs(
    [
        "**Bold Text**",
        "*Italicized*",
        "~Strikethough~",
        "`Code Block`",
        "🐶",
        ":joy:",
        ":material/check_circle: Icon",
    ]
)


tabs = st.tabs(["HTML Tab 1", "HTML Tab 2", "HTML Tab 3"])

for i, tab in enumerate(tabs):
    tab.html(f"<h1>Hello</h1><p>This is HTML tab {i + 1}</p>")

fixed_width_tabs = st.tabs(["width_test_1", "width_test_2", "width_test_3"], width=200)

for i, tab in enumerate(fixed_width_tabs):
    tab.write(f"Hello {i}")

# Tabs layout tests.
tab_with_code_1, tab_with_code_2 = st.tabs(["Tab 1", "Tab 2"])

container = tab_with_code_1.container(height=200)
container.code(
    """
def hello():
    print("Hello, Streamlit!")
""",
    height="stretch",
)

tab_with_code_2.code(
    """
def hello():
    print("Hello, Streamlit!")
""",
    height=200,
)

tab_with_code_2.code(
    """
def hello():
    print("Hello, Streamlit!")
""",
    height="stretch",
)

# ============================================================================
# Dynamic Tabs Tests (on_change="rerun")
# ============================================================================

# Test 1: Basic lazy execution
if "tab_a_exec" not in st.session_state:
    st.session_state.tab_a_exec = 0
if "tab_b_exec" not in st.session_state:
    st.session_state.tab_b_exec = 0

tabs_lazy = st.tabs(["Dynamic A", "Dynamic B"], on_change="rerun")

if tabs_lazy[0].open:
    with tabs_lazy[0]:
        st.session_state.tab_a_exec += 1
        st.write(f"Tab A executed {st.session_state.tab_a_exec} times")

if tabs_lazy[1].open:
    with tabs_lazy[1]:
        st.session_state.tab_b_exec += 1
        st.write(f"Tab B executed {st.session_state.tab_b_exec} times")

st.write(
    f"Execution counts - A: {st.session_state.tab_a_exec}, B: {st.session_state.tab_b_exec}"
)

# Test 2: Programmatic control


def goto_tab_1():
    st.session_state.prog_tabs = "Prog Tab 1"


def goto_tab_2():
    st.session_state.prog_tabs = "Prog Tab 2"


col1, col2 = st.columns(2)
with col1:
    st.button("Go to Tab 1", on_click=goto_tab_1, key="goto_tab_1")
with col2:
    st.button("Go to Tab 2", on_click=goto_tab_2, key="goto_tab_2")

tabs_prog = st.tabs(["Prog Tab 1", "Prog Tab 2"], key="prog_tabs", on_change="rerun")

if tabs_prog[0].open:
    with tabs_prog[0]:
        st.write("Programmatic Tab 1 content")

if tabs_prog[1].open:
    with tabs_prog[1]:
        st.write("Programmatic Tab 2 content")

# Test 3: Nested dynamic tabs with execution tracking
if "nested_outer_a_exec" not in st.session_state:
    st.session_state.nested_outer_a_exec = 0
if "nested_outer_b_exec" not in st.session_state:
    st.session_state.nested_outer_b_exec = 0
if "nested_inner_1_exec" not in st.session_state:
    st.session_state.nested_inner_1_exec = 0
if "nested_inner_2_exec" not in st.session_state:
    st.session_state.nested_inner_2_exec = 0


def goto_outer_a():
    st.session_state.outer_tabs = "Outer A"


def goto_outer_b():
    st.session_state.outer_tabs = "Outer B"


def goto_inner_1():
    st.session_state.inner_tabs = "Inner 1"


def goto_inner_2():
    st.session_state.inner_tabs = "Inner 2"


# Buttons for programmatic control of nested tabs
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.button("Go Outer A", on_click=goto_outer_a, key="goto_outer_a")
with col2:
    st.button("Go Outer B", on_click=goto_outer_b, key="goto_outer_b")
with col3:
    st.button("Go Inner 1", on_click=goto_inner_1, key="goto_inner_1")
with col4:
    st.button("Go Inner 2", on_click=goto_inner_2, key="goto_inner_2")

# Wrap in container with key for easier e2e testing
nested_container = st.container(key="nested_tabs_container")
with nested_container:
    tabs_outer = st.tabs(["Outer A", "Outer B"], key="outer_tabs", on_change="rerun")

    if tabs_outer[0].open:
        with tabs_outer[0]:
            st.session_state.nested_outer_a_exec += 1
            st.write(f"Outer A executed {st.session_state.nested_outer_a_exec} times")

            tabs_inner = st.tabs(
                ["Inner 1", "Inner 2"], key="inner_tabs", on_change="rerun"
            )

            if tabs_inner[0].open:
                with tabs_inner[0]:
                    st.session_state.nested_inner_1_exec += 1
                    st.write(
                        f"Inner 1 executed {st.session_state.nested_inner_1_exec} times"
                    )

            if tabs_inner[1].open:
                with tabs_inner[1]:
                    st.session_state.nested_inner_2_exec += 1
                    st.write(
                        f"Inner 2 executed {st.session_state.nested_inner_2_exec} times"
                    )

    if tabs_outer[1].open:
        with tabs_outer[1]:
            st.session_state.nested_outer_b_exec += 1
            st.write(f"Outer B executed {st.session_state.nested_outer_b_exec} times")

    st.write(
        f"Nested execution - Outer A: {st.session_state.nested_outer_a_exec}, "
        f"Outer B: {st.session_state.nested_outer_b_exec}, "
        f"Inner 1: {st.session_state.nested_inner_1_exec}, "
        f"Inner 2: {st.session_state.nested_inner_2_exec}"
    )
