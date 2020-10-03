import streamlit as st

with st.beta_container():
    st.write("This is inside the container")

    # You can call any Streamlit command, including custom components:
    st.line_chart({"data": [1, 5, 2, 6]})
st.write("This is outside the container")
