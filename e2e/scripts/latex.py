import streamlit as st

st.latex(r"\LaTeX")

try:
    import sympy

    a, b = sympy.symbols("a b")
    out = a + b
except:
    out = "a + b"

st.latex(out)
