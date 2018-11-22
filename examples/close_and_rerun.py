import streamlit as st

st.header('Warning!!!')

st.warning('You must rerun this script to test it.')

st.write("""
Please **close this tab and rerun this script** again quickly by running
```
python examples/close_and_rerun.py
```
Then, please **verify that a new broser tab opened.**
""")
