import streamlit as st

options = ('female', 'male')
i1 = st.radio('radio 1', options, 1)
st.write('value 1:', i1)

i2 = st.radio('radio 2', options, 0, format_func=lambda x: x.capitalize())
st.write('value 2:', i2)

i3 = st.radio('radio 3', options)
st.write('value 3:', i3)
