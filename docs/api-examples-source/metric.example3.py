import streamlit as st

st.metric(label="Gas price", value=4, delta=-0.5, delta_color="inverse")
st.metric(label="Active developers", value=123, delta=123, delta_color="off")
