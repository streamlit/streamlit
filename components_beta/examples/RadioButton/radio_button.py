"""
Re-implements the Streamlit radiobutton as a custom component.
"""

import streamlit as st

st.register_component("custom_radio_button", url="http://localhost:3001")

result = st.custom_radio_button(
    label="How many bats?",
    options=["one bat", "TWO bats", "THREE bats", "FOUR BATS! ah ah ah!"],
    default="one bat",
)
st.write("This many: %s" % result)
