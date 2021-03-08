import streamlit as st
import datetime

with st.beta_form():
    checkbox = st.checkbox("Checkbox", False)
    color_picker = st.color_picker("Color Picker")
    date_input = st.date_input("Date Input", datetime.date(2019, 7, 6))
    multiselect = st.multiselect("Multiselect", ["foo", "bar"], default=["foo"])
    number_input = st.number_input("Number Input")
    radio = st.radio("Radio", ["foo", "bar", "baz"])
    selectbox = st.selectbox("Selectbox", ["foo", "bar", "baz"])
    select_slider = st.select_slider("Select Slider", ["foo", "bar", "baz"])
    slider = st.slider("Slider")
    text_area = st.text_area("Text Area", value="foo")
    text_input = st.text_input("Text Input", value="foo")
    time_input = st.time_input("Time Input", datetime.time(8, 45))

"Checkbox:", checkbox
"Color Picker:", color_picker
"Date Input:", date_input
"Multiselect:", ", ".join(multiselect)
"Number Input:", number_input
"Radio:", radio
"Selectbox:", selectbox
"Select Slider:", select_slider
"Slider:", slider
"Text Area:", text_area
"Text Input:", text_input
"Time Input:", time_input
