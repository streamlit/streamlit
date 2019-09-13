from io import BytesIO
import requests
from PIL import Image
import streamlit as st


@st.cache
def read_file_from_url(url):
    return requests.get(url).content


file_bytes = read_file_from_url(
    "https://streamlit.io/media/photo-1548407260-da850faa41e3.jpeg"
)
image = Image.open(BytesIO(file_bytes))

st.image(image, caption="Sunrise by the mountains", use_column_width=True)

st.write(
    """
    #### Image credit:

    Creator: User _fxxu_ from _Pixabay_.

    License: Free for commercial use. No attribution required.
    https://pixabay.com/en/service/license/

    URL:
    https://pixabay.com/en/videos/star-long-exposure-starry-sky-sky-6962/

"""
)
