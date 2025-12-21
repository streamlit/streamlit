
import streamlit as st

st.set_page_config(page_title="A11y Test Bed")

# Ensure all widget types are present
st.header("Button", divider=True)
st.button("Click Me", key="stButton")

st.header("Checkbox", divider=True)
st.checkbox("Check Me", key="stCheckbox")

st.header("Radio", divider=True)
st.radio("Pick one", ["A", "B", "C"], key="stRadio")

st.header("Selectbox", divider=True)
st.selectbox("Select one", ["Option 1", "Option 2"], key="stSelectbox")

st.header("TextInput", divider=True)
st.text_input("Label", "Value", key="stTextInput")

st.header("Slider", divider=True)
st.slider("Slide me", 0, 100, 50, key="stSlider")
