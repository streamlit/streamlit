import streamlit as st

with st.form("test", clear_on_submit=True):
    st.code(
        """clear_on_submit=True.
- On submit: submitted=True, text='submitted', text_input='default'
- On re-run: submitted=False, text='submitted', text_input='default'
    """
    )
    text_input = st.text_input("text_input", value="default", key="text")
    checkbox = st.checkbox("checkbox", value=False, key="checkbox")
    color_picker = st.color_picker("colorpicker", value="#000000")
    date_input = st.date_input("date_input")
    file_uploader = st.file_uploader("file_uploader", accept_multiple_files=True)
    multiselect = st.multiselect(
        "multiselect", ["one", "two", "three"], default=["two"]
    )
    number_input = st.number_input("number_input", min_value=5, max_value=10, value=7)
    radio = st.radio("radio", ["one", "two", "three"], index=1)

    submitted = st.form_submit_button()
    st.write(
        f"""
        submitted=`{submitted}`
        \ntext_input=`{text_input}`
        \ncheckbox=`{checkbox}`
        \ncolorpicker=`{color_picker}`
        \ndate_input=`{date_input}`
        \nfile_uploader=`{file_uploader}`
        \nmultiselect=`{multiselect}`
        \nnumber_input=`{number_input}`
        \nradio=`{radio}`
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
