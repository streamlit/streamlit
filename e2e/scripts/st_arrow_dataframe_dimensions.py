import streamlit as st
import numpy as np
import pandas as pd

# Explicitly seed the RNG for deterministic results
np.random.seed(0)

data = np.random.randn(100, 100)

df = pd.DataFrame(data)
st._arrow_dataframe(df)
st._arrow_dataframe(df, 250, 150)
st._arrow_dataframe(df, width=250)
st._arrow_dataframe(df, height=150)
st._arrow_dataframe(df, 5000, 5000)
st._arrow_dataframe(df, use_container_width=True)

small_df = pd.DataFrame(np.random.randn(100, 3))
st._arrow_dataframe(small_df, width=500)
st._arrow_dataframe(small_df, use_container_width=True)
st._arrow_dataframe(small_df, width=200, use_container_width=True)
st._arrow_dataframe(small_df, width=200, use_container_width=False)

one_col_df = pd.DataFrame(np.random.randn(100, 1))
st._arrow_dataframe(one_col_df, use_container_width=True)
