import streamlit as st

st.error("This is an error")
st.warning("This is a warning")
st.info("This is an info message")
st.success("This is a success message")

# This is here so we can test the distance between alert messages and
# elements above/below them.
st.write("Some non-alert text!")

st.error("This is an error", icon="🚨")
st.warning("This is a warning", icon="⚠️")
st.info("This is an info message", icon="👉🏻")
st.success("This is a success message", icon="✅")

# Verify that line-wrapping works as expected both with and without break words.
st.error("A" + 100 * "H")
st.error("If I repeat myself enough the line should " + 20 * "wrap ")
