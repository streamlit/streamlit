import streamlit as st

VIDEO_URL = "https://vod-progressive.akamaized.net/exp=1595241944~acl=%2A%2F664785003.mp4%2A~hmac=2a26d355839498b80bbb2c43e6808bd12bc0d2e7920616a8226a1e017c270217/vimeo-prod-skyfire-std-us/01/4526/7/197634410/664785003.mp4?filename=Star+-+6962.mp4"

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
