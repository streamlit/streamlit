"""A script for ScriptRunnerTest that never ends"""

import time
import streamlit as st

element = st.empty()
while True:
    element.text("loop_forever")
    time.sleep(0.01)
