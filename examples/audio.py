# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import io
import streamlit as st
import numpy as np
import wave

st.title("Audio test")


st.title("Generated audio (440Hz sine wave)")


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

f = wave.open("sound.wav", "w")
f.setparams((nchannels, sampwidth, int(sampling_rate), nframes, comptype, compname))

x.text("Converting wave...")
f.writeframes(sine_wave)

f.close()

with io.open("sound.wav", "rb") as f:
    x.text("Sending wave...")
    x.audio(f)

st.title("Audio from a URL")


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
