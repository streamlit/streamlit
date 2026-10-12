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

import gc
import threading
import weakref
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import Mock, patch

import pytest

from streamlit.runtime.caching.global_cache_budget import (
    CACHE_DATA_EVICTIONS_FAMILY,
    GlobalCacheBudget,
)
from streamlit.runtime.caching.storage import (
    CacheStorageContext,
    CacheStorageKeyNotFoundError,
)
from streamlit.runtime.caching.storage.dummy_cache_storage import DummyCacheStorage
from streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper import (
    InMemoryCacheStorageWrapper,
)
from streamlit.runtime.stats import CounterStat


class _DictStorage:
    def __init__(self) -> None:
        self.values: dict[str, bytes] = {}

    def has(self, key: str) -> bool:
        return key in self.values

    def get(self, key: str) -> bytes:
        try:
            return self.values[key]
        except KeyError:
            raise CacheStorageKeyNotFoundError(key) from None

    def set(self, key: str, value: bytes) -> None:
        self.values[key] = value

    def delete(self, key: str) -> None:
        self.values.pop(key, None)

    def clear(self) -> None:
        self.values.clear()

    def close(self) -> None:
        pass


def _create_storage(
    budget: GlobalCacheBudget, name: str, *, ttl_seconds: float | None = None
) -> InMemoryCacheStorageWrapper:
    context = CacheStorageContext(
        function_key=name,
        function_display_name=name,
        ttl_seconds=ttl_seconds,
    )
    with patch(
        "streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper."
        "get_global_cache_budget",
        return_value=budget,
    ):
        return InMemoryCacheStorageWrapper(DummyCacheStorage(), context)


def test_budget_evicts_globally_least_recently_used_entry() -> None:
    """A write over budget evicts the globally least-recently-used entry."""
    budget = GlobalCacheBudget(max_bytes=6, read_config=False)
    first = _create_storage(budget, "first")
    second = _create_storage(budget, "second")

    first.set("old", b"aaa")
    second.set("middle", b"bbb")
    assert first.get("old") == b"aaa"
    second.set("new", b"c")

    with pytest.raises(CacheStorageKeyNotFoundError):
        second.get("middle")
    assert first.get("old") == b"aaa"
    assert second.get("new") == b"c"
    assert budget.total_bytes == 4

    stats = budget.get_stats()[CACHE_DATA_EVICTIONS_FAMILY]
    assert isinstance(stats[0], CounterStat)
    assert stats[0].value == 1
    assert stats[0].labels == {"reason": "global_budget"}


def test_budget_retains_current_oversized_entry_and_warns_once() -> None:
    """A lone value over budget remains cached and emits one warning."""
    budget = GlobalCacheBudget(max_bytes=2, read_config=False)
    storage = _create_storage(budget, "oversized")

    with patch(
        "streamlit.runtime.caching.global_cache_budget._LOGGER.warning"
    ) as warning:
        storage.set("key", b"large")

    assert storage.get("key") == b"large"
    assert budget.total_bytes == 5
    warning.assert_called_once()
    stats = budget.get_stats()[CACHE_DATA_EVICTIONS_FAMILY]
    assert isinstance(stats[0], CounterStat)
    assert stats[0].value == 0


def test_disabled_budget_does_not_track_entries() -> None:
    """A disabled budget neither tracks nor evicts cache entries."""
    budget = GlobalCacheBudget(max_bytes=None, read_config=False)
    storage = _create_storage(budget, "disabled")

    storage.set("key", b"value")

    assert budget.total_bytes == 0
    assert storage.get("key") == b"value"


def test_global_budget_warning_is_emitted_once() -> None:
    """Only uncontainable writes warn, and they warn once."""
    budget = GlobalCacheBudget(max_bytes=2, read_config=False)
    storage = _create_storage(budget, "warning")

    with patch(
        "streamlit.runtime.caching.global_cache_budget._LOGGER.warning"
    ) as warning:
        storage.set("a", b"aa")
        storage.set("b", b"bb")
        warning.assert_not_called()
        storage.set("large", b"large")
        storage.set("larger", b"larger")

    warning.assert_called_once()


