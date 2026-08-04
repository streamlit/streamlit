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

LONG = "Regenerate the complete quarterly report now"

# A row of three buttons where the middle label is too long for its column.
# With wrap=False the middle button stays the same height as its neighbors and
# its label ellipsizes.
with st.container(key="wrap_false_row"):
    left, middle, right = st.columns(3)
    left.button("Edit", width="stretch", wrap=False, key="wf_left")
    middle.button(LONG, width="stretch", wrap=False, key="wf_middle")
    right.button("Export", width="stretch", wrap=False, key="wf_right")

# The same row with the default wrap=True: the middle button wraps and grows.
with st.container(key="wrap_true_row"):
    left, middle, right = st.columns(3)
    left.button("Edit", width="stretch", key="wt_left")
    middle.button(LONG, width="stretch", key="wt_middle")
    right.button("Export", width="stretch", key="wt_right")

# wrap=False keeps icons and shortcuts visible next to the ellipsized label.
with st.container(key="wrap_false_icon_shortcut"):
    _, mid, _ = st.columns(3)
    mid.button(
        LONG,
        icon=":material/mood:",
        shortcut="Ctrl+J",
        width="stretch",
        wrap=False,
        key="wf_icon_shortcut",
    )

# help takes precedence over the truncation tooltip.
with st.container(key="wrap_false_help"):
    _, mid, _ = st.columns(3)
    mid.button(
        LONG, width="stretch", wrap=False, help="Custom help text", key="wf_help"
    )

# Other button-like controls with wrap=False in narrow columns.
with st.container(key="wrap_false_others"):
    c1, c2, c3, c4 = st.columns(4)
    c1.download_button(
        LONG, data="data", width="stretch", wrap=False, key="wf_download"
    )
    c2.link_button(
        LONG, "https://streamlit.io", width="stretch", wrap=False, key="wf_link"
    )
    with c3.popover(LONG, width="stretch", wrap=False, key="wf_popover"):
        st.write("popover content")
    c4.menu_button(LONG, ["CSV", "JSON"], width="stretch", wrap=False, key="wf_menu")

# form_submit_button with wrap=False.
with st.form("wrap_form"):
    st.text_input("Name")
    fc1, fc2, fc3 = st.columns(3)
    fc1.form_submit_button("OK", width="stretch")
    fc2.form_submit_button(LONG, width="stretch", wrap=False)
    fc3.form_submit_button("Cancel", width="stretch")
