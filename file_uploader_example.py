import streamlit as st

st.title("File Uploader Example")

st.file_uploader(
    "Upload a file",
    type=["txt", "pdf", "docx", "doc"],
    accept_multiple_files=True,
)

st.sidebar.file_uploader(
    "Upload a file",
    type=["txt", "pdf", "docx", "doc"],
    accept_multiple_files=True,
)
