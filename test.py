import streamlit as st

st.title("st.form")

with st.beta_form():
    checkbox_val = st.checkbox("checkbox")
    color_val = st.color_picker("color")
    # file = st.file_uploader("file")
    multiselect_val = st.multiselect("multiselect", ["foo", "bar", "baz"])
    number_val = st.number_input("number")
    radio_val = st.radio("radio", ["floo", "blar", "blaz"])
    selectslider_val = st.select_slider("select_slider", ["red", "yeller", "blue"])
    selectbox_val = st.selectbox("selectbox", ["choco", "vanilli", "berry"])
    slider_val = st.slider("slider")
    textinput_val = st.text_input("text_input")
    textarea_val = st.text_area("text_area")

st.markdown("---")

st.header("Submitted values:")

st.write("checkbox:", checkbox_val)
st.write("color:", color_val)
st.write("multiselect:", ",".join(multiselect_val))
st.write("number:", number_val)
st.write("radio:", radio_val)
st.write("select_slider:", selectslider_val)
st.write("selectbox:", selectbox_val)
st.write("slider:", slider_val)
st.write("text_input:", textinput_val)
st.write("text_area:", textarea_val)
