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


@st.cache(suppress_st_warning=True)
def cached_depending_on_not_yet_defined():
    st.text("cached_depending_on_not_yet_defined called")
    return depended_on()


def depended_on():
    return "changed value"


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
cached_depending_on_not_yet_defined()
