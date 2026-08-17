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

import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from streamlit.components.v2.component_file_watcher import ComponentFileWatcher


@pytest.fixture
def temp_component_files():
    """Create temporary directory structure with component files for testing."""
    temp_dir = tempfile.TemporaryDirectory()
    temp_path = Path(temp_dir.name)

    # Create directory structure
    js_dir = temp_path / "js"
    css_dir = temp_path / "css"
    js_dir.mkdir()
    css_dir.mkdir()

    # Create test files
    js_file = js_dir / "component.js"
    js_file.write_text("console.log('original');")

    css_file = css_dir / "styles.css"
    css_file.write_text(".test { color: red; }")

    # Create glob pattern files
    glob_js_file = js_dir / "component-v1.0.js"
    glob_js_file.write_text("console.log('glob v1');")

    glob_css_file = css_dir / "styles-v1.0.css"
    glob_css_file.write_text(".glob { color: blue; }")

    yield {
        "temp_dir": temp_path,
        "js_file": js_file,
        "css_file": css_file,
        "glob_js_file": glob_js_file,
        "glob_css_file": glob_css_file,
    }

    temp_dir.cleanup()


@pytest.fixture
def mock_callback():
    """Create a mock callback function."""
    return Mock()


@pytest.fixture
def file_watcher(mock_callback):
    """Create a ComponentFileWatcher instance with mock callback."""
    return ComponentFileWatcher(mock_callback)


def test_init(mock_callback):
    """Test initialization of ComponentFileWatcher."""
    watcher = ComponentFileWatcher(mock_callback)

    assert watcher._component_update_callback is mock_callback
    assert not watcher.is_watching_active
    assert watcher._watched_directories == {}
    assert watcher._path_watchers == []
    assert watcher._asset_watch_roots == {}


def test_start_file_watching_no_watchers(file_watcher):
    """Test starting file watching with no asset roots."""
    file_watcher.start_file_watching({})

    assert not file_watcher.is_watching_active


@pytest.mark.parametrize(
    ("roots_kind", "expected_watchers", "expected_dirs"),
    [
        ("single", 1, 1),
        ("multiple", 2, 2),
        ("shared", 1, 1),
    ],
)
def test_start_file_watching_various_roots(
    file_watcher,
    temp_component_files,
    roots_kind: str,
    expected_watchers: int,
    expected_dirs: int,
):
    """Start watching with different root configurations and verify watcher counts.

    Parameters
    ----------
    roots_kind
        One of ``single``, ``multiple``, or ``shared`` to setup asset roots.
    expected_watchers
        Expected number of watcher instances created.
    expected_dirs
        Expected number of watched directories recorded.
    """
    mock_watcher_instance = Mock()
    with patch(
        "streamlit.watcher.path_watcher.get_default_path_watcher_class",
        return_value=Mock(return_value=mock_watcher_instance),
    ):
        if roots_kind == "single":
            asset_roots = {"test.component": temp_component_files["temp_dir"]}
        elif roots_kind == "multiple":
            js_root = temp_component_files["temp_dir"] / "js"
            css_root = temp_component_files["temp_dir"] / "css"
            asset_roots = {
                "test.js_component": js_root,
                "test.css_component": css_root,
            }
        else:  # shared
            root = temp_component_files["temp_dir"]
            asset_roots = {"test.direct": root, "test.glob": root}

        file_watcher.start_file_watching(asset_roots)

        assert file_watcher.is_watching_active
        assert len(file_watcher._path_watchers) == expected_watchers
        assert len(file_watcher._watched_directories) == expected_dirs


