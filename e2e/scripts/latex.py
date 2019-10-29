import streamlit as st
import sympy as s

st.latex(r"\LaTeX")

a, b = s.symbols("a b")
out = a + b
st.latex(out)

x, y = s.symbols("x y")
out = x + 2 * y
st.write(out)
