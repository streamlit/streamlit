# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

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
    return random.randint(0, 2 ** 32)


check_if_cached()

if cache_was_hit:
    st.warning('You must clear your cache before you run this script!')
    st.write('''
        To clear the cache, press `C` then `Enter`. Then press `R` on this page
        to rerun.
    ''')
else:
    st.warning('''
        IMPORTANT: You should test rerunning this script (to get a failing
        test), then clearing the cache with the `C` shortcut and checking that
        the test passes again.
    ''')

    st.subheader('Test that basic caching works')
    before = num_executions
    v1 = my_func(1, 2, dont_care=10)
    v2 = my_func(1, 2, dont_care=10)
    after = num_executions
    if after == before + 1:
        st.success('OK')
    else:
        st.error('Fail')

    st.subheader('Test that when you change arguments it\'s a cache miss')
    before = num_executions
    v = my_func(10, 2, dont_care=10)
    after = num_executions
    if after == before + 1:
        st.success('OK')
    else:
        st.error('Fail')

    st.subheader('Test that when you change **kwargs it\'s a cache miss')
    before = num_executions
    v = my_func(10, 2, dont_care=100)
    after = num_executions
    if after == before + 1:
        st.success('OK')
    else:
        st.error('Fail')

    st.subheader('Test that you can turn off caching')
    before = num_executions
    config.set_option('client.caching', False)
    v = my_func(1, 2, dont_care=10)
    after = num_executions
    if after == before + 1:
        st.success('OK')
    else:
        st.error('Fail')

    st.subheader('Test that you can turn on caching')
    config.set_option('client.caching', True)

    # Redefine my_func because the st.cache-decorated function "remembers" the
    # config option from when it was declared.
    @st.cache
    def my_func(arg1, arg2=None, *args, **kwargs):
        global num_executions
        num_executions += 1
        return random.randint(0, 2 ** 32)

    v1 = my_func(1, 2, dont_care=10)
    before = num_executions
    v2 = my_func(1, 2, dont_care=10)
    after = num_executions
    if after == before:
        st.success('OK')
    else:
        st.error('Fail')
