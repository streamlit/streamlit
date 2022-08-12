import streamlit as st

st.download_button(
    "Download button label",
    data="Hello world!",
    file_name="hello.txt",
)

st.download_button(
    "Download button label",
    data="Hello world!",
    file_name="hello.txt",
    key="disabled_dl_button",
    disabled=True,
)

st.download_button(
    "Download RAR archive file",
    data=b"bytes",
    file_name="archive.rar",
    mime="application/vnd.rar",
)