def test_global_eviction_preserves_persistent_storage() -> None:
    """Global eviction removes only the in-memory copy of persisted data."""
    budget = GlobalCacheBudget(max_bytes=2, read_config=False)
    persistent = _DictStorage()
    context = CacheStorageContext(
        function_key="persistent",
        function_display_name="persistent",
        persist="disk",
    )
    with patch(
        "streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper."
        "get_global_cache_budget",
        return_value=budget,
    ):
        storage = InMemoryCacheStorageWrapper(persistent, context)

    storage.set("a", b"aa")
    storage.set("b", b"bb")

    assert persistent.values == {"a": b"aa", "b": b"bb"}
    assert storage.get("a") == b"aa"


def test_close_and_local_eviction_remove_accounting() -> None:
    """Local eviction and close remove bytes from global accounting."""
    budget = GlobalCacheBudget(max_bytes=100, read_config=False)
    persistent = _DictStorage()
    context = CacheStorageContext(
        function_key="local",
        function_display_name="local",
        max_size_bytes=3,
    )
    with patch(
        "streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper."
        "get_global_cache_budget",
        return_value=budget,
    ):
        storage = InMemoryCacheStorageWrapper(persistent, context)

    storage.set("a", b"aa")
    storage.set("b", b"bb")
    assert budget.total_bytes == 2

    storage.close()
    assert budget.total_bytes == 0

    # A late write to a closed wrapper cannot recreate phantom global bytes.
    storage.set("late", b"x")
    assert budget.total_bytes == 0
    assert "late" not in persistent.values
    assert "late" not in storage._mem_cache


def test_stale_and_reordered_events_do_not_create_phantom_bytes() -> None:
    """Stale and reordered events cannot overwrite current accounting."""
    budget = GlobalCacheBudget(max_bytes=100, read_config=False)
    storage = _create_storage(budget, "generation")
    storage_id = storage._global_storage_id

    budget.record_write(storage_id, "key", 2, 2, 2, 2)
    budget.record_write(storage_id, "key", 9, 1, 1, 1)
    budget.record_removal(storage_id, "key", 1, 1)

    assert budget.total_bytes == 2


def test_victim_selection_resolves_only_the_oldest_storage() -> None:
    """Victim selection resolves only the oldest eligible storage reference."""
    budget = GlobalCacheBudget(max_bytes=100, read_config=False)
    first = _create_storage(budget, "first")
    second = _create_storage(budget, "second")
    first.set("old", b"aa")
    second.set("new", b"bb")

    first_ref = Mock(return_value=first)
    second_ref = Mock(return_value=second)
    budget._storages[first._global_storage_id] = first_ref
    budget._storages[second._global_storage_id] = second_ref
    budget._max_bytes = 1

    victim = budget._reserve_victim(protected=(-1, "none"))

    assert victim is not None
    assert victim[0] is first
    assert victim[1] == "old"
    first_ref.assert_called_once_with()
    second_ref.assert_not_called()


def test_weakref_cleanup_does_not_reenter_budget_lock() -> None:
    """Cyclic GC can queue storage cleanup while the budget lock is held."""
    budget = GlobalCacheBudget(max_bytes=100, read_config=False)
    storage = _create_storage(budget, "collected")
    storage.set("key", b"value")
    storage_ref = weakref.ref(storage)
    del storage

    collector = threading.Thread(target=gc.collect)
    budget._lock.acquire()
    try:
        collector.start()
        collector.join(timeout=2)
        completed_while_locked = not collector.is_alive()
    finally:
        budget._lock.release()
    collector.join(timeout=2)

    assert completed_while_locked
    assert storage_ref() is None
    assert budget.total_bytes == 0


def test_read_between_selection_and_eviction_retries_current_lru() -> None:
    """A read after victim selection makes eviction retry with the current LRU."""
    budget = GlobalCacheBudget(max_bytes=6, read_config=False)
    first = _create_storage(budget, "first")
    second = _create_storage(budget, "second")
    first.set("a", b"aaa")
    second.set("b", b"bbb")

    selected = threading.Event()
    continue_eviction = threading.Event()
    original_evict = first._evict_from_mem_cache

    def delayed_evict(
        key: str, expected_generation: int, expected_access_version: int
    ) -> bool:
        selected.set()
        assert continue_eviction.wait(timeout=5)
        return original_evict(key, expected_generation, expected_access_version)

    with patch.object(first, "_evict_from_mem_cache", side_effect=delayed_evict):
        writer = threading.Thread(target=second.set, args=("c", b"c"))
        writer.start()
        assert selected.wait(timeout=5)
        assert first.get("a") == b"aaa"
        continue_eviction.set()
        writer.join(timeout=5)

    assert not writer.is_alive()
    assert first.get("a") == b"aaa"
    with pytest.raises(CacheStorageKeyNotFoundError):
        second.get("b")
    assert second.get("c") == b"c"
    assert budget.total_bytes == 4


