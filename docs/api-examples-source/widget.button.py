import streamlit as st

with st.echo():
    say_hello = st.button('Click me')
    if say_hello:
      st.write('Why hello there')
