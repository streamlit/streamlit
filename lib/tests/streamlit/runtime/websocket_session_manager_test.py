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

# NOTE: We intentionally neglect to write tests for this class for now as we'll be
# waiting to merge these changes into `develop` until after we finish implementing
# improved websocket reconnects, after which we would have to rewrite all of these tests
# if we were to add some now.

import unittest
from unittest.mock import MagicMock, patch

import pytest

from streamlit.runtime.script_data import ScriptData
from streamlit.runtime.session_manager import SessionStorage
from streamlit.runtime.websocket_session_manager import WebsocketSessionManager


class MockSessionStorage(SessionStorage):
    """A simple SessionStorage implementation used for testing.

    Essentially just a thin wrapper around a dict. This class exists so that we don't
    accidentally have our WebsocketSessionManager tests rely on a real SessionStorage
    implementation.
    """

    def __init__(self):
        self._cache = {}

    def get(self, session_id):
        return self._cache.get(session_id, None)

    def save(self, session_info):
        self._cache[session_info.session.id] = session_info

    def delete(self, session_id):
        del self._cache[session_id]

    def list(self):
        return list(self._cache.values())


@patch(
    "streamlit.runtime.app_session.asyncio.get_running_loop",
    new=MagicMock(),
)
@patch("streamlit.runtime.app_session.LocalSourcesWatcher", new=MagicMock())
@patch("streamlit.runtime.app_session.ScriptRunner", new=MagicMock())
class WebsocketSessionManagerTests(unittest.TestCase):
    def setUp(self):
        self.session_mgr = WebsocketSessionManager(
            session_storage=MockSessionStorage(),
            uploaded_file_manager=MagicMock(),
            message_enqueued_callback=MagicMock(),
        )

    def connect_session(self, existing_session_id=None):
        return self.session_mgr.connect_session(
            client=MagicMock(),
            script_data=ScriptData("/fake/script_path.py", "fake_command_line"),
            user_info={},
            existing_session_id=existing_session_id,
        )

    def test_connect_session(self):
        session_id = self.connect_session()
        session_info = self.session_mgr._active_session_info_by_id[session_id]

        assert session_info.session.id == session_id

    def test_connect_session_on_invalid_session_id(self):
        """Test that connect_session gives us a new session if existing_session_id is invalid."""
        session_id = self.connect_session(existing_session_id="not a valid session")
        session_info = self.session_mgr._active_session_info_by_id[session_id]

        assert session_info.session.id == session_id
        assert session_info.session.id != "not a valid session"

    def test_connect_session_explodes_if_already_connected(self):
        session_id = self.connect_session()

        with pytest.raises(AssertionError):
            self.connect_session(existing_session_id=session_id)

    def test_connect_session_explodes_if_ID_collission(self):
        session_id = self.connect_session()
        with pytest.raises(AssertionError):
            with patch(
                "streamlit.runtime.app_session.uuid.uuid4", return_value=session_id
            ):
                self.connect_session()

    @patch(
        "streamlit.runtime.app_session.AppSession.register_file_watchers",
        new=MagicMock(),
    )
    @patch(
        "streamlit.runtime.app_session.AppSession.disconnect_file_watchers",
        new=MagicMock(),
    )
    def test_disconnect_and_reconnect_session(self):
        session_id = self.connect_session()
        original_session_info = self.session_mgr.get_session_info(session_id)
        original_client = original_session_info.client

        # File watchers are registered on AppSession creation.
        original_session_info.session.register_file_watchers.assert_called_once()

        self.session_mgr.disconnect_session(session_id)

        assert session_id not in self.session_mgr._active_session_info_by_id
        assert session_id in self.session_mgr._session_storage._cache
        original_session_info.session.disconnect_file_watchers.assert_called_once()

        # Call disconnect_session again to verify that disconnect_session is idempotent.
        self.session_mgr.disconnect_session(session_id)

        assert session_id not in self.session_mgr._active_session_info_by_id
        assert session_id in self.session_mgr._session_storage._cache
        original_session_info.session.disconnect_file_watchers.assert_called_once()

        # Reconnect to the existing session.
        reconnected_session_id = self.connect_session(existing_session_id=session_id)
        reconnected_session_info = self.session_mgr.get_session_info(
            reconnected_session_id
        )

        assert reconnected_session_id == session_id
        assert reconnected_session_info.session == original_session_info.session
        assert reconnected_session_info != original_session_info
        assert reconnected_session_info.client != original_client
        # File watchers are registered on AppSession creation and again on AppSession
        # reconnect.
        assert reconnected_session_info.session.register_file_watchers.call_count == 2

    def test_disconnect_session_on_invalid_session_id(self):
        # Just check that no error is thrown.
        self.session_mgr.disconnect_session("nonexistent_session")

    def test_get_active_session_info(self):
        session_id = self.connect_session()

        active_session_info = self.session_mgr.get_active_session_info(session_id)
        assert active_session_info.session.id == session_id

    def test_get_active_session_info_on_invalid_session_id(self):
        assert self.session_mgr.get_active_session_info("nonexistent_session") is None

    def test_get_active_session_info_on_disconnected_session(self):
        session_id = self.connect_session()
        self.session_mgr.disconnect_session(session_id)

        assert self.session_mgr.get_active_session_info(session_id) is None

    def test_is_active_session(self):
        session_id = self.connect_session()
        assert self.session_mgr.is_active_session(session_id)

    def test_is_active_session_on_invalid_session_id(self):
        assert not self.session_mgr.is_active_session("nonexistent_session")

    def test_is_active_session_on_disconnected_session(self):
        session_id = self.connect_session()
        self.session_mgr.disconnect_session(session_id)

        assert not self.session_mgr.is_active_session(session_id)

    def test_list_active_sessions(self):
        session_ids = []
        for _ in range(3):
            session_ids.append(self.connect_session())

        assert [
            s.session.id for s in self.session_mgr.list_active_sessions()
        ] == session_ids

    @patch("streamlit.runtime.app_session.AppSession.shutdown", new=MagicMock())
    def test_close_session_on_active_session(self):
        session_id = self.connect_session()
        session_info = self.session_mgr.get_session_info(session_id)
        self.session_mgr.close_session(session_id)

        assert session_id not in self.session_mgr._active_session_info_by_id
        assert session_id not in self.session_mgr._session_storage._cache
        session_info.session.shutdown.assert_called_once()

    @patch("streamlit.runtime.app_session.AppSession.shutdown", new=MagicMock())
    def test_close_session_on_inactive_session(self):
        session_id = self.connect_session()
        session_info = self.session_mgr.get_session_info(session_id)
        self.session_mgr.disconnect_session(session_id)

        # Sanity check.
        assert not self.session_mgr.is_active_session(session_id)

        self.session_mgr.close_session(session_id)

        assert session_id not in self.session_mgr._active_session_info_by_id
        assert session_id not in self.session_mgr._session_storage._cache
        session_info.session.shutdown.assert_called_once()

    def test_close_session_on_invalid_session_id(self):
        self.session_mgr.close_session("nonexistent_session")

    def test_get_session_info_on_active_session(self):
        session_id = self.connect_session()
        session_info = self.session_mgr.get_session_info(session_id)

        assert session_info.session.id == session_id

    def test_get_session_info_on_inactive_session(self):
        session_id = self.connect_session()
        self.session_mgr.disconnect_session(session_id)

        # Sanity check.
        assert not self.session_mgr.is_active_session(session_id)

        session_info = self.session_mgr.get_session_info(session_id)
        assert session_info.session.id == session_id

    def test_get_session_info_on_invalid_session_id(self):
        assert self.session_mgr.get_session_info("nonexistent_session") is None

    def test_list_sessions(self):
        session_ids = []
        for _ in range(3):
            session_ids.append(self.connect_session())

        self.session_mgr.disconnect_session(session_ids[1])

        # Sanity check.
        assert self.session_mgr.is_active_session(session_ids[0])
        assert not self.session_mgr.is_active_session(session_ids[1])
        assert self.session_mgr.is_active_session(session_ids[2])

        assert {s.session.id for s in self.session_mgr.list_sessions()} == set(
            session_ids
        )
