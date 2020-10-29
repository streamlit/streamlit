import numpy as np
import pandas as pd
import streamlit as st

cols = st.number_input("Number of columns", value=5)
df = pd.DataFrame(np.random.randint(0, 10, size=(10, cols)))
st.dataframe(df)
