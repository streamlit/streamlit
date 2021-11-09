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


memo_1(1)
singleton_1(1)
memo_2(1)
singleton_2(1)
