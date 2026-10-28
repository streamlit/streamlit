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
import queue
import threading
import weakref
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest

from streamlit.runtime.caching.global_cache_budget import (
    _GLOBAL_CACHE_BUDGET_HOLDER,
    CACHE_DATA_EVICTIONS_FAMILY,
    GlobalCacheBudget,
    _format_byte_size,
    get_global_cache_budget,
    reconfigure_global_cache_budget_from_config,
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

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence


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


def test_lazy_global_budget_creation_does_not_read_config() -> None:
    """Raw-mode cache creation cannot snapshot config before server startup."""
    with (
        patch.object(_GLOBAL_CACHE_BUDGET_HOLDER, "budget", None),
        patch(
            "streamlit.runtime.caching.global_cache_budget.config.get_option"
        ) as get_option,
    ):
        budget = get_global_cache_budget()

    assert budget.max_bytes is None
    get_option.assert_not_called()


def test_startup_configuration_creates_global_budget() -> None:
    """Server startup configures the budget when no raw-mode cache created it."""
    with (
        patch.object(_GLOBAL_CACHE_BUDGET_HOLDER, "budget", None),
        patch(
            "streamlit.runtime.caching.global_cache_budget.config.get_option",
            return_value="1KiB",
        ),
    ):
        reconfigure_global_cache_budget_from_config()
        budget = _GLOBAL_CACHE_BUDGET_HOLDER.budget

    assert budget is not None
    assert budget.max_bytes == 1024


def test_disabled_budget_does_not_track_entries_or_recency() -> None:
    """A disabled budget does not collect entry or recency bookkeeping."""
    budget = GlobalCacheBudget(max_bytes=None)
    storage = _create_storage(budget, "disabled")

    storage.set("key", b"value")
    assert storage.get("key") == b"value"

    assert budget.total_bytes == 0
    assert not budget._entries
    assert not budget._recency_hints
    assert storage._generations == {}


def test_reconfigure_accounts_for_existing_entries() -> None:
    """Enabling the budget accounts for entries written before activation."""
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
    """Budget overflow evicts the global LRU entry and records the eviction."""
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
    """Read recency hints remain bounded and are applied by the next write."""
    budget = GlobalCacheBudget(max_bytes=100)
    storage = _create_storage(budget, "bounded")
    storage.set("key", b"x")

    for _ in range(5000):
        assert storage.get("key") == b"x"
    assert len(budget._recency_hints) == budget._recency_hints.maxlen

    storage.set("other", b"y")
    assert not budget._recency_hints


def test_recency_hint_drain_ignores_hints_appended_during_drain() -> None:
    """A drain processes only the hints queued when it starts."""

    class ReplenishingDeque(deque[tuple[int, str, int]]):
        def __init__(self, hints: list[tuple[int, str, int]]) -> None:
            super().__init__(hints, maxlen=len(hints))
            self.popleft_calls = 0
            self.replenishments_remaining = len(hints)

        def popleft(self) -> tuple[int, str, int]:
            hint = super().popleft()
            self.popleft_calls += 1
            if self.replenishments_remaining:
                self.replenishments_remaining -= 1
                self.append(hint)
            return hint

    budget = GlobalCacheBudget(max_bytes=100)
    hints = ReplenishingDeque([(0, "first", 1), (0, "second", 1)])
    budget._recency_hints = hints
    starting_count = len(hints)

    with budget._lock:
        budget._drain_recency_hints_locked()

    assert hints.popleft_calls == starting_count
    assert len(hints) == starting_count

    hints.replenishments_remaining = 0
    with budget._lock:
        budget._drain_recency_hints_locked()

    assert hints.popleft_calls == starting_count * 2
    assert not hints


def test_oversized_global_entry_is_retained_and_warns_once() -> None:
    """A globally oversized entry is retained and warns once per storage."""
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
        "was stored anyway. Function %r produced %s serialized bytes, "
        "exceeding %s.",
        "oversized",
        len(b"large"),
        "server.maxCacheDataSize (2 bytes)",
    )


def test_oversized_warning_names_both_exceeded_limits() -> None:
    """The oversized warning identifies both applicable configured limits."""
    budget = GlobalCacheBudget(max_bytes=2)
    storage = _create_storage(budget, "both-limits", max_size_bytes=3)

    with patch(
        "streamlit.runtime.caching.storage.in_memory_cache_storage_wrapper."
        "_LOGGER.warning"
    ) as warning:
        storage.set("key", b"large")

    warning.assert_called_once_with(
        "A cached result is larger than the st.cache_data size limit and "
        "was stored anyway. Function %r produced %s serialized bytes, "
        "exceeding %s.",
        "both-limits",
        len(b"large"),
        "max_size (3 bytes) and server.maxCacheDataSize (2 bytes)",
    )


