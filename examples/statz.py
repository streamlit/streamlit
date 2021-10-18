# TODO: delete me before merging to develop!

import streamlit as st
import pandas as pd
import numpy as np


@st.experimental_memo
def create_dataframe(size: int) -> pd.DataFrame:
    return pd.DataFrame(np.random.randn(size))


st.write(create_dataframe(100))
st.write(create_dataframe(1_000))
st.write(create_dataframe(10_000))
