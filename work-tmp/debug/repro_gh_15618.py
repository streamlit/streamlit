"""
Reproduction for GitHub Issue #15618
https://github.com/streamlit/streamlit/issues/15618

Expected: Selecting the second option in the selectbox keeps that selection
Actual:   selectbox always reverts to the first option when format_func is used
          with dataclass/plain-class options and the format_func does a dict lookup
"""
import streamlit as st
from dataclasses import dataclass

st.header("Issue #15618: selectbox reverts with format_func + custom classes")

@dataclass(frozen=True)
class MyDataClass:
    id: int
    name: str

a = MyDataClass(1, "one")
b = MyDataClass(2, "two")
x = {a: "I", b: "II"}

def format_function(s):
    print(x[s])
    return s.name

s = st.selectbox("selectbox", [a, b], format_func=format_function)
st.write(f"Selected: {s.name}")