def test_global_eviction_warning_is_once_and_after_success() -> None:
    """The global eviction warning is emitted once after a successful eviction."""
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
    )


def test_disk_promotion_counts_and_global_eviction_preserves_disk() -> None:
    """Disk promotion is accounted while global eviction preserves disk data."""
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
    """Local eviction, deletion, clearing, and close update global accounting."""
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
    """Writes after storage unregistration do not restore global accounting."""
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
    """Storages sharing a function key receive distinct registrations."""
    budget = GlobalCacheBudget(max_bytes=100)
    first = _create_storage(budget, "shared")
    second = _create_storage(budget, "shared")
    first.set("value", b"aa")
    second.set("value", b"bbb")

    assert first._global_storage_id != second._global_storage_id
    assert budget.total_bytes == 5
    first.close()
    assert budget.total_bytes == 3


def test_weak_removal_callback_does_not_pin_storage() -> None:
    """The TTL removal callback does not delay wrapper release until cyclic GC."""
    budget = GlobalCacheBudget(max_bytes=100)
    storage = _create_storage(budget, "collected")
    storage.set("key", b"value")
    on_remove = storage._mem_cache._on_remove
    storage_ref = weakref.ref(storage)

    del storage

    assert storage_ref() is None
    assert budget.total_bytes == 0
    assert on_remove is not None
    on_remove("key", b"value")
    assert budget.total_bytes == 0


def test_rewritten_selected_victim_keeps_new_generation() -> None:
    """A victim rewritten after reservation keeps its newer generation."""
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
    """Concurrent cache churn preserves exact bounded byte accounting."""
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


def test_startup_configuration_reconfigures_existing_global_budget() -> None:
    """Server startup enables the budget instance raw-mode caches already use."""
    existing = GlobalCacheBudget(max_bytes=None)
    storage = _create_storage(existing, "raw-mode-existing")
    storage.set("key", b"abc")

    with (
        patch.object(_GLOBAL_CACHE_BUDGET_HOLDER, "budget", existing),
        patch(
            "streamlit.runtime.caching.global_cache_budget.config.get_option",
            return_value="1KiB",
        ),
    ):
        reconfigure_global_cache_budget_from_config()
        assert _GLOBAL_CACHE_BUDGET_HOLDER.budget is existing

    assert existing.max_bytes == 1024
    assert existing.total_bytes == 3


def test_reconfigure_disable_clears_accounting_but_keeps_entries() -> None:
    """Disabling the budget drops accounting without evicting cached entries."""
    budget = GlobalCacheBudget(max_bytes=100)
    storage = _create_storage(budget, "toggle")
    storage.set("a", b"aaa")
    storage.set("b", b"bb")

    budget.reconfigure(max_bytes=None)

    assert not budget.is_enabled
    assert budget.total_bytes == 0
    assert storage.get("a") == b"aaa"
    assert storage.get("b") == b"bb"
    storage.set("c", b"c")
    assert budget.total_bytes == 0

    budget.reconfigure(max_bytes=100)
    assert budget.total_bytes == 6


def test_reconfigure_to_same_budget_keeps_retained_oversized_entry() -> None:
    """Reapplying the current budget does not evict a retained oversized entry."""
    budget = GlobalCacheBudget(max_bytes=2)
    storage = _create_storage(budget, "same-budget")
    storage.set("big", b"large")

    budget.reconfigure(max_bytes=2)

    assert storage.get("big") == b"large"
    assert budget.total_bytes == 5


class _RacingUnregisterQueue:
    """An unregister queue whose first ``get_nowait`` loses a race after ``empty``."""

    def __init__(self) -> None:
        self._queue: queue.SimpleQueue[int] = queue.SimpleQueue()
        self._lost_races_remaining = 1

    def put(self, storage_id: int) -> None:
        self._queue.put(storage_id)

    def empty(self) -> bool:
        return self._queue.empty()

    def get_nowait(self) -> int:
        if self._lost_races_remaining:
            self._lost_races_remaining -= 1
            raise queue.Empty
        return self._queue.get_nowait()


def test_unregister_drain_retries_after_losing_queue_race() -> None:
    """A queued unregister missed by a racing drain is applied on the next one."""
    budget = GlobalCacheBudget(max_bytes=100)
    storage = _create_storage(budget, "racing")
    storage.set("key", b"abc")
    pending = _RacingUnregisterQueue()
    budget._pending_unregisters = pending  # type: ignore[assignment] # ty: ignore[invalid-assignment]
    pending.put(storage._global_storage_id)

    # Each ``total_bytes`` read drains pending unregisters; the first drain
    # loses the race and leaves the queued unregister for the second.
    assert budget.total_bytes == 3
    assert budget.total_bytes == 0


