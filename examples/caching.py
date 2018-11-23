import streamlit as st
from streamlit import config
import random


num_executions = 0
cache_was_hit = True


@st.cache
def check_if_cached():
    global cache_was_hit
    cache_was_hit = False


@st.cache
def my_func(arg1, arg2=None, *args, **kwargs):
    global num_executions
    num_executions += 1
    return random.randint(0, 2^32)


check_if_cached()

if cache_was_hit:
    st.warning('You must clear your cache before you run this script!')
    st.write('''
        Use the command below to clear the cache:
        ```
        streamlit clear_cache
        ```
        ...and then press `R` on this page to rerun.
    ''')
else:
    st.subheader('Test that basic caching works')
    before = num_executions
    v1 = my_func(1, 2, dont_care=10)
    v2 = my_func(1, 2, dont_care=10)
    after = num_executions
    if after == before + 1:
        st.write('OK')
    else:
        st.write('Fail')

    st.subheader('Test that when you change arguments it\'s a cache miss')
    before = num_executions
    v = my_func(10, 2, dont_care=10)
    after = num_executions
    if after == before + 1:
        st.write('OK')
    else:
        st.write('Fail')

    st.subheader('Test that when you change **kwargs it\'s a cache miss')
    before = num_executions
    v = my_func(10, 2, dont_care=100)
    after = num_executions
    if after == before + 1:
        st.write('OK')
    else:
        st.write('Fail')

    st.subheader('Test that you can turn off caching')
    before = num_executions
    config.set_option('client.caching', False)
    v = my_func(1, 2, dont_care=10)
    after = num_executions
    if after == before + 1:
        st.write('OK')
    else:
        st.write('Fail')

    st.subheader('Test that you can turn on caching')
    before = num_executions
    config.set_option('client.caching', True)
    v1 = my_func(1, 2, dont_care=10)
    v2 = my_func(1, 2, dont_care=10)
    after = num_executions
    if after == before:
        st.write('OK')
    else:
        st.write('Fail')
