import streamlit as st

c1, c2, c3 = st.columns(3)

c1.write("Foo")
c2.write("Bar")
c3.write("Baz")

c1, c2, c3 = st.columns(3)

# We use longer text here because movement should
# be considered a large change in the screenshot comparison
c3.write("Some long text to write")