def test_overlapping_writes_are_serialized_through_enforcement() -> None:
    """Overlapping writes keep each insertion protected through enforcement."""
    budget = GlobalCacheBudget(max_bytes=6, read_config=False)
    first = _create_storage(budget, "first")
    second = _create_storage(budget, "second")

    first_enforcing = threading.Event()
    first_enforced = threading.Event()
    allow_first_enforcement = threading.Event()
    allow_first_return = threading.Event()
    second_attempted = threading.Event()
    original_enforce = budget.enforce_budget
    original_write_enforcement = budget.write_enforcement

    def delayed_enforce(protected: tuple[int, str]) -> None:
        if protected[0] == first._global_storage_id:
            first_enforcing.set()
            assert allow_first_enforcement.wait(timeout=5)
            original_enforce(protected)
            first_enforced.set()
            assert allow_first_return.wait(timeout=5)
        else:
            original_enforce(protected)

    def observe_write_enforcement() -> object:
        if threading.current_thread().name == "second-writer":
            second_attempted.set()
        return original_write_enforcement()

    with (
        patch.object(budget, "enforce_budget", side_effect=delayed_enforce),
        patch.object(
            budget,
            "write_enforcement",
            side_effect=observe_write_enforcement,
        ),
    ):
        first_writer = threading.Thread(target=first.set, args=("older", b"aaaaaa"))
        first_writer.start()
        assert first_enforcing.wait(timeout=5)

        second_writer = threading.Thread(
            target=second.set,
            args=("newer", b"b"),
            name="second-writer",
        )
        second_writer.start()
        assert second_attempted.wait(timeout=5)

        allow_first_enforcement.set()
        assert first_enforced.wait(timeout=5)
        assert first.get("older") == b"aaaaaa"
        assert "newer" not in second._mem_cache

        allow_first_return.set()
        first_writer.join(timeout=5)
        second_writer.join(timeout=5)

    assert not first_writer.is_alive()
    assert not second_writer.is_alive()
    with pytest.raises(CacheStorageKeyNotFoundError):
        first.get("older")
    assert second.get("newer") == b"b"
    assert budget.total_bytes == 1


def test_concurrent_read_cannot_make_inflight_write_evict_itself() -> None:
    """A concurrent read cannot make an in-flight write evict itself."""
    budget = GlobalCacheBudget(max_bytes=6, read_config=False)
    old_storage = _create_storage(budget, "old")
    writer_storage = _create_storage(budget, "writer")
    old_storage.set("old", b"aaa")

    insertion_recorded = threading.Event()
    continue_enforcement = threading.Event()
    original_enforce = budget.enforce_budget

    def delayed_enforce(protected: tuple[int, str]) -> None:
        insertion_recorded.set()
        assert continue_enforcement.wait(timeout=5)
        original_enforce(protected)

    with patch.object(budget, "enforce_budget", side_effect=delayed_enforce):
        writer = threading.Thread(target=writer_storage.set, args=("new", b"bbbb"))
        writer.start()
        assert insertion_recorded.wait(timeout=5)

        # The read moves the old entry behind the protected insertion in global
        # LRU order. Enforcement must still retain the in-flight insertion.
        assert old_storage.get("old") == b"aaa"
        continue_enforcement.set()
        writer.join(timeout=5)

    assert not writer.is_alive()
    with pytest.raises(CacheStorageKeyNotFoundError):
        old_storage.get("old")
    assert writer_storage.get("new") == b"bbbb"
    assert budget.total_bytes == 4


