import streamlit as st
import pandas as pd
import numpy as np

df = pd.DataFrame(
    np.arange(0, 100, 1).reshape(10, 10)
)
st.dataframe(df)
