import streamlit as st

IMAGE_URL = "https://images.unsplash.com/photo-1548407260-da850faa41e3?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1487&q=80"

st.image(IMAGE_URL, caption="Sunrise by the mountains")

st.write(
    """
    #### Image credit:

    Creator: User _Neil Iris (@neil_ingham)_ from _Unsplash_

    License: Do whatever you want.
    https://unsplash.com/license

    URL:
    https://unsplash.com/photos/I2UR7wEftf4

"""
)
