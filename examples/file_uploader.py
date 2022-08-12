import streamlit as st

"""
# File Uploader

It's hard to test the ability to upload files in an automated way, so here you
should test it by hand. Please upload a CSV file and make sure a table shows up
below with its contents.
"""

w = st.file_uploader("Upload a CSV file", type="csv")
if w:
    import pandas as pd

    data = pd.read_csv(w)
    st.write(data)
