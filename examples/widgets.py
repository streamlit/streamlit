import pandas as pd
import numpy as np
import streamlit as st

st.title('Interactive Widgets')

st.subheader('Checkbox')
w1 = st.checkbox('I am human', True)
st.write(w1)

if w1:
    st.write('Agreed')

st.subheader('Slider')
w2 = st.slider('Age', [32.5, 72.5], 0, 100, 0.5)
st.write(w2)

st.subheader('Textarea')
w3 = st.text_area('Comments', 'Streamlit is awesomeness!')
st.write(w3)

st.subheader('Button')
w4 = st.button('Click me')
st.write(w4)

if w4:
    st.write('Hello, Interactive Streamlit!')

st.subheader('Radio')
options = ('female', 'male')
w5 = st.radio('Gender', options, 1)
st.write(options[w5])

st.subheader('Text input')
w6 = st.text_input('Text input widget', 'i iz input')
st.write(w6)

st.subheader('Selectbox')
options = ('first', 'second')
w7 = st.selectbox('Options', options, 1)
st.write(options[w7])

st.subheader('Time')
w8 = st.time('Set an alarm for', '12:00')
st.write(w8)

st.subheader('Date')
w9 = st.date('A date to celebrate', '2019/06/24')
st.write(w9)
