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
import math
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


def test_budget_from_config_uses_configured_limit() -> None:
    """The runtime budget is constructed from server.maxCachedDataSize."""
    with patch(
        "streamlit.runtime.caching.global_cache_budget.config.get_option",
        return_value="1KiB",
    ):
        budget = GlobalCacheBudget.from_config()

    assert budget._max_bytes == 1024


def test_budget_from_default_config_is_disabled() -> None:
    """The default config does not create a process-wide byte limit."""
    budget = GlobalCacheBudget.from_config()

    assert budget._max_bytes is None


def test_reconfigure_applies_budget_to_existing_storage() -> None:
    """A server-start limit accounts for values cached earlier in raw mode."""
    budget = GlobalCacheBudget(max_bytes=None)
    storage = _create_storage(budget, "raw-mode")
    storage.set("before-config", b"aaa")

    budget.reconfigure(max_bytes=3)
    storage.set("after-config", b"bbb")

    with pytest.raises(CacheStorageKeyNotFoundError):
        storage.get("before-config")
    assert storage.get("after-config") == b"bbb"
    assert budget.total_bytes == 3


def test_budget_evicts_globally_least_recently_used_entry() -> None:
    """A write over budget evicts the globally least-recently-used entry."""
    budget = GlobalCacheBudget(max_bytes=6)
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


def test_budget_reaps_newer_expired_entry_before_evicting_live_lru() -> None:
    """Expired bytes are reconciled before a live global LRU victim is chosen."""
    budget = GlobalCacheBudget(max_bytes=6)
    live = _create_storage(budget, "live")
    expiring = _create_storage(budget, "expiring", ttl_seconds=1)
    writer = _create_storage(budget, "writer")
    now = 0.0
    expiring._mem_cache._timer = lambda: now

    live.set("older-live", b"aaa")
    expiring.set("newer-expired", b"bbb")
    now = 2.0

    # Without a global expiry reconciliation, "older-live" is selected first
    # even though dropping the newer expired value alone satisfies the budget.
    writer.set("new", b"c")

    assert live.get("older-live") == b"aaa"
    with pytest.raises(CacheStorageKeyNotFoundError):
        expiring.get("newer-expired")
    assert writer.get("new") == b"c"
    assert budget.total_bytes == 4


@pytest.mark.parametrize("ttl_seconds", [math.nan, -math.inf])
def test_budget_reaps_nonfinite_expired_entry_before_live_lru(
    ttl_seconds: float,
) -> None:
    """NaN and negative-infinite TTLs expire immediately and are reaped."""
    budget = GlobalCacheBudget(max_bytes=6)
    live = _create_storage(budget, "live")
    expired = _create_storage(budget, "expired", ttl_seconds=ttl_seconds)
    writer = _create_storage(budget, "writer")

    live.set("older-live", b"aaa")
    expired.set("newer-expired", b"bbb")
    writer.set("new", b"c")

    assert live.get("older-live") == b"aaa"
    with pytest.raises(CacheStorageKeyNotFoundError):
        expired.get("newer-expired")
    assert writer.get("new") == b"c"
    assert budget.total_bytes == 4


def test_expiry_reconciliation_skips_storages_without_ttl() -> None:
    """Global reconciliation visits only storages whose entries can expire."""
    budget = GlobalCacheBudget(max_bytes=6)
    persistent = _create_storage(budget, "persistent")
    expiring = _create_storage(budget, "expiring", ttl_seconds=1)

    with (
        patch.object(persistent, "_reap_expired_entries") as persistent_reap,
        patch.object(expiring, "_reap_expired_entries") as expiring_reap,
    ):
        budget._reap_expired_entries()

    persistent_reap.assert_not_called()
    expiring_reap.assert_called_once_with()


