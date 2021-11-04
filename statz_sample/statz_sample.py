# TODO: delete me before merging to develop!

import streamlit as st
import pandas as pd
import numpy as np


@st.experimental_singleton
def singleton_dataframe(size: int) -> pd.DataFrame:
    return pd.DataFrame(np.random.randn(size))


@st.experimental_memo
def memoize_dataframe(size: int) -> pd.DataFrame:
    return pd.DataFrame(np.random.randn(size))


st.header("st.memoized dataframes")

memoize_dataframe(100)
memoize_dataframe(1_000)
st.write(memoize_dataframe(10_000))

st.header("st.singleton dataframes")
singleton_dataframe(100)
singleton_dataframe(1000)
st.write(singleton_dataframe(10_000))

st.header("InMemoryFileManager media files")
st.image("streamlit.png")

st.file_uploader("uploader")
