import threading
import time

import streamlit as st

session_id = st.experimental_get_session_id()


def do_a_rerun():
    st.experimental_rerun(session_id)


@st.cache(allow_output_mutation=True)
def rerun_record():
    return [0]


count = rerun_record()
count[0] += 1

# First three reruns occur within a thread
if count[0] < 4:
    thread = threading.Thread(target=do_a_rerun, name=f"test_rerun_number_{count[0]}")
    thread.start()
    thread.join()

    st.stop()

# Two reruns occur within the main streamlit script
elif count[0] < 6:
    st.experimental_rerun()

if count[0] >= 6:
    st.text("Being able to rerun a session within a thread is awesome!")
