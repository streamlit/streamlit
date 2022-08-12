import streamlit as st

expander = st.expander("Collapse me!", expanded=True)
expander.write("I can collapse")
expander.slider("I don't get cut off")
expander.button("I'm also not cut off (while focused)")

collapsed = st.expander("Expand me!")
collapsed.write("I am already collapsed")

sidebar = st.sidebar.expander("Expand me!")
sidebar.write("I am in the sidebar")
