import streamlit as st

if st._is_running_with_streamlit:

    if st.checkbox("checkbox 1"):
        if st.checkbox("checkbox 2"):
            st.write("hello")

        if st.checkbox("checkbox 3", key="c3"):
            st.write("goodbye")
