import streamlit as st


@st.experimental_memo
def pass_an_int_memo(value: int) -> None:
    pass


@st.experimental_singleton
def pass_an_int_singleton(value: int) -> None:
    pass


pass_an_int_memo(5)
pass_an_int_singleton(7)
