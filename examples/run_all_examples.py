"""
Runs all the scripts in the examples folder (except this one).
"""

import os
import sys
import time
import streamlit as st

# Where we expect to find the example files.
EXAMPLE_DIR = 'examples'

# Exclude this file from being run.
THIS_FILENAME = os.path.split(sys.argv[0])[1]

# Run all the files in the EXAMPLE_DIR directory
st.title('Running All Examples')

for filename in os.listdir(EXAMPLE_DIR):
    if filename == THIS_FILENAME or not filename.endswith('.py'):
        continue
    filename = os.path.join(EXAMPLE_DIR, filename)
    st.write('Running `%s`...' % filename)
    if filename in ['examples/mnist-cnn.py']:
        st.write('**Excluding %s.**' % filename)
        continue
    else:
        os.system('python %s' % filename)
        st.write('Done.')
st.success('Ran all examples files....')
st.balloons()
