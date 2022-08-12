import streamlit as st

with st.form("check_it_out_now"):
    cols = st.columns(2)

    slider = st.slider("slider")

    with cols[0]:
        st.form_submit_button("Check it")
    with cols[1]:
        st.form_submit_button("t's out")

st.write(slider)
