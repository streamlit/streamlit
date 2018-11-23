# -*- coding: future_fstrings -*-

"""Runs all the scripts in the examples folder (except this one)."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())


import os
import sys
import time
import streamlit as st

# Where we expect to find the example files.
EXAMPLE_DIR = 'examples'

# These are all the files we excliude
EXCLUDED_FILENAMES = (
    # Exclude mnist becuase it takes so long to run.
    'mnist-cnn.py',

    # Exclude caching because we special case it.
    'caching.py',
)

st.title('Running All Examples')

st.header('Important Note')

st.warning("""
    We are not testing `streamlit kill_proxy` because it would mess with this
    test.
""")

st.header('Running Commands')

def run_commands(section_header, commands):
    """Run a list of commands, displaying them within the given section."""
    st.subheader(section_header)
    for command in commands:
        st.text(command)
        print(f'Running `{command}`...')
        st.write('- Running...')

        os.system(command)
        st.write('- **Done.**')

# First run the 'streamlit commands'
run_commands('Basic Commands', [
    'streamlit version',
    'streamlit help'
])

run_commands('Examples', [
    f'streamlit run examples/{filename}'
        for filename in os.listdir(EXAMPLE_DIR)
        if filename.endswith('.py') and filename not in EXCLUDED_FILENAMES
])

run_commands('Caching', [
    'streamlit clear_cache',
    'streamlit run examples/caching.py'
])

run_commands('MNIST', [
    'streamlit run examples/mnist-cnn.py'
])
