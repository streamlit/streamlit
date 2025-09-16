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

import io
import time
import wave

import streamlit as st

st.title("Audio Input Test App")

# Main audio input with help text
audio_input = st.audio_input(
    label="Audio Input 1", key="the_audio_input", help="This is the help text"
)
st.audio(audio_input)
st.write("Audio Input 1:", bool(audio_input))

# Show WAV analysis for testing
if audio_input is not None:
    try:
        with wave.open(io.BytesIO(audio_input.read()), "rb") as wav_file:
            num_frames = wav_file.getnframes()
            frame_rate = wav_file.getframerate()
            duration = num_frames / float(frame_rate)
            st.write(f"**Channels**: {wav_file.getnchannels()}")
            st.write(f"**Sample Width**: {wav_file.getsampwidth()} bytes")
            st.write(f"**Frame Rate (Sample Rate)**: {frame_rate} Hz")
            st.write(f"**Duration**: {duration:.2f} seconds")
    except wave.Error as e:
        st.error(f"Error loading WAV file: {e}")

# Form integration
with st.form(key="my_form", clear_on_submit=True):
    form_audio = st.audio_input(label="Audio Input in Form")
    st.form_submit_button("Submit")
st.write("Audio Input in Form:", form_audio)


# Fragment test
@st.fragment()
def test_fragment():
    fragment_audio = st.audio_input(label="Audio Input in Fragment")
    st.write("Audio Input in Fragment:", fragment_audio)


test_fragment()

# Disabled and hidden label
st.audio_input(label="Disabled Audio Input", disabled=True)
st.audio_input(label="Hidden Label Audio Input", label_visibility="hidden")


# Callback test
def on_change():
    st.session_state.audio_input_changed = True


st.audio_input(label="Testing Callback", on_change=on_change)
st.write("Audio Input Changed:", "audio_input_changed" in st.session_state)

# Remount test
if st.button("Create some elements to unmount component"):
    for _ in range(3):
        time.sleep(1)
        st.write("Another element")

after_sleep = st.audio_input(
    label="After sleep audio input", key="after_sleep_audio_input"
)
st.write("audio_input-after-sleep:", bool(after_sleep))

# Sample rate tests
st.header("Sample Rate Tests")
st.audio_input("Default Sample Rate (16 kHz)", key="sample_rate_default")
audio_48k = st.audio_input(
    "High Quality (48 kHz)", sample_rate=48000, key="sample_rate_48k"
)
if audio_48k:
    st.write("48 kHz recorded")

audio_browser = st.audio_input(
    "Browser Default", sample_rate=None, key="sample_rate_browser"
)
if audio_browser:
    st.write("Browser default recorded")

# Width tests
st.audio_input("Width Stretch", width="stretch")
st.audio_input("Width 300px", width=300)

# Run counter
if "runs" not in st.session_state:
    st.session_state.runs = 0
st.session_state.runs += 1
st.write("Runs:", st.session_state.runs)
