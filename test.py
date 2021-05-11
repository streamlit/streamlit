import streamlit as st

with st.form("test", clear_on_submit=True):
    st.code(
        """clear_on_submit=True.
- On submit: submitted=True, text='submitted', text_input='default'
- On re-run: submitted=False, text='default', text_input='default'
    """
    )
    text = st.text_input("text_input", f"default", key="text")
    submitted = st.form_submit_button()
    st.write(f"submitted=`{submitted}`, text=`{text}`")

with st.form("test2", clear_on_submit=False):
    st.code(
        """clear_on_submit=False.
- On submit: submitted=True, text='submitted', text_input='submitted'
- On re-run: submitted=False, text='submitted', text_input='submitted'
    """
    )
    text = st.text_input("text_input", f"default", key="text2")
    submitted = st.form_submit_button()
    st.write(f"submitted=`{submitted}`, text=`{text}`")
