import streamlit as st

if "multiselect 1" in st.session_state:
    st.session_state["multiselect 1"] = ["male", "female"]

i1 = st.multiselect(
    "multiselect 1", ["male", "female"], key="multiselect 1", max_selections=1
)
