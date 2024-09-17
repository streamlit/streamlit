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

audio1 = st.audio_input(
    label="Audio Input 1", key="the_audio_input", help="This is the help text"
)
st.audio(audio1)
st.write("Audio Input 1:", bool(audio1))


audio_input_from_form = None

with st.form(key="my_form", clear_on_submit=True):
    audio_input_from_form = st.audio_input(label="Audio Input in Form")
    st.form_submit_button("Submit")

st.write("Audio Input in Form:", audio_input_from_form)


@st.experimental_fragment()
def test_fragment():
    audio_input_from_fragment = st.audio_input(label="Audio Input in Fragment")
    st.write("Audio Input in Fragment:", audio_input_from_fragment)


test_fragment()

st.audio_input(label="Disabled Audio Input", disabled=True)

st.audio_input(label="Hidden Label Audio Input", label_visibility="hidden")


def on_change():
    st.session_state.audio_input_changed = True


st.audio_input(
    "Testing Callback",
    on_change=on_change,
)
st.write("Audio Input Changed:", "audio_input_changed" in st.session_state)


if st.button("Create some elements to unmount component"):
    for _ in range(3):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")

audio_input_after_sleep = st.audio_input(
    label="After sleep audio input", key="after_sleep_audio_input"
)
st.write("audio_input-after-sleep:", bool(audio_input_after_sleep))

if "runs" not in st.session_state:
    st.session_state.runs = 0
st.session_state.runs += 1
st.write("Runs:", st.session_state.runs)
