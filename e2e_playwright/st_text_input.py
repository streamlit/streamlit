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

v1 = st.text_input("text input 1 (default)")
st.write("value 1:", v1)

v2 = st.text_input("text input 2 (value='some text')", "some text")
st.write("value 2:", v2)

v3 = st.text_input("text input 3 (value=1234)", 1234)
st.write("value 3:", v3)

v4 = st.text_input("text input 4 (value=None)", None)
st.write("value 4:", v4)

v5 = st.text_input("text input 5 (placeholder)", placeholder="Placeholder")
st.write("value 5:", v5)

v6 = st.text_input("text input 6 (disabled)", "default text", disabled=True)
st.write("value 6:", v6)

v7 = st.text_input(
    "text input 7 (hidden label)", "default text", label_visibility="hidden"
)
st.write("value 7:", v7)

v8 = st.text_input(
    "text input 8 (collapsed label)", "default text", label_visibility="collapsed"
)
st.write("value 8:", v8)

if runtime.exists():

    def on_change():
        st.session_state.text_input_changed = True
        st.text("Text input changed callback")

    st.text_input(
        "text input 9 (callback, help)",
        key="text_input_9",
        on_change=on_change,
        help="Help text",
    )
    st.write("value 9:", st.session_state.text_input_9)
    st.write("text input changed:", st.session_state.get("text_input_changed") is True)
    st.session_state.text_input_changed = False

v10 = st.text_input("text input 10 (max_chars=5)", "1234", max_chars=5)
st.write("value 10:", v10)

v11 = st.text_input("text input 11 (type=password)", "my password", type="password")
st.write("value 11:", v11)

if "text_input_12" not in st.session_state:
    st.session_state["text_input_12"] = "xyz"

v12 = st.text_input(
    "text input 12 (value from state)",
    value=None,
    key="text_input_12",
)
st.write("text input 12 (value from state) - value: ", v12)

with st.form("form"):
    st.text_input("text input 13 (value from form)", key="text_input_13")
    st.form_submit_button("submit")

form_value = st.session_state.get("text_input_13", None)
st.write("text input 13 (value from form) - value: ", form_value)


st.text_input(
    "text input 14 -> :material/check: :rainbow[Fancy] **markdown** `label` _support_",
    key="text_input_14",
)

if "rerun_counter" not in st.session_state:
    st.session_state.rerun_counter = 0

st.session_state.rerun_counter += 1
st.write("Rerun counter:", st.session_state.rerun_counter)

st.text_input("text input 15 - emoji icon", placeholder="Placeholder", icon="🔎")

st.text_input(
    "text input 16 - material icon", placeholder="Placeholder", icon=":material/search:"
)

st.text_input("text input 17 (width=200px)", "width test", width=200)
st.text_input("text input 18 (width='stretch')", "width test", width="stretch")

st.markdown("Dynamic text input:")

if st.toggle("Update text input props"):
    txt_value = st.text_input(
        "Updated dynamic text input",
        value="updated",
        width=200,
        help="updated help",
        key="dynamic_text_input_with_key",
        on_change=lambda a, param: print(
            f"Updated text input - callback triggered: {a} {param}"
        ),
        args=("Updated text arg",),
        kwargs={"param": "updated kwarg param"},
        placeholder="updated placeholder",
        autocomplete="updated autocomplete",
        # max_chars is not yet supported for dynamic changes
        # keeping it at the same value for now:
        max_chars=100,
    )
    st.write("Updated text input value:", txt_value)
else:
    txt_value = st.text_input(
        "Initial dynamic text input",
        value="initial",
        width="stretch",
        help="initial help",
        key="dynamic_text_input_with_key",
        on_change=lambda a, param: print(
            f"Initial text input - callback triggered: {a} {param}"
        ),
        args=("Initial text arg",),
        kwargs={"param": "initial kwarg param"},
        placeholder="initial placeholder",
        autocomplete="initial autocomplete",
        max_chars=100,
    )
    st.write("Initial text input value:", txt_value)
