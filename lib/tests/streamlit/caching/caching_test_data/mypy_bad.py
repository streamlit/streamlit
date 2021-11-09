import streamlit as st


@st.experimental_memo
def memo_1(value: int) -> None:
    pass


@st.experimental_memo(show_spinner=False)
def memo_2(value: int) -> None:
    pass


@st.experimental_singleton
def singleton_1(value: int) -> None:
    pass


@st.experimental_singleton(show_spinner=False)
def singleton_2(value: int) -> None:
    pass


memo_1("not an int!")
singleton_1("not an int!")
memo_2("not an int!")
singleton_2("not an int!")
