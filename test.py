import streamlit as st


@st.experimental_memo
def ha(a: str):
    print(a)


ha(5)
