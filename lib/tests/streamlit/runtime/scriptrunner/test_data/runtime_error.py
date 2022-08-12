"""A script that will throw an exception at runtime."""

import streamlit as st

# Create a delta
st.text("first")

# Cause an exception
bad = None
bad.do_a_thing()

# Create another delta (we'll never get here)
st.text("second")
