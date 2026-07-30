import streamlit as st


@st.fragment  # Has to be a fragment.
def a():
    st.button("Rerender `a()`")
    container = st.container()
    with container:
        b(1)
    with container:  # Has to be a separate `with`.
        b(2)


@st.fragment  # Has to be a fragment.
def b(i: int):
    st.markdown(i)


a()
