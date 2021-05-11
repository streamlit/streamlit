import datetime

import streamlit as st

with st.form("test", clear_on_submit=True):
    st.code(
        """clear_on_submit=True.
- On submit: submitted=True, text='submitted', text_input='default'
- On re-run: submitted=False, text='submitted', text_input='default'
    """
    )
    checkbox = st.checkbox("checkbox", value=False, key="checkbox")
    color_picker = st.color_picker("colorpicker", value="#000000")
    date_input = st.date_input("date_input")
    file_uploader = st.file_uploader("file_uploader", accept_multiple_files=True)
    multiselect = st.multiselect(
        "multiselect", ["one", "two", "three"], default=["two"]
    )
    number_input = st.number_input("number_input", min_value=5, max_value=10, value=7)
    radio = st.radio("radio", ["one", "two", "three"], index=1)
    selectbox = st.selectbox("selectbox", ["one", "two", "three"], index=1)
    slider = st.slider("slider", min_value=1, max_value=100, value=3)
    text_area = st.text_area("text_area", value="default", key="text")
    text_input = st.text_input("text_input", value="default", key="text")
    time_input = st.time_input("time_input", value=datetime.time(8, 45))

    submitted = st.form_submit_button()
    st.write(
        f"""
        submitted=`{submitted}`
        \ncheckbox=`{checkbox}`
        \ncolorpicker=`{color_picker}`
        \ndate_input=`{date_input}`
        \nfile_uploader=`{file_uploader}`
        \nmultiselect=`{multiselect}`
        \nnumber_input=`{number_input}`
        \nradio=`{radio}`
        \nselectbox=`{selectbox}`
        \nslider=`{slider}`
        \ntext_area=`{text_area}`
        \ntext_input=`{text_input}`
        \ntime_input=`{time_input}`
        """
    )

# with st.form("test2", clear_on_submit=False):
#     st.code(
#         """clear_on_submit=False.
# - On submit: submitted=True, text='submitted', text_input='submitted'
# - On re-run: submitted=False, text='submitted', text_input='submitted'
#     """
#     )
#     text = st.text_input("text_input", f"default", key="text2")
#     submitted = st.form_submit_button()
#     st.write(f"submitted=`{submitted}`, text=`{text}`")
