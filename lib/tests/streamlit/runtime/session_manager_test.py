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

import unittest
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized

from streamlit.runtime.session_manager import SessionManager


class UnimplementedSessionManager(SessionManager):
    pass


class MinimalSessionManager(SessionManager):
    def __init__(self, _session_storage, _runtime):
        pass

    def connect_session(self, _client, _user_info, _existing_session_id):
        return "my_session_id"

    def close_session(self, _session_id):
        pass

    def get_session_info(self, _session_id):
        return None

    def list_sessions(self):
        return []


class SessionManagerProtocolTests(unittest.TestCase):
    def test_unimplemented_session_manager_explodes(self):
        with pytest.raises(TypeError):
            UnimplementedSessionManager()

    def test_instantiate_minimal_session_manager(self):
        MinimalSessionManager(MagicMock(), MagicMock())

    @parameterized.expand(
        [
            ("disconnect_session", "close_session", "session_id"),
            ("get_active_session_info", "get_session_info", "session_id"),
            ("is_active_session", "get_active_session_info", "session_id"),
            ("list_active_sessions", "list_sessions", None),
            ("num_active_sessions", "list_active_sessions", None),
        ]
    )
    def test_session_manager_default_methods(
        self, active_session_method_name, default_impl_method_name, arg
    ):
        session_mgr = MinimalSessionManager(MagicMock(), MagicMock())

        # Spy on the method called in the active session version's default
        # implementation.
        with patch.object(
            session_mgr,
            default_impl_method_name,
            wraps=getattr(session_mgr, default_impl_method_name),
        ) as patched_method:
            # Call the active session version of the method.
            method = getattr(session_mgr, active_session_method_name)
            if arg is not None:
                method(arg)
            else:
                method()

            # Verify that we fell back to the default implementation.
            patched_method.assert_called()
