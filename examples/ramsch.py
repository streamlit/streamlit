import streamlit as st
import time

c = st.Cache()
if c:
    time.sleep(1)
    c.value = {'a': 42}

c.value['a'] = 12

st.write(c.value)
