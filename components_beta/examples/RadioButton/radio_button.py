"""
Re-implements the Streamlit radiobutton as a custom component.
"""

import streamlit as st

RadioButton = st.declare_component(url="http://localhost:3001")
st.register_component("custom_radio_button", RadioButton)

result = st.custom_radio_button(
    label="How many bats?",
    options=["one bat", "TWO bats", "THREE bats", "FOUR BATS! ah ah ah!"],
    default="one bat",
)
st.write("This many: %s" % result)
