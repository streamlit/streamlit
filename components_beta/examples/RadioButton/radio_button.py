import streamlit as st
import streamlit.components.v1 as components

_radio_button = components.declare_component(
    "radio_button", url="http://localhost:3001",
)


def custom_radio_button(label, options, default, key=None):
    return _radio_button(label=label, options=options, default=default, key=key)


result = custom_radio_button(
    "How many bats?",
    options=["one bat", "TWO bats", "THREE bats", "FOUR BATS! ah ah ah!"],
    default="one bat",
)
st.write("This many: %s" % result)
