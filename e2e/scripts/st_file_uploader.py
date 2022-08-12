import streamlit as st

single_file = st.file_uploader("Drop a file:", type=["txt"], key="single")
if single_file is None:
    st.text("No upload")
else:
    st.text(single_file.read())

# Here and throughout this file, we use if st._is_running_with_streamlit:
# since we also run e2e python files in "bare Python mode" as part of our
# Python tests, and this doesn't work in that circumstance
# st.session_state can only be accessed while running with streamlit
if st._is_running_with_streamlit:
    st.write(repr(st.session_state.single) == repr(single_file))

disabled = st.file_uploader(
    "Can't drop a file:", type=["txt"], key="disabled", disabled=True
)
if disabled is None:
    st.text("No upload")
else:
    st.text(disabled.read())

if st._is_running_with_streamlit:
    st.write(repr(st.session_state.disabled) == repr(disabled))

multiple_files = st.file_uploader(
    "Drop multiple files:",
    type=["txt"],
    accept_multiple_files=True,
    key="multiple",
)
if multiple_files is None:
    st.text("No upload")
else:
    files = [file.read().decode() for file in multiple_files]
    st.text("\n".join(files))

if st._is_running_with_streamlit:
    st.write(repr(st.session_state.multiple) == repr(multiple_files))

with st.form("foo"):
    form_file = st.file_uploader("Inside form:", type=["txt"])
    st.form_submit_button("Submit")
    if form_file is None:
        st.text("No upload")
    else:
        st.text(form_file.read())


hidden_label = st.file_uploader(
    "Hidden label:",
    key="hidden_label",
    label_visibility="hidden",
)

if hidden_label is None:
    st.text("No upload")
else:
    st.text(hidden_label.read())

if st._is_running_with_streamlit:
    st.write(repr(st.session_state.hidden_label) == repr(hidden_label))

collapsed_label = st.file_uploader(
    "Collapsed label:",
    key="collapsed_label",
    label_visibility="collapsed",
)

if collapsed_label is None:
    st.text("No upload")
else:
    st.text(collapsed_label.read())

if st._is_running_with_streamlit:
    st.write(repr(st.session_state.collapsed_label) == repr(collapsed_label))

if st._is_running_with_streamlit:
    if not st.session_state.get("counter"):
        st.session_state["counter"] = 0

    def file_uploader_on_change():
        st.session_state.counter += 1

    st.file_uploader(
        "Drop a file:",
        type=["txt"],
        key="on_change_file_uploader_key",
        on_change=file_uploader_on_change,
    )

    st.text(st.session_state.counter)
