import streamlit as st

col1, col2, col3 = st.columns(3)

with col1:
    st.metric("User growth", 123, 123, "normal")
with col2:
    st.metric("S&P 500", -4.56, -50)
with col3:
    st.metric("Apples I've eaten", "23k", " -20", "off")

" "

col1, col2, col3 = st.columns(3)

with col1:
    st.selectbox("Pick one", [])
with col2:
    st.metric("Test 2", -4.56, 1.23, "inverse")
with col3:
    st.slider("Pick another")
