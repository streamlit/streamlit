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

import time

import streamlit as st

st.header("Pills - standard")

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
    "📦 Very very long text" * 21,  # pill with very long text
]
s1 = st.pills(
    "Select some options",
    pills_options,
    key="pills",
    selection_mode="multi",
    help="This is for choosing options",
)
st.write(f"Multi selection: {s1}")


st.header("Pills - starting with icons")
option_to_icon_map = {
    0: ":material/add:",
    1: ":material/zoom_in:",
    2: ":material/zoom_out:",
    3: ":material/zoom_out_map:",
}
s2 = st.pills(
    "Select a single option",
    options=[0, 1, 2, 3],
    format_func=lambda option: option_to_icon_map[option],
    key="icon_only_pills",
    selection_mode="single",
)
st.write(f"Single selection: {s2}")


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
s3 = st.pills(
    "Elements",
    ["Water", "Fire", "Earth", "Air"],
    key="pills_disabled",
    disabled=True,
)
st.write("pills-disabled:", str(s3))


st.header("Pills in form")
with st.form(key="my_form", clear_on_submit=True):
    st.pills(
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


@st.fragment
def test_fragment():
    s5 = st.pills(
        "Elements", ["Water", "Fire", "Earth", "Air"], key="pills_in_fragment"
    )
    st.write("pills-in-fragment:", str(s5))


test_fragment()


st.header("Pills - unmount")
if st.button("Create some elements to unmount component"):
    for _ in range(3):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")

s6 = st.pills("Elements", ["Water", "Fire", "Earth", "Air"], key="pills_after_sleep")
st.write("pills-after-sleep:", str(s6))


st.header("Pills - width examples")
st.pills(
    "Pills with content width (default)",
    ["Option 1", "Option 2", "Option 3"],
    width="content",
    key="pills_content_width",
)

st.pills(
    "Pills with stretch width",
    ["Option 1", "Option 2", "Option 3"],
    width="stretch",
    key="pills_stretch_width",
)

st.pills(
    "Pills with 300px width",
    ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"],
    width=300,
    key="pills_300px_width",
)

st.header("Pills - disabled and selected")
s10 = st.pills(
    "Elements",
    ["Water", "Fire", "Earth", "Air"],
    key="pills_disabled-selected",
    default="Water",
    disabled=True,
)
st.write("pills-disabled-selected:", str(s10))


if "runs" not in st.session_state:
    st.session_state.runs = 0
st.session_state.runs += 1
st.write("Runs:", st.session_state.runs)

if st.checkbox("Set default values", value=False):
    st.session_state.default_pills = ["🧰 General widgets", "🎥 Video"]
else:
    st.session_state.default_pills = []

default = st.session_state.default_pills

# The test will only work if this doesn't use a user-specified key:
val = st.pills(
    "Pills with default options",
    [
        "🧰 General widgets",
        "📊 Charts",
        "🌇 Images",
        "🎥 Video",
        "📝 Text",
    ],
    selection_mode="multi",
    default=st.session_state.default_pills,
)
st.write("Pills with default options:", str(val))

if st.toggle("Update pills props"):
    dyn_val = st.pills(
        "Updated dynamic pills",
        key="dynamic_pills_with_key",
        help="updated help",
        width=300,
        default="banana",
        on_change=lambda a, param: print(
            f"Updated pills - callback triggered: {a} {param}"
        ),
        args=("Updated pills arg",),
        kwargs={"param": "updated kwarg param"},
        # Whitelisted args:
        options=["apple", "banana", "orange"],
        selection_mode="single",
        format_func=lambda x: x.capitalize(),
    )
    st.write("Updated pills value:", dyn_val)
else:
    dyn_val = st.pills(
        "Initial dynamic pills",
        key="dynamic_pills_with_key",
        help="initial help",
        width="content",
        default="apple",
        on_change=lambda a, param: print(
            f"Initial pills - callback triggered: {a} {param}"
        ),
        args=("Initial pills arg",),
        kwargs={"param": "initial kwarg param"},
        # Whitelisted args:
        options=["apple", "banana", "orange"],
        selection_mode="single",
        format_func=lambda x: x.capitalize(),
    )
    st.write("Initial pills value:", dyn_val)
