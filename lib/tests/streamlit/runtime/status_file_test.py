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

"""streamlit.runtime.status_file unit tests."""

from __future__ import annotations

import json
import os
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest

from streamlit.runtime.checkpoint import CheckpointState
from streamlit.runtime.status_file import (
    StatusFileManager,
    _now_ms,
)

if TYPE_CHECKING:
    from pathlib import Path


def _read_status(path: str) -> dict:
    """Read and parse the JSON status file."""
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _assert_all_timestamps_are_int(payload: dict) -> None:
    """Assert that every timestamp field in the payload is ``int``, never ``float``."""
    for key in ("lastActiveTimestamp", "lastUpdated"):
        value = payload[key]
        if value is not None:
            assert isinstance(value, int), (
                f"{key} should be int, got {type(value).__name__}: {value!r}"
            )
            assert not isinstance(value, float), f"{key} must not be float: {value!r}"


class TestNowMs:
    """Tests for the ``_now_ms`` helper."""

    def test_returns_int(self) -> None:
        """``_now_ms`` must return a Python ``int``, never a ``float``."""
        result = _now_ms()
        assert isinstance(result, int)
        assert not isinstance(result, float)

    def test_returns_positive_value(self) -> None:
        """Sanity check: the timestamp should be a large positive number."""
        result = _now_ms()
        assert result > 1_000_000_000_000  # After ~2001-09-09 in ms

    def test_no_float_arithmetic(self) -> None:
        """Verify ``_now_ms`` uses integer-only arithmetic (time_ns)."""
        with patch("streamlit.runtime.status_file.time") as mock_time:
            mock_time.time_ns.return_value = 1_707_500_000_123_456_789
            result = _now_ms()
            mock_time.time_ns.assert_called_once()
            assert result == 1_707_500_000_123
            assert isinstance(result, int)


class TestStatusFileManager:
    """Tests for ``StatusFileManager`` JSON output types."""

    @pytest.fixture
    def status_path(self, tmp_path: Path) -> str:
        return str(tmp_path / "status.json")

    def test_initial_write_has_int_timestamps(self, status_path: str) -> None:
        """The initial status file written at construction must have int timestamps."""
        StatusFileManager(status_path, grace_period=1.0)
        payload = _read_status(status_path)

        _assert_all_timestamps_are_int(payload)
        assert payload["lastActiveTimestamp"] is None
        assert isinstance(payload["activeSessions"], int)
        assert not isinstance(payload["activeSessions"], float)

    def test_session_connect_produces_int_timestamps(self, status_path: str) -> None:
        """After a session connects, all timestamps must remain int."""
        mgr = StatusFileManager(status_path, grace_period=1.0)
        mgr.on_sessions_changed(1)

        payload = _read_status(status_path)
        _assert_all_timestamps_are_int(payload)
        assert payload["lastActiveTimestamp"] is None
        assert payload["activeSessions"] == 1
        assert not isinstance(payload["activeSessions"], float)

    def test_session_disconnect_produces_int_timestamps(self, status_path: str) -> None:
        """After the last session disconnects, ``lastActiveTimestamp`` must be int."""
        mgr = StatusFileManager(status_path, grace_period=30.0)
        mgr.on_sessions_changed(1)
        mgr.on_sessions_changed(0)

        payload = _read_status(status_path)
        _assert_all_timestamps_are_int(payload)
        assert payload["lastActiveTimestamp"] is not None
        assert isinstance(payload["lastActiveTimestamp"], int)
        assert not isinstance(payload["lastActiveTimestamp"], float)

    def test_checkpoint_ready_produces_int_timestamps(self, status_path: str) -> None:
        """READY_FOR_CHECKPOINT must write int timestamps."""
        mgr = StatusFileManager(status_path, grace_period=1.0)
        mgr.set_checkpoint_state(CheckpointState.READY_FOR_CHECKPOINT)

        payload = _read_status(status_path)
        _assert_all_timestamps_are_int(payload)
        assert payload["currentIdleStatus"] == "QUIET"
        assert payload["checkpointState"] == "READY_FOR_CHECKPOINT"

    def test_restore_to_normal_produces_int_timestamps(self, status_path: str) -> None:
        """Restoring to NORMAL with no sessions must write int timestamps."""
        mgr = StatusFileManager(status_path, grace_period=1.0)
        mgr.set_checkpoint_state(CheckpointState.READY_FOR_CHECKPOINT)
        mgr.set_checkpoint_state(CheckpointState.NORMAL)

        payload = _read_status(status_path)
        _assert_all_timestamps_are_int(payload)
        assert payload["currentIdleStatus"] == "INACTIVE"
        assert payload["lastActiveTimestamp"] is not None
        assert isinstance(payload["lastActiveTimestamp"], int)

    def test_raw_json_contains_no_decimal_points_in_timestamps(
        self, status_path: str
    ) -> None:
        """The raw JSON file must not contain decimal points in numeric fields.

        This catches any scenario where a float like ``1707500000123.0``
        sneaks into the output.
        """
        mgr = StatusFileManager(status_path, grace_period=1.0)
        mgr.on_sessions_changed(1)
        mgr.on_sessions_changed(0)

        with open(status_path, encoding="utf-8") as f:
            raw = f.read()

        parsed = json.loads(raw)
        last_active = str(parsed["lastActiveTimestamp"])
        last_updated = str(parsed["lastUpdated"])
        active_sessions = str(parsed["activeSessions"])

        assert "." not in last_active, (
            f"lastActiveTimestamp contains decimal: {last_active}"
        )
        assert "." not in last_updated, f"lastUpdated contains decimal: {last_updated}"
        assert "." not in active_sessions, (
            f"activeSessions contains decimal: {active_sessions}"
        )

    def test_multiple_session_changes_always_produce_int_timestamps(
        self, status_path: str
    ) -> None:
        """Rapidly connecting/disconnecting sessions must always produce ints."""
        mgr = StatusFileManager(status_path, grace_period=30.0)
        for i in range(10):
            mgr.on_sessions_changed(i + 1)
            payload = _read_status(status_path)
            _assert_all_timestamps_are_int(payload)

            mgr.on_sessions_changed(0)
            payload = _read_status(status_path)
            _assert_all_timestamps_are_int(payload)
            if payload["lastActiveTimestamp"] is not None:
                assert isinstance(payload["lastActiveTimestamp"], int)
                assert not isinstance(payload["lastActiveTimestamp"], float)

    def test_shutdown_removes_file(self, status_path: str) -> None:
        """``shutdown`` must remove the status file."""
        mgr = StatusFileManager(status_path, grace_period=1.0)
        assert os.path.exists(status_path)
        mgr.shutdown()
        assert not os.path.exists(status_path)
