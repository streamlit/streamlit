import streamlit as st

@st.dialog("Dialog with selectboxes")
def show_dialog():
    st.selectbox("First", ["one", "two", "three"])

if st.button("Open dialog"):
    show_dialog()
