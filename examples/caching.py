import streamlit as st
import random


scope = {
    'num_executions': 0,
    'need_to_clear_cache': True,
}


@st.cache
def check_if_cached():
    scope['need_to_clear_cache'] = False


@st.cache
def my_func(arg1, arg2=None, *args, **kwargs):
    scope['num_executions'] += 1
    return random.randint(0, 2^32)


check_if_cached()

if scope['need_to_clear_cache']:
    st.warning('You must clear your cache before you run this script!')
else:
    st.subheader('Test that basic caching works')
    before = scope['num_executions']
    v1 = my_func(1, 2, dont_care=10)
    v2 = my_func(1, 2, dont_care=10)
    after = scope['num_executions']
    if after == before + 1:
        st.write('OK')
    else:
        st.write('Fail')

    st.subheader('Test that when you change arguments it\'s a cache miss')
    before = scope['num_executions']
    v = my_func(10, 2, dont_care=10)
    after = scope['num_executions']
    if after == before + 1:
        st.write('OK')
    else:
        st.write('Fail')

    st.subheader('Test that when you change **kwargs it\'s a cache miss')
    before = scope['num_executions']
    v = my_func(10, 2, dont_care=100)
    after = scope['num_executions']
    if after == before + 1:
        st.write('OK')
    else:
        st.write('Fail')

    st.subheader('Test that you can turn off caching')
    before = scope['num_executions']
    st.set_config(client_caching=False)
    v = my_func(1, 2, dont_care=10)
    after = scope['num_executions']
    if after == before + 1:
        st.write('OK')
    else:
        st.write('Fail')

    st.subheader('Test that you can turn on caching')
    before = scope['num_executions']
    st.set_config(client_caching=True)
    v1 = my_func(1, 2, dont_care=10)
    v2 = my_func(1, 2, dont_care=10)
    after = scope['num_executions']
    if after == before:
        st.write('OK')
    else:
        st.write('Fail')