@pytest.mark.parametrize(
    "report",
    [
        pytest.param(
            lambda budget, storage_id: budget.record_write_and_reserve_victims(
                storage_id, "key", 5, 1, []
            ),
            id="write",
        ),
        pytest.param(
            lambda budget, storage_id: budget.activate_storage_entries(
                storage_id, [("key", 5, 1)]
            ),
            id="activate",
        ),
        pytest.param(
            lambda budget, storage_id: budget.record_read(storage_id, "key", 1),
            id="read",
        ),
        pytest.param(
            lambda budget, storage_id: budget.record_removals(storage_id, [("key", 1)]),
            id="removals",
        ),
    ],
)
def test_disabled_budget_ignores_direct_reports(
    report: Callable[[GlobalCacheBudget, int], Sequence[object] | None],
) -> None:
    """A disabled budget records nothing and reserves no victims for any report."""
    budget = GlobalCacheBudget(max_bytes=None)
    storage = _create_storage(budget, "disabled-reports")

    assert not report(budget, storage._global_storage_id)

    assert budget.total_bytes == 0
    assert not budget._entries
    assert not budget._recency_hints


def test_activation_for_unregistered_storage_is_ignored() -> None:
    """Activating entries for a closed storage does not add accounting."""
    budget = GlobalCacheBudget(max_bytes=100)
    storage = _create_storage(budget, "closed")
    storage_id = storage._global_storage_id
    storage.close()

    budget.activate_storage_entries(storage_id, [("key", 5, 1)])

    assert budget.total_bytes == 0
    assert not budget._entries


def test_rewrite_of_accounted_entry_replaces_its_size() -> None:
    """Rewriting an accounted key replaces its old size and generation."""
    budget = GlobalCacheBudget(max_bytes=100)
    storage = _create_storage(budget, "rewrite")
    storage_id = storage._global_storage_id

    budget.record_write_and_reserve_victims(storage_id, "key", 5, 1, [])
    budget.record_write_and_reserve_victims(storage_id, "key", 2, 2, [])
    assert budget.total_bytes == 2

    budget.record_removals(storage_id, [("key", 1)])
    assert budget.total_bytes == 2


def test_victim_selection_drops_collected_storage_before_evicting() -> None:
    """Entries of a collected storage are released instead of evicting live ones."""
    budget = GlobalCacheBudget(max_bytes=6)
    stale = _create_storage(budget, "stale")
    survivor = _create_storage(budget, "survivor")
    stale.set("old", b"aaa")
    survivor.set("middle", b"bb")
    stale_id = stale._global_storage_id
    # Replace the registration with a reference that has no unregister
    # callback, so the collected storage is only discovered during selection.
    budget._storages[stale_id] = weakref.ref(stale)
    del stale
    gc.collect()
    assert budget._storages[stale_id]() is None

    survivor.set("new", b"cc")

    assert survivor.get("middle") == b"bb"
    assert survivor.get("new") == b"cc"
    assert budget.total_bytes == 4
    assert stale_id not in budget._storage_entries
    assert budget._global_evictions == 0


def test_reserved_victim_is_kept_after_its_storage_unregisters() -> None:
    """A reserved victim is not removed once its storage left the budget."""
    budget = GlobalCacheBudget(max_bytes=100)
    storage = _create_storage(budget, "unregistered")
    storage.set("key", b"abc")
    generation = storage._generations["key"]
    budget.unregister(storage._global_storage_id)

    assert not storage._evict_from_mem_cache("key", expected_generation=generation)
    assert storage._mem_cache["key"] == b"abc"


@pytest.mark.parametrize(
    ("family_names", "expected_families"),
    [
        pytest.param(None, [CACHE_DATA_EVICTIONS_FAMILY], id="all"),
        pytest.param(
            [CACHE_DATA_EVICTIONS_FAMILY], [CACHE_DATA_EVICTIONS_FAMILY], id="match"
        ),
        pytest.param(["cache_memory_bytes"], [], id="other"),
    ],
)
def test_get_stats_filters_by_family(
    family_names: list[str] | None, expected_families: list[str]
) -> None:
    """Eviction stats are reported only when their family is requested."""
    budget = GlobalCacheBudget(max_bytes=100)

    assert budget.stats_families == (CACHE_DATA_EVICTIONS_FAMILY,)
    assert list(budget.get_stats(family_names)) == expected_families


@pytest.mark.parametrize(
    ("size", "expected"),
    [
        (0, "0 bytes"),
        (1, "1 byte"),
        (1023, "1023 bytes"),
        (1024, "1.0 KB"),
        (1536, "1.5 KB"),
        (1024**2, "1.0 MB"),
        (5 * 1024**3, "5.0 GB"),
        (1024**4, "1.0 TB"),
    ],
)
def test_format_byte_size(size: int, expected: str) -> None:
    """Budget sizes are formatted with the largest whole binary unit."""
    assert _format_byte_size(size) == expected
