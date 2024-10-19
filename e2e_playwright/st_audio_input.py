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

import io
import time
import wave

import streamlit as st


# Main Audio Input Section
def render_main_audio_input():
    """
    Renders the main audio input component with a label and help tooltip.
    Displays the recorded audio and a boolean indicating if any audio was captured.
    """
    audio_input = st.audio_input(
        label="Audio Input 1", key="the_audio_input", help="This is the help text"
    )
    st.audio(audio_input)  # Display the audio playback if available
    st.write("Audio Input 1:", bool(audio_input))  # Display True if audio was captured

    if audio_input is not None:
        # Load the uploaded file as a file-like object
        wav_file_like = io.BytesIO(audio_input.read())

        try:
            # Open the in-memory file with the wave module
            with wave.open(wav_file_like, "rb") as wav_file:
                # Extract information about the WAV file
                num_channels = wav_file.getnchannels()
                sample_width = wav_file.getsampwidth()
                frame_rate = wav_file.getframerate()
                num_frames = wav_file.getnframes()
                duration = num_frames / float(frame_rate)

                # Display the information
                st.write(f"**Channels**: {num_channels}")
                st.write(f"**Sample Width**: {sample_width} bytes")
                st.write(f"**Frame Rate (Sample Rate)**: {frame_rate} Hz")
                st.write(f"**Number of Frames**: {num_frames}")
                st.write(f"**Duration**: {duration:.2f} seconds")

        except wave.Error as e:
            st.error(f"Error loading WAV file: {e}")


# Form Audio Input Section
def render_form_audio_input():
    """
    Renders a form with an audio input and a submit button.
    The form clears on submission and displays the captured audio.
    """
    audio_input_from_form = None
    with st.form(key="my_form", clear_on_submit=True):
        audio_input_from_form = st.audio_input(label="Audio Input in Form")
        st.form_submit_button("Submit")

    st.write("Audio Input in Form:", audio_input_from_form)


# Fragment Audio Input Section
@st.fragment()
def test_fragment():
    """
    Defines a fragment that includes an audio input component.
    Displays the captured audio from the fragment.
    """
    audio_input_from_fragment = st.audio_input(label="Audio Input in Fragment")
    st.write("Audio Input in Fragment:", audio_input_from_fragment)


# Audio Input with Various Options
def render_special_audio_inputs():
    """
    Renders various audio inputs with different properties such as
    disabled and hidden label visibility.
    """
    st.audio_input(label="Disabled Audio Input", disabled=True)
    st.audio_input(label="Hidden Label Audio Input", label_visibility="hidden")


# Callback Example
def on_change():
    """Callback function to set a flag when audio input changes."""
    st.session_state.audio_input_changed = True


def render_callback_audio_input():
    """
    Renders an audio input component with an `on_change` callback.
    Displays whether the audio input has changed.
    """
    st.audio_input(
        label="Testing Callback",
        on_change=on_change,
    )
    st.write("Audio Input Changed:", "audio_input_changed" in st.session_state)


# Component Remounting Section
def render_remount_test():
    """
    Renders an audio input component, simulates element unmounting, and checks
    if the value persists after remounting. Also includes a button to create additional elements.
    """
    if st.button("Create some elements to unmount component"):
        for _ in range(3):
            # Sleep is required to ensure the component properly unmounts.
            time.sleep(1)
            st.write("Another element")

    audio_input_after_sleep = st.audio_input(
        label="After sleep audio input", key="after_sleep_audio_input"
    )
    st.write("audio_input-after-sleep:", bool(audio_input_after_sleep))


# Runs Tracker
def track_runs():
    """Tracks how many times the app has been run in this session."""
    if "runs" not in st.session_state:
        st.session_state.runs = 0
    st.session_state.runs += 1
    st.write("Runs:", st.session_state.runs)


# Direct function calls to render the app
st.title("Audio Input Test App")

render_main_audio_input()
render_form_audio_input()
test_fragment()  # Fragment function call
render_special_audio_inputs()
render_callback_audio_input()
render_remount_test()
track_runs()
