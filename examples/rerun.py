import streamlit as st
import numpy as np
import sys

try:
    n = int(sys.argv[1])
    st.write('Count to:', n)
    st.write(list(np.arange(n)))
    st.success('The rerun worked!')

except IndexError:
    st.write('## **WARNING:** This script requires an extra step to check!')
    st.error('Please rerun this script (shift+r) and add a nonnegative integer argument.')
