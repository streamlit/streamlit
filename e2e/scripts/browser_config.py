import streamlit as st
import time

if st.button("show main menu"):
    st.set_option("browser.hideMainMenu", False)
    st.experimental_rerun()

if st.button("hide main menu"):
    st.set_option("browser.hideMainMenu", True)
    st.experimental_rerun()

if st.button("show running icon"):
    st.set_option("browser.hideRunningIcon", False)
    st.experimental_rerun()

if st.button("hide running icon"):
    st.set_option("browser.hideRunningIcon", True)
    st.experimental_rerun()

time.sleep(0.5)
