import streamlit as st

st.title('Interactive Widgets')

a = """
st.subheader('Checkbox')
w1 = st.checkbox('I am human', True)
st.write(w1)

st.subheader('Slider')
w2 = st.slider('Age', 32, 0, 100, 1)
st.write(w2)

st.subheader('Textarea')
w3 = st.text_area('Comments', 'Streamlit is awesomeness!')
st.write(w3)
"""

st.subheader('Buttonn')
w4 = st.button('Click me')
st.write(w4)

if w4:
    st.text('yo yo')
