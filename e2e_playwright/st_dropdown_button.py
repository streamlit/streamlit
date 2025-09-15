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
from streamlit import runtime

# st.session_state can only be used in streamlit
if runtime.exists():

    def on_click() -> None:
        if "dropdown_clicks" not in st.session_state:
            st.session_state.dropdown_clicks = 0

        st.session_state.dropdown_clicks += 1
        # Get the selected option from the widget's current value
        if "callback_dropdown" in st.session_state:
            st.session_state.selected_option = st.session_state.callback_dropdown

    # Basic dropdown button
    v1 = st.dropdown_button(
        "Actions", options=["Save", "Load", "Delete"], key="basic_dropdown"
    )
    st.write("value 1:", v1)

    # Dropdown button with callback
    v2 = st.dropdown_button(
        "File Operations",
        options=["Open", "Save", "Export"],
        on_click=on_click,
        key="callback_dropdown",
    )
    st.write("value 2:", v2)

    # Show callback results
    if "dropdown_clicks" in st.session_state:
        st.write("Dropdown was clicked:", st.session_state.dropdown_clicks, "times")
        if "selected_option" in st.session_state:
            st.write("Last selected option:", st.session_state.selected_option)

    # Different button types
    v3 = st.dropdown_button(
        "Primary Actions",
        options=["Create", "Update", "Remove"],
        type="primary",
        key="primary_dropdown",
    )
    st.write("value 3:", v3)

    v4 = st.dropdown_button(
        "Secondary Actions",
        options=["View", "Edit", "Copy"],
        type="secondary",
        key="secondary_dropdown",
    )
    st.write("value 4:", v4)

    v5 = st.dropdown_button(
        "Tertiary Actions",
        options=["Info", "Help", "About"],
        type="tertiary",
        key="tertiary_dropdown",
    )
    st.write("value 5:", v5)

    # Disabled dropdown button
    v6 = st.dropdown_button(
        "Disabled Actions",
        options=["Option 1", "Option 2"],
        disabled=True,
        key="disabled_dropdown",
    )
    st.write("value 6:", v6)

    # Dropdown with icon
    v7 = st.dropdown_button(
        "Settings",
        options=["Profile", "Preferences", "Logout"],
        icon="⚙️",
        key="icon_dropdown",
    )
    st.write("value 7:", v7)

    # Dropdown with material icon
    v8 = st.dropdown_button(
        "Tools",
        options=["Calculator", "Calendar", "Timer"],
        icon=":material/build:",
        key="material_icon_dropdown",
    )
    st.write("value 8:", v8)

    # Container width dropdown
    v9 = st.dropdown_button(
        "Full Width Actions",
        options=["Option A", "Option B", "Option C"],
        use_container_width=True,
        key="container_width_dropdown",
    )
    st.write("value 9:", v9)

    # Dropdown with help text
    v10 = st.dropdown_button(
        "Help Actions",
        options=["Tutorial", "Documentation", "Support"],
        help="Choose an action to get help",
        key="help_dropdown",
    )
    st.write("value 10:", v10)

    # Dropdown with custom placeholder
    v11 = st.dropdown_button(
        "Custom Placeholder",
        options=["Red", "Green", "Blue"],
        placeholder="Pick a color",
        key="placeholder_dropdown",
    )
    st.write("value 11:", v11)

    # Empty options dropdown
    v12 = st.dropdown_button("Empty Options", options=[], key="empty_dropdown")
    st.write("value 12:", v12)

    # Long options list
    long_options = [f"Option {i}" for i in range(1, 21)]
    v13 = st.dropdown_button(
        "Many Options", options=long_options, key="long_options_dropdown"
    )
    st.write("value 13:", v13)

    # Dropdown with very long option names
    v14 = st.dropdown_button(
        "Long Option Names",
        options=[
            "This is a very long option name that should test text wrapping",
            "Another extremely long option to test how the dropdown handles overflow",
            "Short option",
        ],
        key="long_names_dropdown",
    )
    st.write("value 14:", v14)

# Test dropdown button state persistence
reset_checkbox = st.checkbox("Reset dropdown values")


# Fragment test
@st.fragment
def fragment_dropdown():
    v15 = st.dropdown_button(
        "Fragment Actions",
        options=["Fragment Option 1", "Fragment Option 2"],
        key="fragment_dropdown",
    )
    st.write("Fragment value:", v15)


fragment_dropdown()
