import streamlit as st
import time

# A spinner always requires a computation to run for a certain time
# Therefore, we add a button to allow triggering the spinner during the test execution.
if st.button("Run Spinner"):
    with st.spinner("Loading..."):
        time.sleep(2)
