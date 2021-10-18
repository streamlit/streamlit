# TODO: delete me before merging to develop!

import streamlit as st
import pandas as pd
import numpy as np


@st.experimental_memo
def create_dataframe(size: int) -> pd.DataFrame:
    return pd.DataFrame(np.random.randn(size))


st.header("st.memoized dataframes")

st.write(create_dataframe(100))
st.write(create_dataframe(1_000))
st.write(create_dataframe(10_000))

st.header("InMemoryFileManager media files")
st.image("streamlit.png")

st.file_uploader("uploader")
