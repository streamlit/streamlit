import streamlit as st


@st.cache(allow_output_mutation=True)
def rerun_record():
    return [0]


count = rerun_record()
count[0] += 1

if count[0] < 4:
    st.experimental_rerun()

if count[0] >= 4:
    st.text("Being able to rerun a session is awesome!")
