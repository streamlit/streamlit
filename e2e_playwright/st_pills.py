# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import time

import streamlit as st

st.header("Pills - standard")

if st.checkbox("Set default values", value=False):
    st.session_state.default_pills = ["🧰 General widgets", "📊 Charts", "🧊 3D"]
else:
    st.session_state.default_pills = []

default = st.session_state.default_pills

pills_options = [
    "🧰 General widgets",
    "📊 Charts",
    "🌇 Images",
    "🎥 Video",
    "📝 Text",
    "🗺️ Maps & geospatial",
    "🧮 Dataframes & tables",
    "🧬 Molecules & genes",
    "🪢 Graphs",
    "🧊 3D",
    "✏️ Code & editors",
    "📃 Page navigation",
    "🔐 Authentication",
    "🎨 Style & layout",
    "🛠️ Developer tools",
    "🏗️ App builders",
    "🔌 Integrations with other tools",
    "📦 Collections of components",
    "📦 Very very long text" * 20,  # pill with very long text
]
selection = st.pills(
    "Select some options",
    pills_options,
    key="pills",
    selection_mode="multi",
    default=default,
    help="This is for choosing options",
)
st.write(f"Multi selection: {selection}")


st.header("Pills - starting with icons")
option_to_icon_map = {
    0: ":material/add:",
    1: ":material/zoom_in:",
    2: ":material/zoom_out:",
    3: ":material/zoom_out_map:",
}
selection = st.pills(
    "Select a single option",
    options=[0, 1, 2, 3],
    format_func=lambda option: option_to_icon_map[option],
    key="icon_only_pills",
    selection_mode="single",
)
st.write(f"Single selection: {selection}")


st.header("Pills - on_change callback")
st.pills(
    "Elements (label collapsed)",
    ["Water", "Fire", "Earth", "Air"],
    key="pills_on_change",
    on_change=lambda: st.write(
        f"on_change selection: {st.session_state.pills_on_change}"
    ),
    label_visibility="collapsed",
)


st.header("Pills - disabled")
selection = st.pills(
    "Elements",
    ["Water", "Fire", "Earth", "Air"],
    key="pills_disabled",
    disabled=True,
)
st.write("pills-disabled:", str(selection))


st.header("Pills in form")
with st.form(key="my_form", clear_on_submit=True):
    selection = st.pills(
        "Elements  (label hidden)",
        ["Water", "Fire", "Earth", "Air"],
        key="pills_in_form",
        label_visibility="hidden",
    )
    st.form_submit_button("Submit")

st.write(
    "pills-in-form:",
    str(st.session_state.pills_in_form)
    if "pills_in_form" in st.session_state
    else None,
)

st.header("Pills in fragment")


@st.experimental_fragment()
def test_fragment():
    selection = st.pills(
        "Elements", ["Water", "Fire", "Earth", "Air"], key="pills_in_fragment"
    )
    st.write("pills-in-fragment:", str(selection))


test_fragment()


st.header("Pills - unmount")
if st.button("Create some elements to unmount component"):
    for _ in range(3):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")

selection = st.pills(
    "Elements", ["Water", "Fire", "Earth", "Air"], key="pills_after_sleep"
)
st.write("pills-after-sleep:", str(selection))


if "runs" not in st.session_state:
    st.session_state.runs = 0
st.session_state.runs += 1
st.write("Runs:", st.session_state.runs)
