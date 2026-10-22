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
from unittest.mock import patch

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


class _BarrierLock:
    """A lock that proves two independent storage critical sections can overlap."""

    def __init__(self, barrier: threading.Barrier) -> None:
        self._lock = threading.Lock()
        self._barrier = barrier

    def __enter__(self) -> None:
        self._lock.acquire()
        self._barrier.wait(timeout=5)

    def __exit__(self, *_args: object) -> None:
        self._lock.release()


def _create_storage(
    budget: GlobalCacheBudget,
    name: str,
    *,
    persist_storage: _DictStorage | DummyCacheStorage | None = None,
    ttl_seconds: float | None = None,
    max_entries: int | None = None,
    max_size_bytes: int | None = None,
) -> InMemoryCacheStorageWrapper:
    context = CacheStorageContext(
        function_key=name,
        function_display_name=name,
        ttl_seconds=ttl_seconds,
        max_entries=max_entries,
        max_size_bytes=max_size_bytes,
    )
    with patch(
        "streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper."
        "get_global_cache_budget",
        return_value=budget,
    ):
        return InMemoryCacheStorageWrapper(
            persist_storage or DummyCacheStorage(), context
        )


def test_budget_from_config_uses_configured_limit() -> None:
    with patch(
        "streamlit.runtime.caching.global_cache_budget.config.get_option",
        return_value="1KiB",
    ):
        budget = GlobalCacheBudget.from_config()

    assert budget.max_bytes == 1024


def test_budget_from_default_config_is_disabled() -> None:
    assert GlobalCacheBudget.from_config().max_bytes is None


def test_disabled_budget_does_not_track_entries_or_recency() -> None:
    budget = GlobalCacheBudget(max_bytes=None)
    storage = _create_storage(budget, "disabled")

    storage.set("key", b"value")
    assert storage.get("key") == b"value"

    assert budget.total_bytes == 0
    assert not budget._entries
    assert not budget._recency_hints
    assert storage._generations == {}


def test_reconfigure_accounts_for_existing_entries() -> None:
    budget = GlobalCacheBudget(max_bytes=None)
    storage = _create_storage(budget, "raw-mode")
    storage.set("old", b"aaa")
    storage.set("recent", b"bbb")
    assert storage.get("old") == b"aaa"

    budget.reconfigure(max_bytes=3)

    assert storage.get("old") == b"aaa"
    with pytest.raises(CacheStorageKeyNotFoundError):
        storage.get("recent")
    assert budget.total_bytes == 3


def test_reconfigure_allows_reads_and_writes_before_storage_activation() -> None:
    """Concurrent access remains safe while disabled entries are activated."""
    budget = GlobalCacheBudget(max_bytes=None)
    first = _create_storage(budget, "first")
    second = _create_storage(budget, "second")
    first.set("first", b"a")
    second.set("old", b"bb")
    activation_started = threading.Event()
    continue_activation = threading.Event()
    original_activate = first._activate_global_budget_entries

    def delayed_activate() -> None:
        activation_started.set()
        assert continue_activation.wait(timeout=5)
        original_activate()

    with (
        patch.object(first, "_activate_global_budget_entries", delayed_activate),
        ThreadPoolExecutor(max_workers=1) as executor,
    ):
        reconfigure = executor.submit(budget.reconfigure, 100)
        assert activation_started.wait(timeout=5)
        assert second.get("old") == b"bb"
        second.set("new", b"ccc")
        continue_activation.set()
        reconfigure.result(timeout=5)

    assert budget.total_bytes == 6
    assert second.get("old") == b"bb"
    assert second.get("new") == b"ccc"


def test_enabled_writes_to_different_storages_overlap() -> None:
    """The global budget does not wrap writes in one process-wide lock."""
    budget = GlobalCacheBudget(max_bytes=100)
    first = _create_storage(budget, "first")
    second = _create_storage(budget, "second")
    barrier = threading.Barrier(2)

    with (
        patch.object(first, "_mem_cache_lock", _BarrierLock(barrier)),
        patch.object(second, "_mem_cache_lock", _BarrierLock(barrier)),
        ThreadPoolExecutor(max_workers=2) as executor,
    ):
        futures = [
            executor.submit(first.set, "first", b"a"),
            executor.submit(second.set, "second", b"b"),
        ]
        for future in futures:
            future.result(timeout=5)

    assert budget.total_bytes == 2


def test_budget_evicts_global_lru_and_counts_success() -> None:
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
    assert stats == [
        CounterStat(
            family_name=CACHE_DATA_EVICTIONS_FAMILY,
            value=1,
            labels={"reason": "global_budget"},
            help="Total st.cache_data entries evicted by the global byte budget.",
        )
    ]


def test_recency_hints_are_bounded_and_drained_by_write() -> None:
    budget = GlobalCacheBudget(max_bytes=100)
    storage = _create_storage(budget, "bounded")
    storage.set("key", b"x")

    for _ in range(5000):
        assert storage.get("key") == b"x"
    assert len(budget._recency_hints) == budget._recency_hints.maxlen

    storage.set("other", b"y")
    assert not budget._recency_hints


def test_oversized_global_entry_is_retained_and_warns_once() -> None:
    budget = GlobalCacheBudget(max_bytes=2)
    storage = _create_storage(budget, "oversized")

    with patch(
        "streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper."
        "_LOGGER.warning"
    ) as warning:
        storage.set("first", b"large")
        storage.set("second", b"larger")

    assert storage.get("second") == b"larger"
    warning.assert_called_once_with(
        "A cached result is larger than the st.cache_data size limit and "
        "was stored anyway.",
        stack_info=True,
    )


