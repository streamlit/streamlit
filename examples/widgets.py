import streamlit as st

st.title('Interactive Widgets')

st.subheader('Checkbox')
w1 = st.checkbox('I am human', True)
st.write(w1)

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
w5 = st.radio('radio widget', '1', [('1', 'first'), ('2', 'second')])
st.write(w5)

st.subheader('Input')
w6 = st.input('input widget', 'i iz input')
st.write(w6)

st.subheader('Select')
w7 = st.select('select widget', '1', [('1', 'first'), ('2', 'second')])
st.write(w7)