def test_storage_is_initialized_before_budget_registration() -> None:
    """Concurrent expiry reconciliation cannot observe a half-built storage."""
    budget = GlobalCacheBudget(max_bytes=1)
    context = CacheStorageContext(
        function_key="constructing",
        function_display_name="constructing",
        ttl_seconds=1,
    )
    registered = threading.Event()
    continue_registration = threading.Event()
    original_register = budget.register

    def blocking_register(storage: InMemoryCacheStorageWrapper) -> int:
        storage_id = original_register(storage)
        registered.set()
        assert continue_registration.wait(timeout=5)
        return storage_id

    with (
        patch(
            "streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper."
            "get_global_cache_budget",
            return_value=budget,
        ),
        patch.object(budget, "register", side_effect=blocking_register),
        ThreadPoolExecutor(max_workers=1) as executor,
    ):
        future = executor.submit(
            InMemoryCacheStorageWrapper,
            DummyCacheStorage(),
            context,
        )
        assert registered.wait(timeout=5)
        try:
            budget._reap_expired_entries()
        finally:
            continue_registration.set()
        storage = future.result(timeout=5)

    storage.close()


def test_budget_retains_current_oversized_entry_and_warns_once() -> None:
    """A lone value over budget remains cached and emits one warning."""
    budget = GlobalCacheBudget(max_bytes=2)
    storage = _create_storage(budget, "oversized")

    with patch(
        "streamlit.runtime.caching.global_cache_budget._LOGGER.warning"
    ) as warning:
        storage.set("key", b"large")

    assert storage.get("key") == b"large"
    assert budget.total_bytes == 5
    warning.assert_called_once()
    assert warning.call_args.kwargs["stack_info"] is True
    stats = budget.get_stats()[CACHE_DATA_EVICTIONS_FAMILY]
    assert isinstance(stats[0], CounterStat)
    assert stats[0].value == 0


def test_disabled_budget_does_not_track_entries() -> None:
    """A disabled budget neither tracks, evicts, nor warns about cache entries."""
    budget = GlobalCacheBudget(max_bytes=None)
    storage = _create_storage(budget, "disabled")

    with patch(
        "streamlit.runtime.caching.global_cache_budget._LOGGER.warning"
    ) as warning:
        storage.set("first", b"value")
        storage.set("second", b"another value")

    assert budget.total_bytes == 0
    assert storage.get("first") == b"value"
    assert storage.get("second") == b"another value"
    warning.assert_not_called()
    stats = budget.get_stats()[CACHE_DATA_EVICTIONS_FAMILY]
    assert isinstance(stats[0], CounterStat)
    assert stats[0].value == 0


def test_disabled_budget_skips_storage_version_bookkeeping() -> None:
    """Default-disabled budgets leave the write-generation map empty."""
    budget = GlobalCacheBudget(max_bytes=None)
    storage = _create_storage(budget, "disabled")

    storage.set("key", b"value")
    assert storage.get("key") == b"value"

    assert storage._generations == {}


def test_global_budget_warning_is_emitted_once() -> None:
    """Only uncontainable writes warn, and they warn once."""
    budget = GlobalCacheBudget(max_bytes=2)
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
    budget = GlobalCacheBudget(max_bytes=2)
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
    budget = GlobalCacheBudget(max_bytes=100)
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


def test_victim_selection_resolves_only_the_oldest_storage() -> None:
    """Victim selection resolves only the oldest eligible storage reference."""
    budget = GlobalCacheBudget(max_bytes=100)
    first = _create_storage(budget, "first")
    second = _create_storage(budget, "second")
    first.set("old", b"aa")
    second.set("new", b"bb")

    first_ref = Mock(return_value=first)
    second_ref = Mock(return_value=second)
    budget._storages[first._global_storage_id] = first_ref
    budget._storages[second._global_storage_id] = second_ref
    budget._max_bytes = 1

    victim = budget._select_victim_snapshot(
        protected=(-1, "none"),
        excluded=set(),
    )

    assert victim is not None
    assert victim[0] is first
    assert victim[1] == "old"
    first_ref.assert_called_once_with()
    second_ref.assert_not_called()


