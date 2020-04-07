import streamlit as st

st.plugin("my_plugin", "plugin_template/build")

result = st.my_plugin(
    label="How many bats?",
    options=["one bat", "TWO bats", "THREE bats", "FOUR BATS! ah ah ah!"],
    default="one bat",
)
st.write("This many: %s" % result)
