import threading
import time

import streamlit as st


def get_session_id():
    ctx = st.report_thread.get_report_ctx()
    session_id = ctx.session_id

    return session_id


def rerun(session_id=None):
    if session_id is None:
        session_id = get_session_id()

    server = st.server.server.Server.get_current()
    session = server._get_session_info(  # pylint: disable = protected-access
        session_id
    ).session

    session.request_rerun()


session_id = get_session_id()


def do_a_rerun():
    rerun(session_id)


@st.cache(allow_output_mutation=True)
def rerun_record():
    return [0]


count = rerun_record()
count[0] += 1

if count[0] < 4:
    thread = threading.Thread(target=do_a_rerun, name="test_rerun")
    thread.start()
    thread.join()

    st.stop()

elif count[0] < 6:
    rerun()

st.text(str(count[0]))
