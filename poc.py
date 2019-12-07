# Proof-of-Concept for AV_URL branch

import io
import streamlit as st
import numpy as np
import wave

st.title("Audio test")


def generated():
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
    x.text("Sending wave...")
    # x.audio("sound.wav")
    # x.audio("file:///Users/nthmost/projects/git/STREAMLIT/streamlit/sound.wav")
    x.audio("http://localhost:8000/sound.wav")


generated()


st.title("Audio from a URL")


def shorten_audio_option(opt):
    return opt.split("/")[-1]


song = st.selectbox(
    "Pick an MP3 to play",
    (
        "file:///Users/nthmost/projects/git/streamlit-experiments/text2speech/welcome.wav",
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    ),
    0,
    shorten_audio_option,
)

st.audio(song)
