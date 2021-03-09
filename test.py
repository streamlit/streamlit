import streamlit as st

files = st.file_uploader("files", accept_multiple_files=True)

if files is None or len(files) == 0:
    st.write("Upload and press submit!")
else:
    for f in files:
        st.video(f)
