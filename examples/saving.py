# -*- coding: future_fstrings -*-

"""Test saving a Streamlit report."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import streamlit as st
import random

st.subheader('Test Saving')

st.write(f'**Please save this report and check for this number: `{random.randint(0, 2 ** 32)}`.**')
