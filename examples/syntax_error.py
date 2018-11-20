# -*- coding: future_fstrings -*-

import streamlit as st

st.title('Syntax error test')

st.info('''
    Uncomment the lines below and save this file. You should see a syntax error
    when Streamlit reruns the script.
''')

st.write('(Some top text)')

# Uncomment this as a block:
#st.write('You should see an inline exception below:')
#a = not_a_real_variable

# Uncomment this as a block:
#st.write('You should see a fullscreen exception:')
#if True  # missing semicolon

st.write('(Some bottom text)')

