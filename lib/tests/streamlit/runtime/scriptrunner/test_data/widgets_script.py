"""A script for ScriptRunnerTest that uses widgets"""

import time

import streamlit as st

# IMPORTANT: ScriptRunner_test.py expects this file to produce 8 deltas + a
# 1-delta loop. If you change this, please change that file too.

checkbox = st.checkbox("checkbox", False)
st.text("%s" % checkbox)

text_area = st.text_area("text_area", "ahoy!")
st.text("%s" % text_area)

radio = st.radio("radio", ("0", "1", "2"), 0)
st.text("%s" % radio)

button = st.button("button")
st.text("%s" % button)

# Loop forever so that our test can check widget states
# without the scriptrunner shutting down.
placeholder = st.text("loop_forever")
while True:
    time.sleep(0.1)
    placeholder.text("loop_forever")
