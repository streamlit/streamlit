import io

import streamlit as st
from streamlit.uploaded_file_manager import UploadedFile


def read_file(f: UploadedFile) -> str:
    return io.StringIO(f.getvalue().decode("utf-8")).read()


file = st.file_uploader("Single file", accept_multiple_files=False)
if file is None:
    st.write("No file")
else:
    st.write(read_file(file))

files = st.file_uploader("Multi-file", accept_multiple_files=True)
if len(files) == 0:
    st.write("No files")
else:
    for f in files:
        st.write(read_file(f))
