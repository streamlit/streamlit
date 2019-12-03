import streamlit as st

placeholder = st.empty()
inp = st.text_input(label="chat", value="")

if inp:
    user_says = user_says + inp
    placeholder.button(label=user_says)            # text_area(user_says)

