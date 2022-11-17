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

import os
import wave

import numpy as np
from scipy.io import wavfile

import streamlit as st

st.title("Audio test")

st.header("Local file")

# These are the formats supported in Streamlit right now.
AUDIO_EXTENSIONS = ["wav", "flac", "mp3", "aac", "ogg", "oga", "m4a", "opus", "wma"]

# For samples of sounds in different formats, see
# https://docs.espressif.com/projects/esp-adf/en/latest/design-guide/audio-samples.html


def get_audio_files_in_dir(directory):
    out = []
    for item in os.listdir(directory):
        try:
            name, ext = item.split(".")
        except:
            continue
        if name and ext:
            if ext in AUDIO_EXTENSIONS:
                out.append(item)
    return out


avdir = os.path.expanduser("~")
audiofiles = get_audio_files_in_dir(avdir)

if len(audiofiles) == 0:
    st.write(
        "Put some audio files in your home directory (%s) to activate this player."
        % avdir
    )

else:
    filename = st.selectbox(
        "Select an audio file from your home directory (%s) to play" % avdir,
        audiofiles,
        0,
    )
    audiopath = os.path.join(avdir, filename)
    st.audio(audiopath)


st.header("Generated audio (440Hz sine wave)")


def note(freq, length, amp, rate):
    t = np.linspace(0, length, length * rate)
    data = np.sin(2 * np.pi * freq * t) * amp
    return data.astype(np.int16)


frequency = 440  # hertz
nchannels = 1
sampwidth = 2
sampling_rate = 44100
duration = 89  # Max size, given the bitrate and sample width
comptype = "NONE"
compname = "not compressed"
amplitude = 10000
nframes = duration * sampling_rate

x = st.text("Making wave...")
sine_wave = note(frequency, duration, amplitude, sampling_rate)

fh = wave.open("sound.wav", "w")
fh.setparams((nchannels, sampwidth, int(sampling_rate), nframes, comptype, compname))

x.text("Converting wave...")
fh.writeframes(sine_wave)

fh.close()

with open("sound.wav", "rb") as f:
    x.text("Sending wave...")
    x.audio(f)

st.header("Audio from a Remote URL")


def shorten_audio_option(opt):
    return opt.split("/")[-1]


song = st.selectbox(
    "Pick an MP3 to play",
    (
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    ),
    0,
    shorten_audio_option,
)

st.audio(song)

st.title("Streaming audio from a URL")

st.write("[MP3: Mutiny Radio](http://nthmost.net:8000/mutiny-studio)")

st.audio("http://nthmost.net:8000/mutiny-studio")

st.write("[OGG: Radio Loki](http://nthmost.net:8000/loki.ogg)")

st.audio("http://nthmost.net:8000/loki.ogg")
