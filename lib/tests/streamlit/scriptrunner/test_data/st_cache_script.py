# -*- coding: utf-8 -*-
# Copyright 2018-2020 Streamlit Inc.
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

"""A script for ScriptRunnerTest that uses st.cache"""

import streamlit as st

# Except for their names, these functions all intentionally have the same
# bodies - so their ASTs should hash to the same values. However, they should
# *not* share the same caches, because we include a function's qualified
# name in its cache key. To test that this is true, the associated ScriptRunner
# test should run the script twice:
# - On the first run, "cached function called" should be produced 4 times
# - On the second run, "cached function called" should not be produced


@st.cache(suppress_st_warning=True)
def cached1():
    st.text("cached function called")
    return "cached value"


@st.cache(suppress_st_warning=True)
def cached2():
    st.text("cached function called")
    return "cached value"


def outer_func():
    # These closures share the names and bodies of the functions in the outer
    # scope, but they should have their own independent caches.
    @st.cache(suppress_st_warning=True)
    def cached1():
        st.text("cached function called")
        return "cached value"

    @st.cache(suppress_st_warning=True)
    def cached2():
        st.text("cached function called")
        return "cached value"

    cached1()
    cached2()


cached1()
cached2()
outer_func()
