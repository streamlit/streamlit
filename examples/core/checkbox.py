import streamlit as st

i1 = st.checkbox('checkbox 1', True)
st.write('value 1:', i1)

i2 = st.checkbox('checkbox 2', False)
st.write('value 2:', i2)

i3 = st.checkbox('checkbox 3')
st.write('value 3:', i3)
