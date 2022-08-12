import streamlit as st
import numpy as np
import pandas as pd

# Explicitly seed the RNG for deterministic results
np.random.seed(0)

st.title("Tables with different sizes")

st.header("Long cells that overflow")

st.write(
    """
    Long text should show an ellipsis. All cells should have a tooltip
    with their entire un-ellipsized contents.
    """
)

ROWS = 2

st.header("Using st._arrow_table")

for cols in [4, 5, 6, 20]:
    df = pd.DataFrame(
        np.random.randn(ROWS, cols), index=range(ROWS), columns=range(cols)
    )
    st._arrow_table(df)

st.header("Overriding st._arrow_table")

for cols in [4, 5, 6, 20]:
    df = pd.DataFrame(
        np.random.randn(ROWS, cols), index=range(ROWS), columns=range(cols)
    )
    df_elt = st._arrow_table(np.random.randn(200, 200))
    df_elt._arrow_table(df)
