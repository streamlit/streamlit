import streamlit as st
from webcam import webcam

st.title("st.form")

"## Basic"
with st.beta_form():
    # color_val = st.color_picker("color")
    # file = st.file_uploader("file")
    # multiselect_val = st.multiselect("multiselect", ["foo", "bar", "baz"])
    # number_val = st.number_input("number")
    # radio_val = st.radio("radio", ["floo", "blar", "blaz"])
    # selectslider_val = st.select_slider("select_slider", ["red", "yeller", "blue"])
    # selectbox_val = st.selectbox("selectbox", ["choco", "vanilli", "berry"])
    slider_val = st.slider("slider")
    textinput_val = st.text_input("text_input")
    textarea_val = st.text_area("text_area")
st.write(
    "slider:",
    slider_val,
    "textinput:",
    f"`{textinput_val}`",
    "textarea:",
    f"`{textarea_val}`",
)

"---"
"## Forms-in-columns"
col1, col2 = st.beta_columns(2)
with col1:
    with st.beta_form(key="form.col1"):
        slider_val = st.slider("slider", key="slider.col1")
    st.write("slider:", slider_val)
with col2:
    with st.beta_form(key="form.col2"):
        slider_val = st.slider("slider", key="slider.col2")
    st.write("slider:", slider_val)

"---"
"## Columns-in-forms"
with st.beta_form(key="columns-in-forms"):
    col1, col2 = st.beta_columns(2)
    with col1:
        slider_val1 = st.slider("slider", key="slider.column-in-form1")
    with col2:
        slider_val2 = st.slider("slider", key="slider.column-in-form2")
st.write("sliders:", slider_val1, slider_val2)

"---"
"## Custom Component"
if st.button("Custom Component"):
    with st.beta_form(key="custom_component"):
        captured_image = webcam()
    if captured_image is None:
        st.write("Waiting for capture...")
    else:
        st.image(captured_image)

"---"
"## Errors"
if st.button("Button-in-form"):
    with st.beta_form(key="button-in-form"):
        st.button("nope!")

if st.button("Form-in-form"):
    with st.beta_form(key="Form-in-form"):
        st.beta_form(key="nope again!")

if st.button("Uploader-in-form"):
    with st.beta_form(key="Uploader-in-form"):
        st.file_uploader("Uploader", key="nope x3")


# st.markdown("---")
#
# st.header("Submitted values:")
#
# st.write("checkbox:", checkbox_val)
# st.write("color:", color_val)
# st.write("multiselect:", ",".join(multiselect_val))
# st.write("number:", number_val)
# st.write("radio:", radio_val)
# st.write("select_slider:", selectslider_val)
# st.write("selectbox:", selectbox_val)
# st.write("slider:", slider_val)
# st.write("text_input:", textinput_val)
# st.write("text_area:", textarea_val)
