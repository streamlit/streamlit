import streamlit as st
from copy import deepcopy
import time
import functools

@st.cache
def my_func():
    return 2

# @st.cache(ignore_hash=True)
@st.cache
# @st.cache(persist=True)
def my_function(x=42):
    time.sleep(2)

    return {
        'a': my_func()
    }

# value = st.cache(my_function)()

value = my_function(12)

value = deepcopy(value)

st.write(value)

# mess with return value
value['b'] = 12

st.write(value)
