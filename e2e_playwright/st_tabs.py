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

if "tab_exec_counts" not in st.session_state:
    st.session_state.tab_exec_counts = {"Data": 0, "Charts": 0, "Settings": 0}

dyn_tabs = st.tabs(["Data", "Charts", "Settings"], on_change="rerun")

if dyn_tabs[0].open:
    with dyn_tabs[0]:
        st.session_state.tab_exec_counts["Data"] += 1
        st.write(f"Data tab executed {st.session_state.tab_exec_counts['Data']} times")

if dyn_tabs[1].open:
    with dyn_tabs[1]:
        st.session_state.tab_exec_counts["Charts"] += 1
        st.write(
            f"Charts tab executed {st.session_state.tab_exec_counts['Charts']} times"
        )

if dyn_tabs[2].open:
    with dyn_tabs[2]:
        st.session_state.tab_exec_counts["Settings"] += 1
        st.write(
            f"Settings tab executed {st.session_state.tab_exec_counts['Settings']} times"
        )

st.write(
    f"Tab executions - Data: {st.session_state.tab_exec_counts['Data']}, "
    f"Charts: {st.session_state.tab_exec_counts['Charts']}, "
    f"Settings: {st.session_state.tab_exec_counts['Settings']}"
)


def goto_tab(label: str) -> None:
    st.session_state.prog_tabs = label


col1, col2, col3 = st.columns(3)
with col1:
    st.button("Go to Alpha", on_click=goto_tab, args=("Alpha",), key="goto_alpha")
with col2:
    st.button("Go to Beta", on_click=goto_tab, args=("Beta",), key="goto_beta")
with col3:
    st.button("Go to Gamma", on_click=goto_tab, args=("Gamma",), key="goto_gamma")

prog_tabs = st.tabs(["Alpha", "Beta", "Gamma"], key="prog_tabs", on_change="rerun")

if prog_tabs[0].open:
    with prog_tabs[0]:
        st.write("Alpha tab content")

if prog_tabs[1].open:
    with prog_tabs[1]:
        st.write("Beta tab content")

if prog_tabs[2].open:
    with prog_tabs[2]:
        st.write("Gamma tab content")
# Key-only (no on_change) — should NOT trigger reruns on tab switch
# ============================================================================

if "tabs_key_only_rerun_count" not in st.session_state:
    st.session_state.tabs_key_only_rerun_count = 0
st.session_state.tabs_key_only_rerun_count += 1

key_only_tab1, key_only_tab2 = st.tabs(["KeyTab1", "KeyTab2"], key="key_only_tabs")

with key_only_tab1:
    st.write("Key-only tab 1 content")

with key_only_tab2:
    st.write("Key-only tab 2 content")

st.write(f"Tabs key-only rerun count: {st.session_state.tabs_key_only_rerun_count}")

# ============================================================================
# Fragment Test — dynamic tabs inside a fragment
# ============================================================================

if "frag_tab_exec_counts" not in st.session_state:
    st.session_state.frag_tab_exec_counts = {"Left": 0, "Right": 0}


@st.fragment
def tabs_fragment() -> None:
    frag_tabs = st.tabs(["Left", "Right"], on_change="rerun")
    if frag_tabs[0].open:
        with frag_tabs[0]:
            st.session_state.frag_tab_exec_counts["Left"] += 1
            st.write(
                f"Fragment Left executed {st.session_state.frag_tab_exec_counts['Left']} times"
            )
    if frag_tabs[1].open:
        with frag_tabs[1]:
            st.session_state.frag_tab_exec_counts["Right"] += 1
            st.write(
                f"Fragment Right executed {st.session_state.frag_tab_exec_counts['Right']} times"
            )
    st.write(
        f"Fragment tab execs - Left: {st.session_state.frag_tab_exec_counts['Left']}, "
        f"Right: {st.session_state.frag_tab_exec_counts['Right']}"
    )


tabs_fragment()

# ============================================================================
# Callback Tests (on_change=callable)
# ============================================================================

if "tabs_callback_log" not in st.session_state:
    st.session_state.tabs_callback_log = []


def tabs_callback() -> None:
    st.session_state.tabs_callback_log.append("tabs_callback_called")


def tabs_callback_with_args(prefix: str, suffix: str = "") -> None:
    st.session_state.tabs_cb_args_result = f"{prefix}-switched-{suffix}"


cb_tabs = st.tabs(
    ["CbTab1", "CbTab2"],
    key="callback_tabs",
    on_change=tabs_callback,
)

if cb_tabs[0].open:
    with cb_tabs[0]:
        st.write("Callback tab 1 content")

if cb_tabs[1].open:
    with cb_tabs[1]:
        st.write("Callback tab 2 content")

st.write(f"Tabs callback log: {st.session_state.tabs_callback_log}")

cb_args_tabs = st.tabs(
    ["ArgsTab1", "ArgsTab2"],
    key="callback_args_tabs",
    on_change=tabs_callback_with_args,
    args=("my_prefix",),
    kwargs={"suffix": "my_suffix"},
)

if cb_args_tabs[0].open:
    with cb_args_tabs[0]:
        st.write("Args tab 1 content")

if cb_args_tabs[1].open:
    with cb_args_tabs[1]:
        st.write("Args tab 2 content")

st.write(
    f"Tabs callback args result: "
    f"{st.session_state.get('tabs_cb_args_result', 'Not called')}"
)
