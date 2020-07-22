import streamlit as st

set_query_params = st.button("Set current query paramss")

if set_query_params:
    query_params = {"checkbox": "True"}
    st.experimental_set_query_params(query_params)
