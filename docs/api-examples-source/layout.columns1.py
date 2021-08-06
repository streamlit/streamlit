import streamlit as st

col1, col2, col3 = st.columns(3)

with col1:
    st.header("A cat")
    st.image("https://static.streamlit.io/examples/cat.jpg")
    st.markdown("By [@phonvanna](https://unsplash.com/photos/0g7BJEXq7sU)")


with col2:
    st.header("A dog")
    st.image("https://static.streamlit.io/examples/dog.jpg")
    st.markdown("By [@shotbyrain](https://unsplash.com/photos/rmkIqi_C3cA)")


with col3:
    st.header("An owl")
    st.image("https://static.streamlit.io/examples/owl.jpg")
    st.markdown("By [@zmachacek](https://unsplash.com/photos/ZN4CzqizIyI)")
