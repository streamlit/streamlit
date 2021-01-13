import streamlit as st

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
    # textinput_val = st.text_input("text_input")
    # textarea_val = st.text_area("text_area")
st.write("slider:", slider_val)

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
