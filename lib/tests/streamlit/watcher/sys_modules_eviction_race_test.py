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

"""Designed races for gh-6404: flush_pending_evictions vs in-flight import.

``import_sleep_gate`` lives under ``test_data/`` and must not be imported at
collection time: ``LocalSourcesWatcher.update_watched_modules`` would then
treat it as a newly watched source and break existing PathWatcher counts.
"""

from __future__ import annotations

import importlib
import os
import sys
import threading
import types
from typing import TYPE_CHECKING
from unittest.mock import MagicMock

import pytest

from streamlit.runtime.pages_manager import PagesManager
from streamlit.watcher import local_sources_watcher

if TYPE_CHECKING:
    from collections.abc import Iterator
    from types import ModuleType

_SLEEP_MODULE_NAME = "tests.streamlit.watcher.test_data.import_sleep_module"
_SLEEP_PKG_NAME = "tests.streamlit.watcher.test_data.import_sleep_pkg"
_SLEEP_PKG_CHILD_NAME = "tests.streamlit.watcher.test_data.import_sleep_pkg.child"
_SLEEP_GATE_NAME = "tests.streamlit.watcher.test_data.import_sleep_gate"

_TEST_DATA_DIR = os.path.join(os.path.dirname(__file__), "test_data")
_SCRIPT_PATH = os.path.realpath(os.path.join(_TEST_DATA_DIR, "dummy_module1.py"))
_TRIGGER_PATH = os.path.realpath(os.path.join(_TEST_DATA_DIR, "dummy_module2.py"))
_SLEEP_MODULE_PATH = os.path.realpath(
    os.path.join(_TEST_DATA_DIR, "import_sleep_module.py")
)
_SLEEP_PKG_INIT_PATH = os.path.realpath(
    os.path.join(_TEST_DATA_DIR, "import_sleep_pkg", "__init__.py")
)


def _import_sleep_gate() -> ModuleType:
    """Import the side channel. Not at collection time (see module docstring)."""
    from tests.streamlit.watcher.test_data import import_sleep_gate

    return import_sleep_gate


def _cleanup_sleep_modules(*, unload_gate: bool = False) -> None:
    """Drop sleep helpers from ``sys.modules`` and reset the side channel."""
    for name in (_SLEEP_MODULE_NAME, _SLEEP_PKG_CHILD_NAME, _SLEEP_PKG_NAME):
        sys.modules.pop(name, None)
    importlib.invalidate_caches()
    if _SLEEP_GATE_NAME in sys.modules:
        _import_sleep_gate().reset()
    if unload_gate:
        sys.modules.pop(_SLEEP_GATE_NAME, None)


@pytest.fixture(autouse=True)
def _assert_script_exec_count_clean() -> Iterator[None]:
    """Fail fast if ``_script_exec_count`` leaks instead of hanging ``wait``."""
    assert local_sources_watcher._script_exec_count == 0
    _cleanup_sleep_modules()
    yield
    _cleanup_sleep_modules(unload_gate=True)
    assert local_sources_watcher._script_exec_count == 0


def _make_watcher() -> local_sources_watcher.LocalSourcesWatcher:
    """Return a watcher for the dummy script path."""
    return local_sources_watcher.LocalSourcesWatcher(PagesManager(_SCRIPT_PATH))


def _register_watched(
    watcher: local_sources_watcher.LocalSourcesWatcher,
    path: str,
    module_name: str,
) -> None:
    """Register ``path`` as a watched module without starting a real path watcher."""
    watcher._watched_modules[os.path.realpath(path)] = (
        local_sources_watcher.WatchedModule(MagicMock(), module_name)
    )


def _queue_eviction(
    watcher: local_sources_watcher.LocalSourcesWatcher,
    path: str,
    module_name: str,
) -> None:
    """Seed ``sys.modules`` so ``on_path_changed`` queues ``module_name``."""
    sys.modules[module_name] = types.ModuleType(module_name)
    watcher.on_path_changed(path)


def _start_import_under_exec(
    module_name: str, errors: list[BaseException]
) -> threading.Thread:
    """Import ``module_name`` inside ``script_execution`` on a new thread."""

    def _importer() -> None:
        try:
            with local_sources_watcher.script_execution():
                importlib.import_module(module_name)
        except BaseException as exc:
            errors.append(exc)

    thread = threading.Thread(target=_importer)
    thread.start()
    return thread


