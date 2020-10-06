import streamlit as st

VIDEO_URL = "https://static.streamlit.io/examples/star.mp4"

st.video(VIDEO_URL)

st.write(
    """
    #### Video credit:

    Creator: User _fxxu_ from _Pixabay_.

    License: Free for commercial use. No attribution required.
    https://pixabay.com/en/service/license/

    URL:
    https://pixabay.com/en/videos/star-long-exposure-starry-sky-sky-6962/

"""
)
