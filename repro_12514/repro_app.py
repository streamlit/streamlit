import streamlit as st
from streamlit.runtime.scriptrunner_utils.script_run_context import ThreadState

A_ID_FILE = "/workspace/work-tmp/a_fragment_id.txt"


@st.fragment  # Has to be a fragment.
def a():
    # Capture parent fragment a's id (only exists during a's execution).
    fid = ThreadState.get().fragment_id
    if fid:
        with open(A_ID_FILE, "w") as f:
            f.write(fid)
    st.button("Rerender `a()`")
    container = st.container()
    with container:
        b(1)
    with container:  # Has to be a separate `with`.
        b(2)


@st.fragment  # Has to be a fragment.
def b(i: int):
    st.markdown(i)


a()