def _join_importer(thread: threading.Thread, errors: list[BaseException]) -> None:
    """Wait for the importer thread and assert it finished without errors."""
    thread.join(timeout=2)
    assert not thread.is_alive()
    assert errors == []


def test_script_execution_increments_and_decrements_count() -> None:
    """Count is 1 inside the context, 0 after; two threads can both hold it."""
    with local_sources_watcher.script_execution():
        assert local_sources_watcher._script_exec_count == 1
    assert local_sources_watcher._script_exec_count == 0

    ready = threading.Barrier(3)
    release = threading.Event()

    def _hold() -> None:
        with local_sources_watcher.script_execution():
            ready.wait(timeout=2)
            release.wait(timeout=2)

    threads = [threading.Thread(target=_hold) for _ in range(2)]
    for thread in threads:
        thread.start()
    ready.wait(timeout=2)
    assert local_sources_watcher._script_exec_count == 2
    release.set()
    for thread in threads:
        thread.join(timeout=2)
        assert not thread.is_alive()
    assert local_sources_watcher._script_exec_count == 0


def test_flush_is_immediate_when_no_script_is_execing() -> None:
    """Queue plus flush pops without blocking when no script is execing."""
    dummy_name = "_gh6404_immediate_flush_mod"
    watcher = _make_watcher()
    try:
        _register_watched(watcher, _TRIGGER_PATH, dummy_name)
        _queue_eviction(watcher, _TRIGGER_PATH, dummy_name)
        assert dummy_name in sys.modules
        watcher.flush_pending_evictions()
        assert dummy_name not in sys.modules
    finally:
        sys.modules.pop(dummy_name, None)
        watcher.close()


def test_flush_is_immediate_when_pending_empty_and_script_is_execing() -> None:
    """Empty pending set returns immediately even if another thread holds exec."""
    watcher = _make_watcher()
    entered = threading.Event()
    release = threading.Event()
    flush_done = threading.Event()

    def _hold() -> None:
        with local_sources_watcher.script_execution():
            entered.set()
            release.wait(timeout=5)

    def _flush() -> None:
        watcher.flush_pending_evictions()
        flush_done.set()

    try:
        holder = threading.Thread(target=_hold)
        holder.start()
        assert entered.wait(timeout=2)

        flusher = threading.Thread(target=_flush)
        flusher.start()
        assert flush_done.wait(timeout=2)
        assert not release.is_set()

        release.set()
        holder.join(timeout=2)
        flusher.join(timeout=2)
        assert not holder.is_alive()
        assert not flusher.is_alive()
    finally:
        release.set()
        watcher.close()


def test_flush_waits_until_script_execution_exits() -> None:
    """Flush blocks while another thread holds ``script_execution``, then pops."""
    dummy_name = "_gh6404_wait_flush_mod"
    watcher = _make_watcher()
    entered = threading.Event()
    release = threading.Event()
    flush_done = threading.Event()

    def _hold() -> None:
        with local_sources_watcher.script_execution():
            entered.set()
            release.wait(timeout=5)

    def _flush() -> None:
        watcher.flush_pending_evictions()
        flush_done.set()

    try:
        _register_watched(watcher, _TRIGGER_PATH, dummy_name)
        _queue_eviction(watcher, _TRIGGER_PATH, dummy_name)

        holder = threading.Thread(target=_hold)
        holder.start()
        assert entered.wait(timeout=2)

        flusher = threading.Thread(target=_flush)
        flusher.start()
        assert not flush_done.wait(timeout=0.3)
        assert dummy_name in sys.modules
        assert flusher.is_alive()

        release.set()
        flusher.join(timeout=2)
        holder.join(timeout=2)
        assert flush_done.is_set()
        assert dummy_name not in sys.modules
    finally:
        release.set()
        sys.modules.pop(dummy_name, None)
        watcher.close()


