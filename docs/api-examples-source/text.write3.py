import streamlit as st
import pandas as pd

data_frame = pd.DataFrame(
    {"first column": [1, 2, 3, 4], "second column": [10, 20, 30, 40]}
)

st.write("1 + 1 = ", 2)
st.write("Below is a DataFrame:", data_frame, "Above is a dataframe.")