def test_global_eviction_warning_is_once_and_after_success() -> None:
    budget = GlobalCacheBudget(max_bytes=2)
    storage = _create_storage(budget, "warning")

    with patch(
        "streamlit.runtime.caching.global_cache_budget._LOGGER.warning"
    ) as warning:
        storage.set("a", b"aa")
        warning.assert_not_called()
        storage.set("b", b"bb")
        storage.set("c", b"cc")

    warning.assert_called_once_with(
        "st.cache_data reached its %s serialized-size budget "
        "(server.maxCacheDataSize) and is evicting least-recently-used "
        "entries, which are recomputed on their next use, or reloaded from "
        "disk if they were persisted. Set server.maxCacheDataSize to change "
        "the budget, or to '0' to disable it. Per-function sizes are on the "
        "cache_memory_bytes metric.",
        "2 bytes",
        stack_info=True,
    )


def test_disk_promotion_counts_and_global_eviction_preserves_disk() -> None:
    budget = GlobalCacheBudget(max_bytes=2)
    persistent = _DictStorage()
    storage = _create_storage(budget, "persistent", persist_storage=persistent)
    storage.set("a", b"aa")
    storage.set("b", b"bb")

    assert persistent.values == {"a": b"aa", "b": b"bb"}
    assert "a" not in storage._mem_cache

    assert storage.get("a") == b"aa"
    assert budget.total_bytes == 2
    assert "a" in storage._mem_cache
    assert "b" not in storage._mem_cache
    assert persistent.values == {"a": b"aa", "b": b"bb"}


def test_local_removals_and_close_update_accounting() -> None:
    budget = GlobalCacheBudget(max_bytes=100)
    storage = _create_storage(budget, "local", max_entries=1, max_size_bytes=10)
    storage.set("a", b"aa")
    storage.set("b", b"bbb")
    assert budget.total_bytes == 3

    storage.delete("b")
    assert budget.total_bytes == 0
    storage.set("c", b"cccc")
    storage.clear()
    assert budget.total_bytes == 0
    storage.set("d", b"dd")
    storage.close()
    assert budget.total_bytes == 0


def test_explicit_delete_of_expired_entry_updates_accounting_once() -> None:
    """Deleting an unreaped expired entry removes its accounted bytes once."""
    budget = GlobalCacheBudget(max_bytes=100)
    with patch(
        "streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper."
        "cache_utils.TTLCACHE_TIMER",
        return_value=0,
    ) as timer:
        storage = _create_storage(budget, "expired", ttl_seconds=1)
        storage.set("key", b"abc")
        generation = storage._generations["key"]
        assert budget.total_bytes == 3
        timer.return_value = 2

        with patch.object(
            budget, "record_removals", wraps=budget.record_removals
        ) as record_removals:
            storage.delete("key")
            storage.delete("key")

    assert "key" not in storage._mem_cache._data
    assert budget.total_bytes == 0
    record_removals.assert_called_once_with(
        storage._global_storage_id, [("key", generation)]
    )


def test_late_report_from_unregistered_storage_is_ignored() -> None:
    budget = GlobalCacheBudget(max_bytes=100)
    persistent = _DictStorage()
    storage = _create_storage(budget, "detached", persist_storage=persistent)
    storage.set("initial", b"x")
    storage.close()

    storage.set("late", b"late")

    assert budget.total_bytes == 0
    assert persistent.values["late"] == b"late"
    assert storage._mem_cache["late"] == b"late"


def test_same_function_key_storages_have_unique_registration() -> None:
    budget = GlobalCacheBudget(max_bytes=100)
    first = _create_storage(budget, "shared")
    second = _create_storage(budget, "shared")
    first.set("value", b"aa")
    second.set("value", b"bbb")

    assert first._global_storage_id != second._global_storage_id
    assert budget.total_bytes == 5
    first.close()
    assert budget.total_bytes == 3


def test_weak_registry_does_not_pin_storage() -> None:
    budget = GlobalCacheBudget(max_bytes=100)
    storage = _create_storage(budget, "collected")
    storage.set("key", b"value")
    storage_ref = weakref.ref(storage)

    del storage
    gc.collect()

    assert storage_ref() is None
    assert budget.total_bytes == 0


def test_rewritten_selected_victim_keeps_new_generation() -> None:
    budget = GlobalCacheBudget(max_bytes=6)
    victim = _create_storage(budget, "victim")
    writer = _create_storage(budget, "writer")
    victim.set("key", b"aaa")
    writer.set("existing", b"bbb")
    selected = threading.Event()
    continue_eviction = threading.Event()
    original_evict = victim._evict_from_mem_cache

    def delayed_evict(key: str, expected_generation: int) -> bool:
        selected.set()
        assert continue_eviction.wait(timeout=5)
        return original_evict(key, expected_generation)

    with patch.object(victim, "_evict_from_mem_cache", side_effect=delayed_evict):
        write_thread = threading.Thread(target=writer.set, args=("new", b"x"))
        write_thread.start()
        assert selected.wait(timeout=5)
        victim.set("key", b"new")
        continue_eviction.set()
        write_thread.join(timeout=5)

    assert not write_thread.is_alive()
    assert victim.get("key") == b"new"
    assert budget.total_bytes <= 6


def test_concurrent_churn_keeps_exact_bounded_accounting() -> None:
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
