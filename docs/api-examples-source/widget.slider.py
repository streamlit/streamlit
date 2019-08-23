import streamlit as st

st.subheader('Slider')
with st.echo():
    age = st.slider('How old are you?', 25, 0, 130)
    st.write('I\'m ', age, 'years old.' )

st.subheader('Range slider')
with st.echo():
    values = st.slider('Select a range of values', (25.0, 75.0), 0.0, 100.0, 1.0)
    st.write("Values:", values)
