import streamlit as st
import time

x = 42

c = st.Cache()
if c:
    time.sleep(2)
    c.my_dict = {
        'a': x
    }


st.write(c)

value = c.my_dict

st.write(value)

# mess with return value
# value['b'] = 12

st.write(value)
