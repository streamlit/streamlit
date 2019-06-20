import streamlit as st

st.title('Interactive Widgets')

st.subheader('Checkbox')
w1 = st.checkbox('I am human', True)
st.write(w1)

st.subheader('Slider')
# TODO: when you change a value to a range of values
# the widget doesn't get updated
w2 = st.slider('Age', 32.5, 0.5, 100.5, .5)
st.write(w2)

st.subheader('Textarea')
w3 = st.text_area('Comments', 'Streamlit is awesomeness!')
st.write(w3)

st.subheader('Button')
w4 = st.button('Click me')
st.write(w4)

if w4:
    st.write('Hello, Interactive Streamlit!')
