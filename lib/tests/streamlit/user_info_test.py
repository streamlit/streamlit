import threading

import streamlit as st

from streamlit.forward_msg_queue import ForwardMsgQueue
from streamlit.scriptrunner import (
    add_script_run_ctx,
    get_script_run_ctx,
    ScriptRunContext,
)

from streamlit.state.session_state import SessionState
from tests.testutil import DeltaGeneratorTestCase


class UserInfoProxyTest(DeltaGeneratorTestCase):
    """Test UserInfoProxy."""

    def test_user_email_attr(self):
        """Test that `st.user.email` returns user info from ScriptRunContext"""
        self.assertEqual(st.user.email, "test@test.com")

    def test_user_email_key(self):
        self.assertEqual(st.user["email"], "test@test.com")

    def test_user_non_existing_attr(self):
        """Test that an error is raised when called non existed attr."""
        with self.assertRaises(AttributeError):
            st.write(st.user.attribute)

    def test_user_non_existing_key(self):
        """Test that an error is raised when called non existed key."""
        with self.assertRaises(KeyError):
            st.write(st.user["key"])

    def test_user_len(self):
        self.assertEqual(len(st.user), 1)

    def test_st_user_reads_from_context_(self):
        """Test that st.user reads information from current ScriptRunContext
        And after ScriptRunContext changed, it returns new email
        """
        orig_report_ctx = get_script_run_ctx()

        forward_msg_queue = ForwardMsgQueue()

        try:
            add_script_run_ctx(
                threading.current_thread(),
                ScriptRunContext(
                    session_id="test session id",
                    enqueue=forward_msg_queue.enqueue,
                    query_string="",
                    session_state=SessionState(),
                    uploaded_file_mgr=None,
                    user_info={"email": "something@else.com"},
                ),
            )

            self.assertEqual(st.user.email, "something@else.com")
        except Exception as e:
            raise e
        finally:
            add_script_run_ctx(threading.current_thread(), orig_report_ctx)
