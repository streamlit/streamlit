# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
i1 = st.selectbox("selectbox 1 (default)", options)
st.write("value 1:", i1)

i2 = st.selectbox(
    "selectbox 2 (formatted options)", options, 1, format_func=lambda x: x.capitalize()
)
st.write("value 2:", i2)

i3 = st.selectbox("selectbox 3 (no options)", [])
st.write("value 3:", i3)

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
    "e2e/scripts/st_experimental_get_query_params.py",
    "e2e/scripts/st_markdown.py",
    "e2e/scripts/st_color_picker.py",
    "e2e/scripts/st_expander.py",
]
i4 = st.selectbox("selectbox 4 (more options)", more_options, 0)
st.write("value 4:", i4)

i5 = st.selectbox("selectbox 5 (disabled)", options, disabled=True)
st.write("value 5:", i5)

i6 = st.selectbox("selectbox 6 (hidden label)", options, label_visibility="hidden")
st.write("value 6:", i6)

i7 = st.selectbox(
    "selectbox 7 (collapsed label)", options, label_visibility="collapsed"
)
st.write("value 7:", i7)

if runtime.exists():

    def on_change():
        st.session_state.selectbox_changed = True
        st.text("Selectbox widget callback triggered")

    st.selectbox(
        "selectbox 8 (with callback, help)",
        options,
        1,
        key="selectbox8",
        on_change=on_change,
        help="Help text",
    )
    st.write("value 8:", st.session_state.selectbox8)
    st.write("selectbox changed:", "selectbox_changed" in st.session_state)

i9 = st.selectbox("selectbox 9 (empty selection)", options, index=None)
st.write("value 9:", i9)

i10 = st.selectbox(
    "selectbox 10 (empty, custom placeholder)",
    options,
    index=None,
    placeholder="Select one of the options...",
)
st.write("value 10:", i10)

i11 = st.selectbox(
    "selectbox 11 (options from dataframe)", pd.DataFrame({"foo": list(options)})
)
st.write("value 11:", i11)
