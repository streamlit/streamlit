import streamlit as st

st.plugin("my_plugin", "plugin_template/build")

result = st.my_plugin(
    {
        "label": "How many bats?",
        "options": ["one bat", "TWO bats", "THREE BATS", "ah ha ha!"],
        "default": "one bat",
    }
)
st.write("You selected '%s'" % result)
