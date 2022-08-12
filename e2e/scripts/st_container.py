import streamlit as st

container = st.container()

st.write("Line 1")
container.write("Line 2")
with container:
    "Line 3"
st.write("Line 4")

# Ensure widget states persist when React nodes shift
if st.button("Step 2: Press me"):
    st.header("Pressed!")
c = st.container()
if c.checkbox("Step 1: Check me"):
    c.title("Checked!")
