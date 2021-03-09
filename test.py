from typing import List, Optional

import streamlit as st
from streamlit.uploaded_file_manager import UploadedFile

with st.beta_form():
    files: Optional[List[UploadedFile]] = st.file_uploader(
        "files", accept_multiple_files=True
    )

if files is None or len(files) == 0:
    st.write("Upload and press submit!")
else:
    for f in files:
        st.video(f)
