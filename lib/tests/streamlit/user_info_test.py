# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import threading

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.forward_msg_queue import ForwardMsgQueue
from streamlit.runtime.scriptrunner import (
    ScriptRunContext,
    add_script_run_ctx,
    get_script_run_ctx,
)
from streamlit.runtime.state import SafeSessionState, SessionState
from tests.testutil import DeltaGeneratorTestCase


class UserInfoProxyTest(DeltaGeneratorTestCase):
    """Test UserInfoProxy."""

    def test_user_email_attr(self):
        """Test that `st.user.email` returns user info from ScriptRunContext"""
        self.assertEqual(st.experimental_user.email, "test@test.com")

    def test_user_email_key(self):
        self.assertEqual(st.experimental_user["email"], "test@test.com")

    def test_user_non_existing_attr(self):
        """Test that an error is raised when called non existed attr."""
        with self.assertRaises(AttributeError):
            st.write(st.experimental_user.attribute)

    def test_user_non_existing_key(self):
        """Test that an error is raised when called non existed key."""
        with self.assertRaises(KeyError):
            st.write(st.experimental_user["key"])

    def test_user_cannot_be_modified_existing_key(self):
        """
        Test that an error is raised when try to assign new value to existing key.
        """
        with self.assertRaises(StreamlitAPIException) as e:
            st.experimental_user["email"] = "NEW_VALUE"

        self.assertEqual(str(e.exception), "st.experimental_user cannot be modified")

    def test_user_cannot_be_modified_new_key(self):
        """
        Test that an error is raised when try to assign new value to new key.
        """
        with self.assertRaises(StreamlitAPIException) as e:
            st.experimental_user["foo"] = "bar"

        self.assertEqual(str(e.exception), "st.experimental_user cannot be modified")

    def test_user_cannot_be_modified_existing_attr(self):
        """
        Test that an error is raised when try to assign new value to existing attr.
        """
        with self.assertRaises(StreamlitAPIException) as e:
            st.experimental_user.email = "bar"

        self.assertEqual(str(e.exception), "st.experimental_user cannot be modified")

    def test_user_cannot_be_modified_new_attr(self):
        """
        Test that an error is raised when try to assign new value to new attr.
        """
        with self.assertRaises(StreamlitAPIException) as e:
            st.experimental_user.foo = "bar"

        self.assertEqual(str(e.exception), "st.experimental_user cannot be modified")

    def test_user_len(self):
        self.assertEqual(len(st.experimental_user), 1)

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
                    _enqueue=forward_msg_queue.enqueue,
                    query_string="",
                    session_state=SafeSessionState(SessionState()),
                    uploaded_file_mgr=None,
                    page_script_hash="",
                    user_info={"email": "something@else.com"},
                ),
            )

            self.assertEqual(st.experimental_user.email, "something@else.com")
        except Exception as e:
            raise e
        finally:
            add_script_run_ctx(threading.current_thread(), orig_report_ctx)
