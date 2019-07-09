import streamlit as st

w1 = st.slider('Label 1', 25, 0, 100, 1)
st.write('Value 1:', w1)

w2 = st.slider('Label 2', (25.0, 75.0), 0.0, 100.0, 0.5)
st.write('Value 2:', w2)
