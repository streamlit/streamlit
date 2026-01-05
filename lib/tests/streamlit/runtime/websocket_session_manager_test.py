# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

import pytest

from streamlit.runtime.script_data import ScriptData
from streamlit.runtime.session_manager import SessionStorage
from streamlit.runtime.stats import CounterStat, GaugeStat, Stat
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
            script_cache=MagicMock(),
            message_enqueued_callback=MagicMock(),
        )

    def connect_session(self, existing_session_id=None, session_id_override=None):
        return self.session_mgr.connect_session(
            client=MagicMock(),
            script_data=ScriptData("/fake/script_path.py", is_hello=False),
            user_info={},
            existing_session_id=existing_session_id,
            session_id_override=session_id_override,
        )

    def test_connect_session(self):
        session_id = self.connect_session()
        session_info = self.session_mgr._active_session_info_by_id[session_id]

        assert session_info.session.id == session_id

    def test_connect_session_check(self):
        with pytest.raises(
            RuntimeError,
            match=r"Only one of existing_session_id and session_id_override should be truthy. "
            r"This should never happen.",
        ):
            self.connect_session(
                existing_session_id="existing_session_id",
                session_id_override="session_id_override",
            )

    def test_connect_session_with_session_id_override(self):
        self.connect_session(session_id_override="my_session_id")
        session_info = self.session_mgr._active_session_info_by_id["my_session_id"]

        assert session_info.session.id == "my_session_id"

    def test_connect_session_on_invalid_session_id(self):
        """Test that connect_session gives us a new session if existing_session_id is invalid."""
        session_id = self.connect_session(existing_session_id="not a valid session")
        session_info = self.session_mgr._active_session_info_by_id[session_id]

        assert session_info.session.id == session_id
        assert session_info.session.id != "not a valid session"

    @patch("streamlit.runtime.websocket_session_manager._LOGGER.warning")
    def test_connect_session_connects_new_session_if_already_connected(
        self, patched_warning
    ):
        session_id = self.connect_session()
        new_session_id = self.connect_session(existing_session_id=session_id)
        assert session_id != new_session_id

        patched_warning.assert_called_with(
            "Session with id %s is already connected! Connecting to a new session.",
            session_id,
        )

    def test_connect_session_explodes_if_ID_collission(self):
        session_id = self.connect_session()
        with (
            pytest.raises(RuntimeError),
            patch("streamlit.runtime.app_session.uuid.uuid4", return_value=session_id),
        ):
            self.connect_session()

    @patch(
        "streamlit.runtime.app_session.AppSession.disconnect_file_watchers",
        new=MagicMock(),
    )
    @patch(
        "streamlit.runtime.app_session.AppSession.request_script_stop",
        new=MagicMock(),
    )
    @patch(
        "streamlit.runtime.app_session.AppSession.register_file_watchers",
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
        original_session_info.session.request_script_stop.assert_called_once()

        # Call disconnect_session again to verify that disconnect_session is idempotent.
        self.session_mgr.disconnect_session(session_id)

        assert session_id not in self.session_mgr._active_session_info_by_id
        assert session_id in self.session_mgr._session_storage._cache
        original_session_info.session.disconnect_file_watchers.assert_called_once()
        original_session_info.session.request_script_stop.assert_called_once()

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

    def test_clear_cache_on_last_session_disconnect(self):
        """Test that script cache is cleared on last session disconnect."""
        session_id_1 = self.connect_session()
        session_id_2 = self.connect_session()

        self.session_mgr.disconnect_session(session_id_1)
        self.session_mgr._script_cache.clear.assert_not_called()

        self.session_mgr.disconnect_session(session_id_2)
        self.session_mgr._script_cache.clear.assert_called_once()

    @patch("streamlit.runtime.app_session.AppSession.shutdown", new=MagicMock())
    def test_clear_cache_on_last_session_close(self):
        """Test that script cache is cleared on last session close."""
        session_id_1 = self.connect_session()
        session_id_2 = self.connect_session()

        self.session_mgr.close_session(session_id_1)
        self.session_mgr._script_cache.clear.assert_not_called()

        self.session_mgr.close_session(session_id_2)
        self.session_mgr._script_cache.clear.assert_called_once()

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


@patch(
    "streamlit.runtime.app_session.asyncio.get_running_loop",
    new=MagicMock(),
)
@patch("streamlit.runtime.app_session.LocalSourcesWatcher", new=MagicMock())
@patch("streamlit.runtime.app_session.ScriptRunner", new=MagicMock())
class WebsocketSessionManagerMetricsTests(unittest.TestCase):
    """Tests for session metrics collection in WebsocketSessionManager."""

    def setUp(self) -> None:
        self.session_mgr = WebsocketSessionManager(
            session_storage=MockSessionStorage(),
            uploaded_file_manager=MagicMock(),
            script_cache=MagicMock(),
            message_enqueued_callback=MagicMock(),
        )

    def connect_session(
        self,
        existing_session_id: str | None = None,
        session_id_override: str | None = None,
    ) -> str:
        return self.session_mgr.connect_session(
            client=MagicMock(),
            script_data=ScriptData("/fake/script_path.py", is_hello=False),
            user_info={},
            existing_session_id=existing_session_id,
            session_id_override=session_id_override,
        )

    def _get_stat_value(
        self,
        stats_dict: dict[str, list[Stat]],
        family_name: str,
        label_type: str | None = None,
    ) -> int:
        """Helper to extract a stat value from the stats dict."""
        if family_name not in stats_dict:
            raise ValueError(f"Family not found: {family_name}")
        for stat in stats_dict[family_name]:
            if label_type is None:
                # For GaugeStat without labels
                if isinstance(stat, GaugeStat):
                    return stat.value
            # For CounterStat with labels
            elif (
                isinstance(stat, CounterStat)
                and stat.labels
                and stat.labels.get("type") == label_type
            ):
                return stat.value
        raise ValueError(f"Stat not found: {family_name}, {label_type}")

    def test_initial_stats_are_zero(self) -> None:
        """Stats should all be zero initially."""
        stats = self.session_mgr.get_stats()

        assert self._get_stat_value(stats, "session_events_total", "connect") == 0
        assert self._get_stat_value(stats, "session_events_total", "reconnect") == 0
        assert self._get_stat_value(stats, "session_events_total", "disconnect") == 0
        assert self._get_stat_value(stats, "active_sessions") == 0

    def test_new_connection_increments_counter(self) -> None:
        """Creating a new session should increment connection counter."""
        self.connect_session()
        stats = self.session_mgr.get_stats()

        assert self._get_stat_value(stats, "session_events_total", "connect") == 1
        assert self._get_stat_value(stats, "session_events_total", "reconnect") == 0
        assert self._get_stat_value(stats, "session_events_total", "disconnect") == 0
        assert self._get_stat_value(stats, "active_sessions") == 1

    def test_multiple_connections(self) -> None:
        """Multiple new sessions should increment connection counter."""
        self.connect_session()
        self.connect_session()
        self.connect_session()
        stats = self.session_mgr.get_stats()

        assert self._get_stat_value(stats, "session_events_total", "connect") == 3
        assert self._get_stat_value(stats, "active_sessions") == 3

    @patch(
        "streamlit.runtime.app_session.AppSession.disconnect_file_watchers",
        new=MagicMock(),
    )
    @patch(
        "streamlit.runtime.app_session.AppSession.request_script_stop",
        new=MagicMock(),
    )
    @patch(
        "streamlit.runtime.app_session.AppSession.register_file_watchers",
        new=MagicMock(),
    )
    def test_reconnection_increments_counter(self) -> None:
        """Reconnecting an existing session should increment reconnection counter."""
        session_id = self.connect_session()
        self.session_mgr.disconnect_session(session_id)
        self.connect_session(existing_session_id=session_id)
        stats = self.session_mgr.get_stats()

        assert self._get_stat_value(stats, "session_events_total", "connect") == 1
        assert self._get_stat_value(stats, "session_events_total", "reconnect") == 1
        assert self._get_stat_value(stats, "active_sessions") == 1

    def test_disconnect_session_increments_disconnection(self) -> None:
        """Disconnecting a session should increment disconnection counter."""
        session_id = self.connect_session()
        self.session_mgr.disconnect_session(session_id)
        stats = self.session_mgr.get_stats()

        assert self._get_stat_value(stats, "session_events_total", "connect") == 1
        assert self._get_stat_value(stats, "session_events_total", "disconnect") == 1
        assert self._get_stat_value(stats, "active_sessions") == 0

    def test_disconnect_session_on_invalid_session_does_not_increment(self) -> None:
        """Disconnecting an invalid session should not increment disconnection counter."""
        self.session_mgr.disconnect_session("nonexistent_session")
        stats = self.session_mgr.get_stats()

        assert self._get_stat_value(stats, "session_events_total", "disconnect") == 0

    @patch("streamlit.runtime.app_session.AppSession.shutdown", new=MagicMock())
    def test_close_active_session_increments_disconnection(self) -> None:
        """Closing an active session should increment disconnection counter."""
        session_id = self.connect_session()
        self.session_mgr.close_session(session_id)
        stats = self.session_mgr.get_stats()

        assert self._get_stat_value(stats, "session_events_total", "connect") == 1
        assert self._get_stat_value(stats, "session_events_total", "disconnect") == 1
        assert self._get_stat_value(stats, "active_sessions") == 0

    @patch("streamlit.runtime.app_session.AppSession.shutdown", new=MagicMock())
    def test_close_stored_session_does_not_increment_disconnection(self) -> None:
        """Closing a session from storage should not increment disconnection counter.

        The disconnect was already counted when disconnect_session was called.
        """
        session_id = self.connect_session()
        # Disconnect moves session to storage and increments counter
        self.session_mgr.disconnect_session(session_id)
        stats_after_disconnect = self.session_mgr.get_stats()
        disconnect_count = self._get_stat_value(
            stats_after_disconnect, "session_events_total", "disconnect"
        )

        # Close the stored session - should not increment counter again
        self.session_mgr.close_session(session_id)
        stats_after_close = self.session_mgr.get_stats()

        assert (
            self._get_stat_value(
                stats_after_close, "session_events_total", "disconnect"
            )
            == disconnect_count
        )

    def test_get_stats_returns_correct_format(self) -> None:
        """get_stats should return stats in the correct format."""
        self.connect_session()
        stats_dict = self.session_mgr.get_stats()

        assert len(stats_dict) == 2
        assert "session_events_total" in stats_dict
        assert "active_sessions" in stats_dict

        # Check session_events_total counters
        session_events = stats_dict["session_events_total"]
        assert len(session_events) == 3
        for stat in session_events:
            assert isinstance(stat, CounterStat)
            assert stat.family_name == "session_events_total"
            assert stat.type == "counter"
            assert stat.labels is not None
            assert "type" in stat.labels

        # Check active_sessions gauge
        active_sessions = stats_dict["active_sessions"]
        assert len(active_sessions) == 1
        assert isinstance(active_sessions[0], GaugeStat)
        assert active_sessions[0].family_name == "active_sessions"
        assert active_sessions[0].type == "gauge"
