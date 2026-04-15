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

"""Unit tests for :mod:`streamlit.components.v2.component_manager`."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from streamlit.components.v2.component_manager import BidiComponentManager


def test_unregister_delegates_to_registry() -> None:
    """``unregister`` forwards to the registry ``unregister`` method."""
    mock_registry = MagicMock()
    manager = BidiComponentManager(registry=mock_registry)
    manager.unregister("my-component")
    mock_registry.unregister.assert_called_once_with("my-component")


def test_start_file_watching_when_already_started_logs_and_skips() -> None:
    """When watching is active, log a warning and do not restart the watcher."""
    mock_registry = MagicMock()
    mock_manifest_handler = MagicMock()
    mock_file_watcher = MagicMock()
    mock_file_watcher.is_watching_active = True

    manager = BidiComponentManager(
        registry=mock_registry,
        manifest_handler=mock_manifest_handler,
        file_watcher=mock_file_watcher,
    )

    with patch("streamlit.components.v2.component_manager._LOGGER") as mock_logger:
        manager.start_file_watching()

    mock_logger.warning.assert_called_once_with("File watching is already started")
    mock_manifest_handler.get_asset_watch_roots.assert_not_called()
    mock_file_watcher.start_file_watching.assert_not_called()


def test_discover_and_register_components_logs_warning_on_scan_failure() -> None:
    """Manifest scan failures log a warning and do not propagate."""
    manager = BidiComponentManager()

    with (
        patch("streamlit.components.v2.component_manager._LOGGER") as mock_logger,
        patch(
            "streamlit.components.v2.manifest_scanner.scan_component_manifests",
            side_effect=RuntimeError("scan failed"),
        ),
    ):
        manager.discover_and_register_components(start_file_watching=False)

    mock_logger.warning.assert_called_once()
    fmt, err = mock_logger.warning.call_args[0]
    assert fmt == "Failed to scan component manifests: %s"
    assert str(err) == "scan failed"


def test_stop_file_watching_when_not_started_logs_and_skips() -> None:
    """When watching is inactive, log a warning and do not stop the watcher."""
    mock_file_watcher = MagicMock()
    mock_file_watcher.is_watching_active = False
    manager = BidiComponentManager(file_watcher=mock_file_watcher)

    with patch("streamlit.components.v2.component_manager._LOGGER") as mock_logger:
        manager.stop_file_watching()

    mock_logger.warning.assert_called_once_with("File watching is not started")
    mock_file_watcher.stop_file_watching.assert_not_called()


def test_stop_file_watching_when_active_calls_watcher() -> None:
    """When watching is active, delegate shutdown to the file watcher."""
    mock_file_watcher = MagicMock()
    mock_file_watcher.is_watching_active = True
    manager = BidiComponentManager(file_watcher=mock_file_watcher)

    with patch("streamlit.components.v2.component_manager._LOGGER") as mock_logger:
        manager.stop_file_watching()

    mock_file_watcher.stop_file_watching.assert_called_once_with()
    mock_logger.debug.assert_called_with("Stopped file watching")


def test_on_components_changed_logs_exception_when_recompute_raises() -> None:
    """Registry updates that fail during recompute log at exception level."""
    mock_registry = MagicMock()
    manager = BidiComponentManager(registry=mock_registry, file_watcher=MagicMock())

    with (
        patch("streamlit.components.v2.component_manager._LOGGER") as mock_logger,
        patch.object(
            manager,
            "_recompute_definition_from_api",
            side_effect=RuntimeError("recompute failed"),
        ),
    ):
        manager._on_components_changed(["any.component"])

    mock_logger.exception.assert_called_once()
    fmt, name = mock_logger.exception.call_args[0]
    assert fmt == "Failed to update component after change: %s"
    assert name == "any.component"
    mock_registry.update_component.assert_not_called()


def test_recompute_definition_from_api_returns_none_without_recorded_inputs() -> None:
    """Recompute without prior ``record_api_inputs`` returns ``None``."""
    manager = BidiComponentManager()
    assert manager._recompute_definition_from_api("unknown.component") is None
