import streamlit as st

javascript = """
return function (args) {
    return "Hello, " + args["name"] + "!"
}
"""

my_plugin = st.plugin(javascript)

my_plugin(st._main, {"name": "Streamlit"})
my_plugin(st._main, {"name": "everyone else"})
