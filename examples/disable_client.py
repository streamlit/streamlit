import streamlit as st

# DISABLED
st.set_config({'client.enabled': False})

st.text('This should not appear')

# ENABLED
st.set_config({'client.enabled': True})

st.warning('IMPORTANT: Make sure you get a streamlit.config.Error in the terminal!')

a = st.text('This will be overwritten')
b = st.text('This will be overwritten too')
a.text('This should show up first')

# DISABLED
st.set_config({'client.enabled': False})

b.text('This overwrites b, but should not appear')
st.write('This should not appear')
st.line_chart([1, 2, 3, 4])

with st.echo():
    foo = 'Nothing matters in here!'
    st.write('Nothing here will appear')

# ENABLED
st.set_config({'client.enabled': True})  # This causes an exception.

st.write('This should appear last')
b.text('This should appear second')
