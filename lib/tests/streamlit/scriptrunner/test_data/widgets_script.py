"""A script for ScriptRunnerTest that uses widgets"""

import time

import streamlit as st

checkbox = st.checkbox('checkbox', False)
st.text('%s' % checkbox)

text_area = st.text_area('text_area', 'ahoy!')
st.text('%s' % text_area)

radio = st.radio('radio', ('0', '1', '2'), 0)
st.text('%s' % radio)

button = st.button('button')
st.text('%s' % button)

# Loop forever so that our test can check widget states
# without the scriptrunner shutting down.
placeholder = st.empty()
while True:
    time.sleep(0.01)
    placeholder.text('loop_forever')
