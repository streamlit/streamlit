import streamlit as st
from streamlit.js_number import JSNumber

value = st.slider("Slider: int54", min_value=JSNumber.MIN_SAFE_INTEGER, max_value=JSNumber.MAX_SAFE_INTEGER)
st.write(f"[value={value}")

value = st.slider("Slider: float", min_value=JSNumber.MIN_NEGATIVE_VALUE, max_value=JSNumber.MAX_VALUE)
st.write(f"[value={value}")

value = st.number_input("Input: int54", min_value=JSNumber.MIN_SAFE_INTEGER, max_value=JSNumber.MAX_SAFE_INTEGER)
st.write(f"[value={value}")

value = st.number_input("Input: float", min_value=JSNumber.MIN_NEGATIVE_VALUE, max_value=JSNumber.MAX_VALUE)
st.write(f"[value={value}")
