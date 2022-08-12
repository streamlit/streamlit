import streamlit as st

st.text("Text before stop")

# Since st.stop() throws an intentional exception, we want this to run
# only in streamlit
if st._is_running_with_streamlit:
    st.stop()

st.text("Text after stop")