def test_weakref_cleanup_does_not_reenter_budget_lock() -> None:
    """Cyclic GC can queue storage cleanup while the budget lock is held."""
    budget = GlobalCacheBudget(max_bytes=100)
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


def test_read_between_selection_and_eviction_waits_for_enforcement() -> None:
    """An enabled-budget read waits so enforcement restores the exact budget."""
    budget = GlobalCacheBudget(max_bytes=6)
    first = _create_storage(budget, "first")
    second = _create_storage(budget, "second")
    first.set("a", b"aaa")
    second.set("b", b"bbb")

    selected = threading.Event()
    continue_eviction = threading.Event()
    read_started = threading.Event()
    read_finished = threading.Event()
    read_errors: list[CacheStorageKeyNotFoundError] = []
    original_evict = first._evict_from_mem_cache

    def delayed_evict(key: str, expected_generation: int) -> bool:
        selected.set()
        assert continue_eviction.wait(timeout=5)
        return original_evict(key, expected_generation)

    def read_selected_entry() -> None:
        read_started.set()
        try:
            first.get("a")
        except CacheStorageKeyNotFoundError as ex:
            read_errors.append(ex)
        finally:
            read_finished.set()

    with patch.object(first, "_evict_from_mem_cache", side_effect=delayed_evict):
        writer = threading.Thread(target=second.set, args=("c", b"c"))
        writer.start()
        assert selected.wait(timeout=5)
        reader = threading.Thread(target=read_selected_entry)
        reader.start()
        assert read_started.wait(timeout=5)
        assert not read_finished.wait(timeout=0.1)
        continue_eviction.set()
        writer.join(timeout=5)
        reader.join(timeout=5)

    assert not writer.is_alive()
    assert not reader.is_alive()
    assert len(read_errors) == 1
    assert isinstance(read_errors[0], CacheStorageKeyNotFoundError)
    with pytest.raises(CacheStorageKeyNotFoundError):
        first.get("a")
    assert second.get("b") == b"bbb"
    assert second.get("c") == b"c"
    assert budget.total_bytes == 4