def test_stop_file_watching(file_watcher):
    """Test stopping file watching."""
    # Mock some active watchers
    mock_watcher1 = Mock()
    mock_watcher2 = Mock()
    file_watcher._path_watchers = [mock_watcher1, mock_watcher2]
    file_watcher._watched_directories = {"dir1": ["comp1"]}
    # No file watchers in directory-only approach
    file_watcher._watching_active = True
    # Seed asset roots to verify cleanup
    file_watcher._asset_watch_roots = {"comp1": Path("/tmp")}

    file_watcher.stop_file_watching()

    # Should have closed all watchers
    mock_watcher1.close.assert_called_once()
    mock_watcher2.close.assert_called_once()

    # Should have cleared all state
    assert not file_watcher.is_watching_active
    assert file_watcher._path_watchers == []
    assert file_watcher._watched_directories == {}
    assert file_watcher._asset_watch_roots == {}


def test_handle_component_change_catches_callback_exceptions(file_watcher):
    """Ensure exceptions in the update callback are caught and logged."""
    file_watcher._watching_active = True

    # Replace the callback with a raising one
    def raising_callback(_components):
        raise RuntimeError("boom")

    file_watcher._component_update_callback = raising_callback

    # Patch logger.exception to ensure we log instead of propagating
    with patch("streamlit.components.v2.component_file_watcher._LOGGER") as logger_mock:
        # Should not raise
        file_watcher._handle_component_change(["test.component"])
        logger_mock.exception.assert_called_once()

    # Subsequent normal callbacks should still be invoked
    ok_mock = Mock()
    file_watcher._component_update_callback = ok_mock
    file_watcher._handle_component_change(["test.component"])
    ok_mock.assert_called_once_with(["test.component"])


def test_stop_file_watching_with_close_errors(file_watcher):
    """Test stopping file watching when watcher.close() raises an exception."""
    # Mock a watcher that raises an exception on close
    mock_watcher = Mock()
    mock_watcher.close.side_effect = Exception("Close failed")
    file_watcher._path_watchers = [mock_watcher]
    file_watcher._watching_active = True

    # Should not raise exception, just log it
    file_watcher.stop_file_watching()

    # Should still clean up state
    assert not file_watcher.is_watching_active
    assert file_watcher._path_watchers == []


def test_change_event_triggers_callback(file_watcher, temp_component_files):
    """Simulate a change event and ensure the update callback is invoked once."""
    file_watcher._watching_active = True
    file_watcher._handle_component_change(["test.component"])  # simulate both kinds
    file_watcher._component_update_callback.assert_called_once()


@pytest.mark.parametrize(
    "attr_name",
    [
        "_re_resolve_component_patterns",
        "_resolve_single_pattern",
        "_extract_html_content",
    ],
)
def test_no_legacy_helpers_present(file_watcher, attr_name: str):
    """Assert that removed legacy helpers are not present on the watcher."""
    assert not hasattr(file_watcher, attr_name)


@pytest.mark.parametrize("name_key", ["test.glob_recursive", "test.direct_parent"])
def test_directory_watchers_use_recursive_globs(
    file_watcher, temp_component_files, name_key: str
):
    """Ensure directory watchers are configured with recursive "**/*" globs."""
    mock_watcher_instance = Mock()
    watcher_class_mock = Mock(return_value=mock_watcher_instance)
    with patch(
        "streamlit.watcher.path_watcher.get_default_path_watcher_class",
        return_value=watcher_class_mock,
    ):
        file_watcher.start_file_watching({name_key: temp_component_files["temp_dir"]})

        assert watcher_class_mock.call_count == 1
        assert watcher_class_mock.call_args.kwargs.get("glob_pattern") == "**/*"


@pytest.mark.parametrize(
    "ignored_dir",
    ["node_modules", ".git", "__pycache__", ".cache", "coverage", "venv"],
)
def test_ignores_noisy_directories_in_callbacks(
    file_watcher, temp_component_files, ignored_dir: str
):
    """Change events under common noisy directories must be ignored in callbacks."""
    mock_watcher_instance = Mock()
    watcher_class_mock = Mock(return_value=mock_watcher_instance)
    with patch(
        "streamlit.watcher.path_watcher.get_default_path_watcher_class",
        return_value=watcher_class_mock,
    ):
        file_watcher.start_file_watching(
            {"test.glob_ignore": temp_component_files["temp_dir"]}
        )

        assert watcher_class_mock.call_count == 1
        cb = watcher_class_mock.call_args.args[1]
        noisy_path = str(
            (temp_component_files["temp_dir"] / "js" / ignored_dir / "dep.js").resolve()
        )

        cb(noisy_path)

        file_watcher._component_update_callback.assert_not_called()


