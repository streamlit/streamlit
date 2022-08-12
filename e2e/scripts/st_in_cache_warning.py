import streamlit as st


@st.cache
def cached_write(value):
    st.write(value)


@st.cache(suppress_st_warning=True)
def cached_write_nowarn(value):
    st.write(value)


@st.cache
def cached_widget(name):
    st.button(name)


cached_write("I'm in a cached function!")
cached_widget("Wadjet!")
cached_write_nowarn("Me too!")

st.write(
    """
    If this is failing locally, it could be because you have a browser with
    Streamlit open. Close it and the test should pass.
"""
)
