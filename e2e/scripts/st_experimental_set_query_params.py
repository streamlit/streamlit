import streamlit as st

set_query_params = st.button("Set current query params")

if set_query_params:
    st.experimental_set_query_params(
        show_map=True,
        number_of_countries=2,
        selected=["asia", "america"],
    )