def test_overlapping_writes_are_serialized_through_enforcement() -> None:
    """Overlapping writes keep each insertion protected through enforcement."""
    budget = GlobalCacheBudget(max_bytes=6)
    first = _create_storage(budget, "first")
    second = _create_storage(budget, "second")

    first_enforcing = threading.Event()
    first_enforced = threading.Event()
    allow_first_enforcement = threading.Event()
    allow_first_return = threading.Event()
    second_attempted = threading.Event()
    original_enforce = budget.enforce_budget
    original_enforcement_lock = budget.enforcement_lock

    def delayed_enforce(protected: tuple[int, str]) -> None:
        if protected[0] == first._global_storage_id:
            first_enforcing.set()
            assert allow_first_enforcement.wait(timeout=5)
            original_enforce(protected)
            first_enforced.set()
            assert allow_first_return.wait(timeout=5)
        else:
            original_enforce(protected)

    def observe_enforcement_lock() -> object:
        if threading.current_thread().name == "second-writer":
            second_attempted.set()
        return original_enforcement_lock()

    with (
        patch.object(budget, "enforce_budget", side_effect=delayed_enforce),
        patch.object(
            budget,
            "enforcement_lock",
            side_effect=observe_enforcement_lock,
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
        with first._mem_cache_lock:
            assert first._mem_cache["older"] == b"aaaaaa"
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


def test_read_waits_for_inflight_write_enforcement() -> None:
    """A read cannot refresh a victim before an in-flight write is enforced."""
    budget = GlobalCacheBudget(max_bytes=6)
    old_storage = _create_storage(budget, "old")
    writer_storage = _create_storage(budget, "writer")
    old_storage.set("old", b"aaa")

    insertion_recorded = threading.Event()
    continue_enforcement = threading.Event()
    read_started = threading.Event()
    read_finished = threading.Event()
    read_errors: list[CacheStorageKeyNotFoundError] = []
    original_enforce = budget.enforce_budget

    def delayed_enforce(protected: tuple[int, str]) -> None:
        insertion_recorded.set()
        assert continue_enforcement.wait(timeout=5)
        original_enforce(protected)

    def read_old_entry() -> None:
        read_started.set()
        try:
            old_storage.get("old")
        except CacheStorageKeyNotFoundError as ex:
            read_errors.append(ex)
        finally:
            read_finished.set()

    with patch.object(budget, "enforce_budget", side_effect=delayed_enforce):
        writer = threading.Thread(target=writer_storage.set, args=("new", b"bbbb"))
        writer.start()
        assert insertion_recorded.wait(timeout=5)

        reader = threading.Thread(target=read_old_entry)
        reader.start()
        assert read_started.wait(timeout=5)
        assert not read_finished.wait(timeout=0.1)
        continue_enforcement.set()
        writer.join(timeout=5)
        reader.join(timeout=5)

    assert not writer.is_alive()
    assert not reader.is_alive()
    assert len(read_errors) == 1
    assert isinstance(read_errors[0], CacheStorageKeyNotFoundError)
    with pytest.raises(CacheStorageKeyNotFoundError):
        old_storage.get("old")
    assert writer_storage.get("new") == b"bbbb"
    assert budget.total_bytes == 4


@pytest.mark.parametrize("remove", ["clear", "delete"])
def test_selected_victim_removed_concurrently_is_reconciled(
    remove: str,
) -> None:
    """Concurrent victim removal is reconciled before selecting another entry."""
    budget = GlobalCacheBudget(max_bytes=6)
    first = _create_storage(budget, "first")
    second = _create_storage(budget, "second")
    first.set("a", b"aaa")
    second.set("b", b"bbb")

    selected = threading.Event()
    continue_eviction = threading.Event()
    original_evict = first._evict_from_mem_cache

    def delayed_evict(key: str, expected_generation: int) -> bool:
        selected.set()
        assert continue_eviction.wait(timeout=5)
        return original_evict(key, expected_generation)

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
    budget = GlobalCacheBudget(max_bytes=6)
    first = _create_storage(budget, "first", ttl_seconds=1)
    second = _create_storage(budget, "second")
    now = 0.0
    first._mem_cache._timer = lambda: now
    first.set("expired", b"aaa")
    second.set("b", b"bbb")

    selected = threading.Event()
    continue_eviction = threading.Event()
    original_evict = first._evict_from_mem_cache

    def delayed_evict(key: str, expected_generation: int) -> bool:
        selected.set()
        assert continue_eviction.wait(timeout=5)
        return original_evict(key, expected_generation)

    with patch.object(first, "_evict_from_mem_cache", side_effect=delayed_evict):
        global_writer = threading.Thread(target=second.set, args=("c", b"c"))
        global_writer.start()
        assert selected.wait(timeout=5)

        # Stats collection reaps the expired selected key and publishes its removal.
        now = 2.0
        assert first.get_stats() == {}
        continue_eviction.set()
        global_writer.join(timeout=5)

    assert not global_writer.is_alive()
    assert second.get("b") == b"bbb"
    assert second.get("c") == b"c"
    assert budget.total_bytes == 4


def test_unique_key_churn_keeps_coordinator_metadata_bounded() -> None:
    """Unique-key churn does not retain per-key coordinator metadata."""
    budget = GlobalCacheBudget(max_bytes=1024)
    storage = _create_storage(budget, "churn")

    for index in range(2000):
        key = f"key-{index}"
        storage.set(key, b"x")
        storage.delete(key)

    assert budget.total_bytes == 0
    assert not budget._entries
    assert budget._storage_entries[storage._global_storage_id] == set()


def test_concurrent_writes_do_not_evict_each_other() -> None:
    """Concurrent writes leave exactly one live entry under a one-byte budget."""
    budget = GlobalCacheBudget(max_bytes=1)
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
    budget = GlobalCacheBudget(max_bytes=64)
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
