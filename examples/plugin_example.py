import streamlit as st

st.plugin("my_plugin", "plugin_template/build")

st.my_plugin({"name": "Streamlit"})
st.my_plugin({"name": "again"})
st.my_plugin({"name": "a third time!"})
st.sidebar.my_plugin({"name": "Sidebar"})
