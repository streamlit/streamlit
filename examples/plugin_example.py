import streamlit as st

javascript = """
return function (args) {
    return "Hello, " + args["name"] + "!"
}
"""

st.plugin("my_plugin", javascript)

st.my_plugin({"name": "Streamlit"})
st.sidebar.my_plugin({"name": "Sidebar"})
