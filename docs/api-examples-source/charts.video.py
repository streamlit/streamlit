import streamlit as st
import urllib

@st.cache
def read_file_from_url(url):
    return urllib.request.urlopen(url).read()

file_bytes = read_file_from_url(
    'https://streamlit.io/media/Star%20-%206962.mp4')

st.video(file_bytes)

st.write('''
    #### Video credit:

    Creator: User _Neil Iris (@neil_ingham)_ from _Unsplash_

    License: Do whatever you want.
    https://unsplash.com/license

    URL:
    https://unsplash.com/photos/I2UR7wEftf4

''')
