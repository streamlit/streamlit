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

import pandas as pd

import streamlit as st
from streamlit import runtime

options = ("male", "female")
v1 = st.selectbox("selectbox 1 (default)", options)
st.write("value 1:", v1)

v2 = st.selectbox(
    "selectbox 2 (formatted options)", options, 1, format_func=lambda x: x.capitalize()
)
st.write("value 2:", v2)

v3 = st.selectbox("selectbox 3 (no options)", [])
st.write("value 3:", v3)

more_options = [
    "e2e/scripts/components_iframe.py",
    "e2e/scripts/st_warning.py",
    "This is a very very very long option label that should be truncated when it is showing in the dropdown menu.",
    "e2e/scripts/st_container.py",
    "e2e/scripts/st_dataframe_sort_column.py",
    "e2e/scripts/app_hotkeys.py",
    "e2e/scripts/st_info.py",
    "e2e/scripts/st_echo.py",
    "e2e/scripts/st_json.py",
    "e2e/scripts/st_query_params.py",
    "e2e/scripts/st_markdown.py",
    "e2e/scripts/st_color_picker.py",
    "e2e/scripts/st_expander.py",
]
v4 = st.selectbox("selectbox 4 (more options)", more_options, 0)
st.write("value 4:", v4)

v5 = st.selectbox("selectbox 5 (disabled)", options, disabled=True)
st.write("value 5:", v5)

v6 = st.selectbox("selectbox 6 (hidden label)", options, label_visibility="hidden")
st.write("value 6:", v6)

v7 = st.selectbox(
    "selectbox 7 (collapsed label)", options, label_visibility="collapsed"
)
st.write("value 7:", v7)

if runtime.exists():

    def on_change(x: int, y: int, z: int):
        st.session_state.selectbox_changed = True
        st.text(f"Selectbox widget callback triggered: x={x}, y={y}, z={z}")

    st.selectbox(
        "selectbox 8 (with callback, help)",
        options,
        1,
        key="selectbox8",
        on_change=on_change,
        args=[1, 2],
        kwargs={"z": 3},
        help="Help text",
    )
    st.write("value 8:", st.session_state.selectbox8)
    st.write("selectbox changed:", st.session_state.get("selectbox_changed") is True)
    # Reset to False:
    st.session_state.selectbox_changed = False

v9 = st.selectbox("selectbox 9 (empty selection)", options, index=None)
st.write("value 9:", v9)

v10 = st.selectbox(
    "selectbox 10 (empty, custom placeholder)",
    options,
    index=None,
    placeholder="Select one of the options...",
)
st.write("value 10:", v10)

v11: str = st.selectbox(
    "selectbox 11 (options from dataframe)", pd.DataFrame({"foo": list(options)})
)
st.write("value 11:", v11)

if "selectbox_12" not in st.session_state:
    st.session_state["selectbox_12"] = "female"

v12 = st.selectbox(
    "selectbox 12 (empty, value from state)", options, index=None, key="selectbox_12"
)
st.write("value 12:", v12)

st.selectbox(
    "selectbox 13 -> :material/check: :rainbow[Fancy] _**markdown** `label` _support_",
    options=options,
)

v14 = st.selectbox(
    "selectbox 14 (test dismiss behavior)", options, index=0, key="selectbox_esc_test"
)
st.write("value 14:", v14)

# Add a new selectbox with accept_new_options=True
v15 = st.selectbox(
    "selectbox 15 (accept new options)",
    options,
    index=0,
    key="selectbox_15",
    accept_new_options=True,
)
st.write("value 15:", v15)
if "selectbox_15" in st.session_state:
    st.write("value 15 (session_state):", st.session_state.selectbox_15)

# Add a selectbox with session_state pre-set value
if "selectbox16" not in st.session_state:
    st.session_state.selectbox16 = "female"

v16 = st.selectbox(
    "selectbox 16 - session_state values",
    options,
    key="selectbox16",
)
st.write("value 16:", v16)

# Add a selectbox with empty options but accept_new_options=True
v17 = st.selectbox(
    "selectbox 17 - empty options with accept_new_options",
    options=[],
    accept_new_options=True,
)
st.write("value 17:", v17)

st.selectbox("selectbox 18 (width=200px)", options, index=0, width=200)
st.selectbox("selectbox 19 (width='stretch')", options, index=0, width="stretch")

if st.toggle("Update selectbox props"):
    sel_value = st.selectbox(
        "Updated dynamic selectbox",
        index=1,  # default is "papaya"
        width=200,
        help="updated help",
        key="dynamic_selectbox_with_key",
        on_change=lambda a, param: print(
            f"Updated selectbox - callback triggered: {a} {param}"
        ),
        args=("Updated select arg",),
        kwargs={"param": "updated kwarg param"},
        placeholder="updated placeholder",
        # "mango" exists in both lists at different indices for testing preservation
        # mango is at index 0 here, but default is index 1 (papaya)
        options=["mango", "papaya", "grape", "apple"],
        format_func=lambda x: x.upper(),
        # Whitelisted kwargs (keep stable):
        accept_new_options=False,
    )
    st.write("Updated selectbox value:", sel_value)
else:
    sel_value = st.selectbox(
        "Initial dynamic selectbox",
        index=0,  # default is "apple"
        width="stretch",
        help="initial help",
        key="dynamic_selectbox_with_key",
        on_change=lambda a, param: print(
            f"Initial selectbox - callback triggered: {a} {param}"
        ),
        args=("Initial select arg",),
        kwargs={"param": "initial kwarg param"},
        placeholder="initial placeholder",
        # "mango" exists in both lists at different indices for testing preservation
        # mango is at index 2 here, default is index 0 (apple)
        options=["apple", "banana", "mango", "orange"],
        format_func=lambda x: x.capitalize(),
        # Whitelisted kwargs (keep stable):
        accept_new_options=False,
    )
    st.write("Initial selectbox value:", sel_value)

# Regression test for https://github.com/streamlit/streamlit/issues/13435
# Test that selectbox UI stays in sync when value is set via session_state
# and user opens/closes dropdown without selecting
with st.container(horizontal=True):
    for value in ("male", "female"):
        if st.button(f"Set {value}", key=f"set_{value}_btn"):
            st.session_state["selectbox20"] = value
v20 = st.selectbox(
    "selectbox 20 - session_state sync test",
    options,
    index=0,
    key="selectbox20",
)
st.write("value 20:", v20)

v21 = st.selectbox(
    "selectbox 21 (filter_mode='prefix')",
    ["A123", "A1234", "BA123", "CA123"],
    index=None,
    filter_mode="prefix",
)
st.write("value 21:", v21)

v22 = st.selectbox(
    "selectbox 22 (filter_mode='contains')",
    ["alice@example.com", "bob@company.com", "carol@example.com"],
    index=None,
    filter_mode="contains",
)
st.write("value 22:", v22)

v23 = st.selectbox(
    "selectbox 23 (filter_mode=None)",
    ["Yes", "No", "Maybe"],
    index=None,
    filter_mode=None,
)
st.write("value 23:", v23)

# --- Bound widgets (query-params) ---

v_bound = st.selectbox(
    "Bound selectbox",
    ["cat", "dog", "bird"],
    key="bound_select",
    bind="query-params",
)
st.write("bound select value:", v_bound)

v_bound_clear = st.selectbox(
    "Bound clearable",
    ["red", "green", "blue"],
    index=None,
    key="bound_select_clear",
    bind="query-params",
)
st.write("bound select clear value:", v_bound_clear)
