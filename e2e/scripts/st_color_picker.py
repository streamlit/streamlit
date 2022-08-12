import streamlit as st

c1 = st.color_picker("Default Color")
st.write("Color 1", c1)

c2 = st.color_picker("New Color", "#EB144C")
st.write("Color 2", c2)

c3 = st.color_picker("Disabled", disabled=True)
st.write("Color 3", c3)

c4 = st.color_picker("Hidden Label", label_visibility="hidden")
st.write("Color 4", c4)

c5 = st.color_picker("Collapsed Label", label_visibility="collapsed")
st.write("Color 5", c5)
