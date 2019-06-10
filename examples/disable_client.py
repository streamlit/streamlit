import streamlit as st

# DISABLED
st.set_option('client.displayEnabled', False)

st.text('This should not appear')

# ENABLED
st.set_option('client.displayEnabled', True)

a = st.text('This will be overwritten')
b = st.text('This will be overwritten too')
a.text('This should show up first')

# DISABLED
st.set_option('client.displayEnabled', False)

b.text('This overwrites b, but should not appear')
st.write('This should not appear')
st.line_chart([1, 2, 3, 4])

with st.echo():
    foo = 'Nothing matters in here!'
    st.write('Nothing here will appear')

# ENABLED
st.set_option('client.displayEnabled', True)

st.write('This should appear last')
b.text('This should appear second')
