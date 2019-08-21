import streamlit as st

# Create a big ol' dataframe, and send it twice
df = list(range(100000))
st.dataframe(df)
st.dataframe(df)
