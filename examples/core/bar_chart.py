import streamlit as st
import pandas as pd

data = [[20, 30, 50]]
df = pd.DataFrame(data, columns=['a', 'b', 'c'])
st.bar_chart(df)
