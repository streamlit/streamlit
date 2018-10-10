import streamlit as st
from random import random
import os
import time

st.title('Test of run-on-save')

st.write('This should change every few seconds: ', random())

with open(__file__, 'a') as f:
    status = st.text('Sleeping 1s...')
    time.sleep(1)
    status.text('Touching %s' % __file__)
    os.utime(os.path.realpath(__file__), None)