def test_restart_replaces_previous_watchers(file_watcher, tmp_path: Path):
    """Calling start_file_watching twice should restart and replace watchers and directories."""
    mock_watcher_first = Mock()
    mock_watcher_second = Mock()

    # The watcher class will return different instances on subsequent calls
    watcher_class_mock = Mock(side_effect=[mock_watcher_first, mock_watcher_second])

    with patch(
        "streamlit.watcher.path_watcher.get_default_path_watcher_class",
        return_value=watcher_class_mock,
    ):
        # First start with one root
        first_root = tmp_path / "first"
        first_root.mkdir()
        file_watcher.start_file_watching({"comp.first": first_root})

        assert file_watcher.is_watching_active
        assert len(file_watcher._path_watchers) == 1
        assert list(file_watcher._watched_directories.keys()) == [
            str(first_root.resolve())
        ]

        # Now restart with a different root; previous watcher should be closed and replaced
        second_root = tmp_path / "second"
        second_root.mkdir()

        file_watcher.start_file_watching({"comp.second": second_root})

        # The first watcher should have been closed by the restart
        mock_watcher_first.close.assert_called_once()

        # We should have exactly one current watcher, and directories should reflect the new root
        assert file_watcher.is_watching_active
        assert len(file_watcher._path_watchers) == 1
        assert list(file_watcher._watched_directories.keys()) == [
            str(second_root.resolve())
        ]


def test_noop_path_watcher_short_circuits_and_stays_inactive(
    file_watcher, tmp_path: Path
):
    """When NoOpPathWatcher is returned, we should not create watchers or mark active."""
    # Import NoOpPathWatcher to use identity comparison in code under test
    from streamlit.watcher.path_watcher import NoOpPathWatcher

    # Patch to return NoOpPathWatcher
    with patch(
        "streamlit.watcher.path_watcher.get_default_path_watcher_class",
        return_value=NoOpPathWatcher,
    ):
        root = tmp_path / "comp"
        root.mkdir()
        file_watcher.start_file_watching({"comp": root})

        # Should remain inactive and not register any watchers or directories
        assert not file_watcher.is_watching_active
        assert file_watcher._path_watchers == []
        assert file_watcher._watched_directories == {}


def test_start_failure_rolls_back_and_leaves_no_watchers(file_watcher, tmp_path: Path):
    """If creating a watcher fails mid-setup, previously created watchers are closed and no state is committed."""
    # Prepare two directories to trigger two watcher creations
    dir_a = tmp_path / "a"
    dir_b = tmp_path / "b"
    dir_a.mkdir()
    dir_b.mkdir()

    first_watcher = Mock()

    def ctor(*args, **kwargs):
        if ctor.calls == 0:
            ctor.calls += 1
            return first_watcher
        raise RuntimeError("boom")

    ctor.calls = 0

    with patch(
        "streamlit.watcher.path_watcher.get_default_path_watcher_class",
        return_value=ctor,
    ):
        # Should not raise; internal code logs and rolls back
        file_watcher.start_file_watching(
            {
                "c1": dir_a,
                "c2": dir_b,
            }
        )

    # Rollback: no watchers kept, not active, no directories remembered, roots not set
    assert not file_watcher.is_watching_active
    assert file_watcher._path_watchers == []
    assert file_watcher._watched_directories == {}
    assert file_watcher._asset_watch_roots == {}
    # The partially created watcher must be closed during rollback
    first_watcher.close.assert_called_once()


