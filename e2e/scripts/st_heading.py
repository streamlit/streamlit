import streamlit as st

st.header("This header is awesome!")
st.header("This header is awesome too!", anchor="awesome-header")

st.title("`Code` - Title without Anchor")
st.title("`Code` - Title with Anchor", anchor="title")


st.subheader("`Code` - Subheader without Anchor")
st.subheader(
    """`Code` - Subheader with Anchor [test_link](href)""",
    anchor="subheader",
)