def test_second_flush_waits_until_first_flush_finishes_eviction() -> None:
    """A concurrent flush must not skip evictions held by a waiting flush."""
    dummy_name = "_gh6404_concurrent_flush_mod"
    watcher = _make_watcher()
    entered = threading.Event()
    release = threading.Event()
    first_flush_done = threading.Event()
    second_flush_done = threading.Event()

    def _hold() -> None:
        with local_sources_watcher.script_execution():
            entered.set()
            release.wait(timeout=5)

    def _flush_first() -> None:
        watcher.flush_pending_evictions()
        first_flush_done.set()

    def _flush_second() -> None:
        watcher.flush_pending_evictions()
        second_flush_done.set()

    try:
        _register_watched(watcher, _TRIGGER_PATH, dummy_name)
        _queue_eviction(watcher, _TRIGGER_PATH, dummy_name)

        holder = threading.Thread(target=_hold)
        holder.start()
        assert entered.wait(timeout=2)

        first = threading.Thread(target=_flush_first)
        first.start()
        assert not first_flush_done.wait(timeout=0.3)
        assert first.is_alive()

        second = threading.Thread(target=_flush_second)
        second.start()
        assert not second_flush_done.wait(timeout=0.3)
        assert dummy_name in sys.modules

        release.set()
        first.join(timeout=2)
        second.join(timeout=2)
        holder.join(timeout=2)
        assert first_flush_done.is_set()
        assert second_flush_done.is_set()
        assert dummy_name not in sys.modules
    finally:
        release.set()
        sys.modules.pop(dummy_name, None)
        watcher.close()


def test_flush_during_import_does_not_keyerror() -> None:
    """Flush during a sleeping import must not KeyError (gh-6404)."""
    gate = _import_sleep_gate()
    gate.reset(sleep=0.15)
    watcher = _make_watcher()
    errors: list[BaseException] = []

    try:
        _register_watched(watcher, _SLEEP_MODULE_PATH, _SLEEP_MODULE_NAME)
        _queue_eviction(watcher, _SLEEP_MODULE_PATH, _SLEEP_MODULE_NAME)
        sys.modules.pop(_SLEEP_MODULE_NAME, None)

        importer = _start_import_under_exec(_SLEEP_MODULE_NAME, errors)
        assert gate.started.wait(timeout=3)

        watcher.flush_pending_evictions()
        _join_importer(importer, errors)
        assert _SLEEP_MODULE_NAME not in sys.modules
    finally:
        watcher.close()


def test_flush_parent_during_nested_import_does_not_keyerror() -> None:
    """Flushing a parent package mid ``import pkg.child`` must not KeyError."""
    gate = _import_sleep_gate()
    gate.reset(sleep=0.15)
    watcher = _make_watcher()
    errors: list[BaseException] = []

    try:
        _register_watched(watcher, _SLEEP_PKG_INIT_PATH, _SLEEP_PKG_NAME)
        _queue_eviction(watcher, _SLEEP_PKG_INIT_PATH, _SLEEP_PKG_NAME)
        sys.modules.pop(_SLEEP_PKG_NAME, None)

        importer = _start_import_under_exec(_SLEEP_PKG_CHILD_NAME, errors)
        assert gate.started.wait(timeout=3)

        watcher.flush_pending_evictions()
        _join_importer(importer, errors)
        assert _SLEEP_PKG_NAME not in sys.modules
        assert _SLEEP_PKG_CHILD_NAME not in sys.modules
    finally:
        watcher.close()


def test_flush_on_one_watcher_waits_for_exec_registered_by_another() -> None:
    """Barrier is process-wide: watcher B's flush waits for exec from watcher A."""
    gate = _import_sleep_gate()
    gate.reset(sleep=0.15)
    watcher_a = _make_watcher()
    watcher_b = _make_watcher()
    errors: list[BaseException] = []

    try:
        _register_watched(watcher_a, _SLEEP_MODULE_PATH, _SLEEP_MODULE_NAME)
        _register_watched(watcher_b, _SLEEP_MODULE_PATH, _SLEEP_MODULE_NAME)
        _queue_eviction(watcher_b, _SLEEP_MODULE_PATH, _SLEEP_MODULE_NAME)
        sys.modules.pop(_SLEEP_MODULE_NAME, None)

        importer = _start_import_under_exec(_SLEEP_MODULE_NAME, errors)
        assert gate.started.wait(timeout=3)

        watcher_b.flush_pending_evictions()
        _join_importer(importer, errors)
        assert _SLEEP_MODULE_NAME not in sys.modules
    finally:
        watcher_a.close()
        watcher_b.close()
