import streamlit as st

query_params = st.experimental_get_query_params()
st.write("Current query string is:", str(query_params))
