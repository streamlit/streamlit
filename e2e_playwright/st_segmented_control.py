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

with st.sidebar:
    st.markdown(
        """
        - [Multi Select - Segmented Control](#multi-select-segmented-control)
        - [Single Select - Segmented Control](#single-select-segmented-control)
        - [Icon-only button group - Segmented Control](#icon-only-button-group-segmented-control)
        - [on_change callback - Segmented Control](#on-change-callback-segmented-control)
        - [Disabled - Segmented Control](#disabled-segmented-control)
        - [Segmented Control in form](#segmented-control-in-form)
        - [Segmented Control in fragment](#segmented-control-in-fragment)
        - [Unmounted - Segmented Control](#unmounted-segmented-control)
        """
    )

st.header("Multi Select - Segmented Control", anchor="multi-select-segmented-control")
if st.checkbox("Set default values", value=False):
    st.session_state.default_segmented_control_options = [
        "Foobar",
        "🧰 General widgets",
    ]
else:
    st.session_state.default_segmented_control_options = []

default = st.session_state.default_segmented_control_options

selection = st.segmented_control(
    "Select some options",
    [
        ":material/star: Hello there!",
        "Foobar",
        "Icon in the end: :material/rocket:",
        ":material/thumb_up: Hello again!",
        "🧰 General widgets",
        "📊 Charts",
        "🌇 Images",
        "🎥 Video",
        "📝 Text",
        "This is a very long text 📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝, yes, long long long long text",
    ],
    key="segmented_control_multi_selection",
    selection_mode="multi",
    default=default,
    help="You can choose multiple options",
)
st.write(f"Multi selection: {selection}")


st.header("Single Select - Segmented Control", anchor="single-select-segmented-control")
selection = st.segmented_control(
    "Select an option",
    [
        ":material/star: Hello there!",
        "Foobar",
        "Icon in the end: :material/rocket:",
    ],
    key="segmented_control_single_selection",
    selection_mode="single",
)
st.write(f"Single selection: {selection}")

option_to_icon_map = {
    0: ":material/add:",
    1: ":material/zoom_in:",
    2: ":material/zoom_out:",
    3: ":material/zoom_out_map:",
}

st.header(
    "Icon-only button group - Segmented Control",
    anchor="icon-only-button-group-segmented-control",
)
selection = st.segmented_control(
    "select an icon",
    options=[0, 1, 2, 3],
    format_func=lambda option: option_to_icon_map[option],
    key="segmented_control_single_icon_selection",
    selection_mode="single",
)
st.write(f"Single icon selection: {selection}")


st.header(
    "on_change callback - Segmented Control",
    anchor="on-change-callback-segmented-control",
)
st.segmented_control(
    "Select an emotion:",
    ["Joy", "Sadness", "Anger", "Disgust"],
    key="segmented_control_on_change",
    on_change=lambda: st.write(
        f"on_change selection: {st.session_state.segmented_control_on_change}"
    ),
)


st.header(
    "Disabled - Segmented Control (label collapsed)",
    anchor="disabled-segmented-control",
)
selection = st.segmented_control(
    "Select an emotion:",
    ["Joy", "Sadness", "Anger", "Disgust"],
    key="segmented_control_disabled",
    disabled=True,
    label_visibility="collapsed",
)
st.write("segmented-control-disabled:", str(selection))


st.header("Segmented Control in form", anchor="segmented-control-in-form")
with st.form(key="my_form", clear_on_submit=True):
    selection = st.segmented_control(
        "Select an emotion:",
        ["Joy", "Sadness", "Anger", "Disgust"],
        key="segmented_control_in_form",
        selection_mode="multi",
    )
    st.form_submit_button("Submit")
st.write(
    "segmented-control-in-form:",
    str(st.session_state.segmented_control_in_form)
    if "segmented_control_in_form" in st.session_state
    else None,
)


st.header("Segmented Control in fragment", anchor="segmented-control-in-fragment")


@st.experimental_fragment()
def test_fragment():
    selection = st.segmented_control(
        "Select an emotion:",
        ["Joy", "Sadness", "Anger", "Disgust"],
        key="segmented_control_in_fragment",
    )
    st.write("segmented-control-in-fragment:", str(selection))


test_fragment()


st.header("Unmounted - Segmented Control", anchor="unmounted-segmented-control")
if st.button("Create some elements to unmount component"):
    for _ in range(2):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")

selection = st.segmented_control(
    "Select an emotion:",
    ["Joy", "Sadness", "Anger", "Disgust"],
    key="segmented_control_after_sleep",
)
st.write("segmented-control-after-sleep:", str(selection))


if "runs" not in st.session_state:
    st.session_state.runs = 0
st.session_state.runs += 1
st.write("Runs:", st.session_state.runs)
