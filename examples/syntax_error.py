# -*- coding: future_fstrings -*-

import streamlit as st

st.title('Syntax error test')

st.write('''
    Uncomment the lines below and save this file. You should see a syntax error
    when Streamlit autoruns this file.
''')

#st.error('yeah!')

st.text('1')

# Try this line:
#a = not_a_real_variable

# Then try this other line:
#if True  # missing semicolon

st.text('2')
