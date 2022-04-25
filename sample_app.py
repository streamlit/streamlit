import streamlit as st

import numpy as np
import pandas as pd


if st.button("click"):
    st.write("Clicked the button")

name = st.text_input("what is your name?")


def make_df(rows):
    dates = pd.date_range("20130101", freq="min", periods=rows)
    dfr = pd.DataFrame(np.random.randn(rows, 4), index=dates, columns=list("ABCD"))
    df = pd.DataFrame(np.zeros_like(dfr), index=dates, columns=list("ABCD"))
    return df, dfr


if st.checkbox("show dataframe"):
    _, dfr = make_df(20)
    st.write(dfr)

st.write(f"hello {name}")
