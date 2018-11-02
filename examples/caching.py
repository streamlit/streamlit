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
    st.subheader('Test 1')
    v1 = my_func(1, 2, dont_care=10)
    v2 = my_func(1, 2, dont_care=10)
    if v1 == v2 and scope['num_executions'] == 1:
        st.write('OK')
    else:
        st.write('Fail')

    st.subheader('Test 2')
    v = my_func(10, 2, dont_care=10)
    if v != v1 and scope['num_executions'] == 2:
        st.write('OK')
    else:
        st.write('Fail')

    st.subheader('Test 3')
    v = my_func(10, 2, dont_care=100)
    if v != v1 and scope['num_executions'] == 3:
        st.write('OK')
    else:
        st.write('Fail')

    st.subheader('Test 4')
    st.set_config(client_caching=False)
    v = my_func(1, 2, dont_care=10)
    if v != v1 and scope['num_executions'] == 4:
        st.write('OK')
    else:
        st.write('Fail')
