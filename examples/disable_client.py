import streamlit as st

a = st.text('This should not appear')
b = st.text('This should show up second')
a.text('This should show up first')

st.warning('IMPORTANT: Make sure you get a streamlit.config.Error in the terminal!')

st.set_config({'client.enabled': False})  # This causes an exception.

b.text('This should not appear')
st.write('This should not appear')
st.line_chart([1, 2, 3, 4])

with st.echo():
    foo = 'Nothing matters in here!'
    st.write('Nothing here will appear')

st.set_config({'client.enabled': True})
