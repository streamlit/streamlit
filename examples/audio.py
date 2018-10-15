import io
import streamlit as st
import numpy as np
import wave

st.title('Audio test')


def note(freq, length, amp, rate):
 t = np.linspace(0, length, length * rate)
 data = np.sin( 2 * np.pi * freq * t) * amp
 return data.astype(np.int16)

frequency = 440  # hertz
nchannels = 1
sampwidth = 2
sampling_rate = 44100
duration = 89  # Max size, given the bitrate and sample width
comptype = 'NONE'
compname = 'not compressed'
amplitude = 10000
nframes = duration * sampling_rate

x = st.text('Making wave...')
sine_wave = note(frequency, duration, amplitude, sampling_rate)

f = wave.open('sound.wav', 'w')
f.setparams((nchannels, sampwidth, int(sampling_rate), nframes, comptype, compname))

x.text('Converting wave...')
f.writeframes(sine_wave)

f.close()

with io.open('sound.wav', 'rb') as f:
    x.text('Sending wave...')
    x.audio(f)
