from pathlib import Path

import streamlit as st

icon_path = Path(__file__).parent.parent.joinpath("assets/favicon.ico")
if not icon_path.is_file():
    print(f"Missing favicon at {str(icon_path)}")
    exit(1)

st.set_page_config(page_icon=str(icon_path))
