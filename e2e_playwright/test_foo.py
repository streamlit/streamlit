import time

import streamlit as st

st.write("Hello")
if st.button("Click me"):
    time.sleep(1)
    st.write("1 and")
    time.sleep(1)
    st.write("2 and")
    time.sleep(1)
    st.write("3 and")

if st.button("Click me 2"):
    time.sleep(1)
    st.write("1 and")
    time.sleep(1)
    st.write("2 and")
    time.sleep(1)
    st.write("3 and")
    time.sleep(3)

else:
    if st.toggle("Toggle", value=True):
        st.text_input("Foo", key="foo")

    st.write("END")