def test_asset_roots_only_committed_after_success(file_watcher, tmp_path: Path):
    """Roots should be committed only on successful watcher setup; on failure, they remain empty."""
    root = tmp_path / "comp"
    root.mkdir()

    def ctor(*args, **kwargs):
        raise RuntimeError("fail")

    with patch(
        "streamlit.watcher.path_watcher.get_default_path_watcher_class",
        return_value=ctor,
    ):
        file_watcher.start_file_watching({"comp": root})

    assert not file_watcher.is_watching_active
    assert file_watcher._path_watchers == []
    assert file_watcher._watched_directories == {}
    # Roots should not be committed on failure
    assert file_watcher._asset_watch_roots == {}


def test_internal_start_noops_when_already_active(file_watcher, tmp_path: Path) -> None:
    """The internal `_start_file_watching` returns early when already active."""
    file_watcher._watching_active = True
    with patch(
        "streamlit.watcher.path_watcher.get_default_path_watcher_class"
    ) as path_watcher_class_mock:
        file_watcher._start_file_watching({"comp": tmp_path})

    # Path watcher class should never be consulted when already active.
    path_watcher_class_mock.assert_not_called()


def test_handle_component_change_skips_when_not_active(file_watcher) -> None:
    """`_handle_component_change` is a no-op when watching is not active."""
    callback = Mock()
    file_watcher._component_update_callback = callback

    file_watcher._handle_component_change(["some.component"])

    callback.assert_not_called()


def test_rollback_logs_close_failures(file_watcher, tmp_path: Path) -> None:
    """Watchers whose close raises during rollback are logged but do not propagate."""
    successful_watcher = Mock()
    failing_watcher = Mock()
    failing_watcher.close.side_effect = Exception("close-failed")

    call_index = {"value": 0}

    def ctor(*args, **kwargs):
        idx = call_index["value"]
        call_index["value"] += 1
        if idx == 0:
            return successful_watcher
        if idx == 1:
            return failing_watcher
        raise RuntimeError("third call triggers rollback")

    with (
        patch(
            "streamlit.watcher.path_watcher.get_default_path_watcher_class",
            return_value=ctor,
        ),
        patch("streamlit.components.v2.component_file_watcher._LOGGER") as logger_mock,
    ):
        dir_a = tmp_path / "a"
        dir_b = tmp_path / "b"
        dir_c = tmp_path / "c"
        for d in (dir_a, dir_b, dir_c):
            d.mkdir()
        file_watcher.start_file_watching({"c1": dir_a, "c2": dir_b, "c3": dir_c})

    # Both already-created watchers should have close attempted during rollback.
    successful_watcher.close.assert_called_once()
    failing_watcher.close.assert_called_once()
    # The failing close should have been logged via _LOGGER.exception.
    logger_mock.exception.assert_any_call(
        "Failed to close path watcher during rollback"
    )
    # State must not be committed after a rollback.
    assert not file_watcher.is_watching_active


def test_is_in_ignored_directory_returns_false_on_exception(file_watcher) -> None:
    """If resolving the changed path raises, the helper returns False."""
    with patch("pathlib.Path") as path_mock:
        path_mock.return_value.resolve.side_effect = OSError("resolve failed")
        result = file_watcher._is_in_ignored_directory("/whatever")
    assert result is False


def test_directory_callback_dispatches_to_component_update(
    file_watcher, tmp_path: Path
) -> None:
    """The watcher callback delegates to `_handle_component_change` for non-ignored paths."""
    callback_mock = Mock()
    file_watcher._component_update_callback = callback_mock

    mock_watcher_instance = Mock()
    watcher_class_mock = Mock(return_value=mock_watcher_instance)
    with patch(
        "streamlit.watcher.path_watcher.get_default_path_watcher_class",
        return_value=watcher_class_mock,
    ):
        root = tmp_path / "comp"
        root.mkdir()
        file_watcher.start_file_watching({"my.component": root})

    # Retrieve the directory-level callback registered with the watcher.
    cb = watcher_class_mock.call_args.args[1]

    # A change to a non-ignored path should trigger the update callback.
    safe_path = str((root / "main.js").resolve())
    cb(safe_path)
    callback_mock.assert_called_once_with(["my.component"])
