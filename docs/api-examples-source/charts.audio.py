import requests
import streamlit as st


@st.cache
def read_file_from_url(url):
    return requests.get(url).content


file_bytes = read_file_from_url(
    "https://streamlit.io/media/Muriel-Nguyen-Xuan-Chopin-valse-opus64-1.ogg"
)

st.audio(file_bytes, format="audio/ogg")

st.write(
    """
    #### Audio credit:

    Performer: _Muriel Nguyen Xuan_ and _Stéphane Magnenat_

    Composer: Frédéric Chopin

    License: Creative Commons Attribution-Share Alike 4.0 International, 3.0 Unported, 2.5 Generic, 2.0 Generic and 1.0 Generic license.
    https://creativecommons.org/licenses/by-sa/4.0/

    URL:
    https://upload.wikimedia.org/wikipedia/commons/c/c4/Muriel-Nguyen-Xuan-Chopin-valse-opus64-1.ogg

"""
)