@pytest.mark.parametrize("remove", ["clear", "delete"])
def test_selected_victim_removed_concurrently_is_reconciled(
    remove: str,
) -> None:
    """Concurrent victim removal is reconciled before selecting another entry."""
    budget = GlobalCacheBudget(max_bytes=6, read_config=False)
    first = _create_storage(budget, "first")
    second = _create_storage(budget, "second")
    first.set("a", b"aaa")
    second.set("b", b"bbb")

    selected = threading.Event()
    continue_eviction = threading.Event()
    original_evict = first._evict_from_mem_cache

    def delayed_evict(
        key: str, expected_generation: int, expected_access_version: int
    ) -> bool:
        selected.set()
        assert continue_eviction.wait(timeout=5)
        return original_evict(key, expected_generation, expected_access_version)

    with patch.object(first, "_evict_from_mem_cache", side_effect=delayed_evict):
        writer = threading.Thread(target=second.set, args=("c", b"c"))
        writer.start()
        assert selected.wait(timeout=5)
        if remove == "clear":
            first.clear()
        else:
            first.delete("a")
        continue_eviction.set()
        writer.join(timeout=5)

    assert not writer.is_alive()
    assert second.get("b") == b"bbb"
    assert second.get("c") == b"c"
    assert budget.total_bytes == 4


def test_selected_victim_expired_concurrently_is_reconciled() -> None:
    """Concurrent victim expiry is reconciled before enforcement completes."""
    budget = GlobalCacheBudget(max_bytes=6, read_config=False)
    first = _create_storage(budget, "first", ttl_seconds=0)
    second = _create_storage(budget, "second")
    first.set("expired", b"aaa")
    second.set("b", b"bbb")

    selected = threading.Event()
    continue_eviction = threading.Event()
    original_evict = first._evict_from_mem_cache

    def delayed_evict(
        key: str, expected_generation: int, expected_access_version: int
    ) -> bool:
        selected.set()
        assert continue_eviction.wait(timeout=5)
        return original_evict(key, expected_generation, expected_access_version)

    with patch.object(first, "_evict_from_mem_cache", side_effect=delayed_evict):
        global_writer = threading.Thread(target=second.set, args=("c", b"c"))
        global_writer.start()
        assert selected.wait(timeout=5)

        # Stats collection reaps the expired selected key and publishes its removal.
        assert first.get_stats() == {}
        continue_eviction.set()
        global_writer.join(timeout=5)

    assert not global_writer.is_alive()
    assert second.get("b") == b"bbb"
    assert second.get("c") == b"c"
    assert budget.total_bytes == 4


def test_unique_key_churn_keeps_coordinator_metadata_bounded() -> None:
    """Unique-key churn does not retain per-key coordinator metadata."""
    budget = GlobalCacheBudget(max_bytes=1024, read_config=False)
    storage = _create_storage(budget, "churn")

    for index in range(2000):
        key = f"key-{index}"
        storage.set(key, b"x")
        storage.delete(key)

    assert budget.total_bytes == 0
    assert not budget._entries
    assert budget._storage_entries[storage._global_storage_id] == set()
    assert len(budget._last_event_sequences) == 1


def test_concurrent_writes_do_not_evict_each_other() -> None:
    """Concurrent writes leave exactly one live entry under a one-byte budget."""
    budget = GlobalCacheBudget(max_bytes=1, read_config=False)
    storages = [_create_storage(budget, f"storage-{index}") for index in range(2)]
    barrier = threading.Barrier(2)

    def write_entries(index: int) -> None:
        for iteration in range(100):
            barrier.wait(timeout=5)
            storages[index].set(f"{index}-{iteration}", b"x")
            barrier.wait(timeout=5)

    with ThreadPoolExecutor(max_workers=2) as executor:
        list(executor.map(write_entries, range(2)))

    live_entries = sum(len(storage._mem_cache) for storage in storages)
    assert budget.total_bytes == 1
    assert live_entries == 1


def test_concurrent_writes_and_clears_do_not_deadlock_or_leave_phantom_bytes() -> None:
    """Concurrent writes and clears finish with exact bounded accounting."""
    budget = GlobalCacheBudget(max_bytes=64, read_config=False)
    storages = [_create_storage(budget, f"storage-{index}") for index in range(4)]

    def exercise(index: int) -> None:
        storage = storages[index % len(storages)]
        for iteration in range(100):
            storage.set(f"{index}-{iteration % 8}", bytes(8))
            if iteration % 11 == 0:
                storage.clear()

    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(exercise, range(8)))

    actual_bytes = 0
    for storage in storages:
        with storage._mem_cache_lock:
            actual_bytes += sum(len(value) for value in storage._mem_cache.values())

    assert budget.total_bytes == actual_bytes
    assert actual_bytes <= 64
    for storage in storages:
        storage.close()
    assert budget.total_bytes == 0
