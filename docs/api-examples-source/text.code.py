import streamlit as st

code = """def hello():
    print("Hello, Streamlit!")"""
st.code(code, language="python")
